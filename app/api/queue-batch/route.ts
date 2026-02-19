import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  createJob,
  createJobItem,
  getAppSetting,
  getBrandBrain,
  getDefaultVoiceProfile,
  getLearningSignals,
  getLatestReferenceVideo,
  listLatestTrends,
  getVoiceProfileById,
  initDb
} from "@/lib/db";
import { generateConcept } from "@/lib/concepts";
import { DEFAULT_A_COUNT, DEFAULT_B_COUNT } from "@/lib/constants";
import { requireAdminOr401 } from "@/lib/auth";
import { scoreConcept } from "@/lib/quality";
import { estimateItemCostUsd } from "@/lib/costs";
import { getWorkflowDefault } from "@/lib/settings";
import type { CostPreset, WorkflowMode } from "@/types";
import { getCostPresetConfig } from "@/lib/costPresets";
import {
  generateThumbnailPromptCandidates,
  generateTitleCandidates
} from "@/lib/thumbnailLab";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();

  const contentType = request.headers.get("content-type") ?? "";
  let count = DEFAULT_A_COUNT + DEFAULT_B_COUNT;
  let aCount = DEFAULT_A_COUNT;
  let bCount = DEFAULT_B_COUNT;
  let workflowMode: WorkflowMode | null = null;
  let voiceProfileId: string | null = null;
  let videoProvider: "auto" | "openai" | "gemini" | null = null;
  let variantCount = 3;
  let costPreset: CostPreset = "balanced";
  let hasCostPresetInput = false;
  let useTrendContext = true;
  let useBrandBrain = true;

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      count?: number;
      split?: { a?: number; b?: number };
      workflowMode?: WorkflowMode;
      voiceProfileId?: string;
      videoProvider?: "auto" | "openai" | "gemini";
      variantCount?: number;
      costPreset?: CostPreset;
      useTrendContext?: boolean;
      useBrandBrain?: boolean;
    };

    count = body.count ?? count;
    aCount = body.split?.a ?? aCount;
    bCount = body.split?.b ?? bCount;
    workflowMode =
      body.workflowMode === "approval" || body.workflowMode === "autonomous"
        ? body.workflowMode
        : null;
    voiceProfileId = body.voiceProfileId ? String(body.voiceProfileId) : null;
    videoProvider =
      body.videoProvider === "openai" ||
      body.videoProvider === "gemini" ||
      body.videoProvider === "auto"
        ? body.videoProvider
        : null;
    variantCount = Number.isFinite(body.variantCount) ? Math.max(1, Math.min(6, Number(body.variantCount))) : 3;
    costPreset =
      body.costPreset === "cheap" || body.costPreset === "max_quality" || body.costPreset === "balanced"
        ? body.costPreset
        : "balanced";
    hasCostPresetInput = Boolean(body.costPreset);
    useTrendContext = body.useTrendContext ?? true;
    useBrandBrain = body.useBrandBrain ?? true;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const rawMode = String(form.get("workflowMode") ?? "");
    if (rawMode === "approval" || rawMode === "autonomous") {
      workflowMode = rawMode;
    }
    voiceProfileId = String(form.get("voiceProfileId") ?? "").trim() || null;
    const rawProvider = String(form.get("videoProvider") ?? "").trim();
    if (rawProvider === "openai" || rawProvider === "gemini" || rawProvider === "auto") {
      videoProvider = rawProvider;
    }
    const rawVariants = Number(form.get("variantCount") ?? "3");
    if (Number.isFinite(rawVariants)) {
      variantCount = Math.max(1, Math.min(6, rawVariants));
    }
    const rawPreset = String(form.get("costPreset") ?? "balanced");
    if (rawPreset === "cheap" || rawPreset === "max_quality" || rawPreset === "balanced") {
      costPreset = rawPreset;
      hasCostPresetInput = true;
    }
    useTrendContext = String(form.get("useTrendContext") ?? "true") !== "false";
    useBrandBrain = String(form.get("useBrandBrain") ?? "true") !== "false";
  }

  if (aCount + bCount !== count) {
    return NextResponse.json(
      { ok: false, error: "Split must sum to count" },
      { status: 400 }
    );
  }

  const jobId = crypto.randomUUID();
  const latestReference = await getLatestReferenceVideo();
  const costPresetSetting = await getAppSetting<{ defaultPreset?: CostPreset }>("cost_presets");
  const trend = useTrendContext ? (await listLatestTrends(1))[0] ?? null : null;
  const brandBrain = useBrandBrain ? await getBrandBrain() : null;
  const learning = await getLearningSignals();
  const defaultWorkflowMode = await getWorkflowDefault();
  const selectedWorkflowMode = workflowMode ?? defaultWorkflowMode;
  const selectedCostPreset = hasCostPresetInput
    ? costPreset
    : (costPresetSetting?.defaultPreset ?? costPreset);
  const presetConfig = getCostPresetConfig(selectedCostPreset);
  const selectedVideoProvider = videoProvider ?? presetConfig.defaultProvider;

  const selectedVoiceProfile = voiceProfileId
    ? await getVoiceProfileById(voiceProfileId)
    : await getDefaultVoiceProfile();

  const referenceContext = latestReference
    ? {
        sourceUrl: latestReference.source_url,
        sourceTitle: latestReference.title ?? undefined,
        sourceAuthor: latestReference.author_name ?? undefined,
        styleProfile: latestReference.style_json,
        platform: latestReference.platform ?? undefined
      }
    : undefined;

  await createJob({
    id: jobId,
    status: "queued",
    requested_count: count,
    a_count: aCount,
    b_count: bCount,
    workflow_mode: selectedWorkflowMode,
    voice_profile_id: selectedVoiceProfile?.id ?? null,
    settings_json: {
      workflowMode: selectedWorkflowMode,
      voiceProfileId: selectedVoiceProfile?.id ?? null,
      videoProvider: selectedVideoProvider,
      variantCount,
      costPreset: selectedCostPreset,
      trendSnapshotTitle: trend?.title ?? null
    }
  });

  let estimatedBatchTotal = 0;

  async function enqueueModeItems(mode: "A" | "B", baseCount: number) {
    for (let i = 0; i < baseCount; i += 1) {
      const parentConceptId = crypto.randomUUID();
      for (let variantIndex = 0; variantIndex < variantCount; variantIndex += 1) {
        const generated = generateConcept(i, mode, referenceContext, {
          variantIndex,
          variantCount,
          trend: trend
            ? {
                title: trend.title,
                hookStyle: String(trend.pattern_json.hookStyle ?? "")
              }
            : null,
          brand: brandBrain
            ? {
                claims: brandBrain.claims_json,
                defaultCta: brandBrain.default_cta,
                tone: brandBrain.tone,
                bannedWords: brandBrain.banned_words_json
              }
            : undefined,
          learning: {
            winnerCount: learning.winnerCount,
            loserCount: learning.loserCount
          }
        });

        let concept: Record<string, unknown> = {
          ...generated,
          videoProvider: selectedVideoProvider,
          parentConceptId
        };

        if (Array.isArray(brandBrain?.banned_words_json) && brandBrain?.banned_words_json.length) {
          const hook = String(concept["hook"] ?? "");
          const cleanHook = brandBrain.banned_words_json.reduce((acc, word) => {
            const re = new RegExp(`\\b${word}\\b`, "gi");
            return acc.replace(re, "[redacted]");
          }, hook);
          concept = { ...concept, hook: cleanHook };
        }

        const titleCandidates = generateTitleCandidates(
          String(concept["hook"] ?? ""),
          String(concept["cta"] ?? "")
        );
        const thumbnailPromptCandidates = generateThumbnailPromptCandidates(
          String(concept["hook"] ?? "")
        );

        concept = {
          ...concept,
          titleCandidates,
          thumbnailPromptCandidates
        };

        const quality = scoreConcept(concept);
        let estimatedCostUsd = estimateItemCostUsd(mode, concept);

        if (estimatedCostUsd > presetConfig.maxPerOutputUsd && mode === "B") {
          concept = {
            ...concept,
            durationSeconds: 4,
            videoProvider: presetConfig.defaultProvider,
            optimizerNote: "Adjusted by hard per-output budget cap."
          };
          estimatedCostUsd = estimateItemCostUsd(mode, concept);
        }

        estimatedBatchTotal += estimatedCostUsd;
        if (estimatedBatchTotal > presetConfig.maxBatchUsd) {
          return;
        }

        await createJobItem({
          id: crypto.randomUUID(),
          jobId,
          mode,
          status: selectedWorkflowMode === "approval" ? "awaiting_approval" : "queued",
          conceptJson: concept,
          approvalStatus: selectedWorkflowMode === "approval" ? "pending" : "not_required",
          qualityScore: quality.total,
          qualityJson: quality,
          estimatedCostUsd
        });
      }
    }
  }

  await enqueueModeItems("A", aCount);
  await enqueueModeItems("B", bCount);

  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true, jobId });
  }

  return NextResponse.redirect(new URL(`/jobs/${jobId}`, request.url));
}
