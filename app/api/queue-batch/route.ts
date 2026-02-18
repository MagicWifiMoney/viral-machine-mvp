import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  createJob,
  createJobItem,
  getDefaultVoiceProfile,
  getLatestReferenceVideo,
  getVoiceProfileById,
  initDb
} from "@/lib/db";
import { generateConcept } from "@/lib/concepts";
import { DEFAULT_A_COUNT, DEFAULT_B_COUNT } from "@/lib/constants";
import { requireAdminOr401 } from "@/lib/auth";
import { scoreConcept } from "@/lib/quality";
import { estimateItemCostUsd } from "@/lib/costs";
import { getWorkflowDefault } from "@/lib/settings";
import type { WorkflowMode } from "@/types";

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

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      count?: number;
      split?: { a?: number; b?: number };
      workflowMode?: WorkflowMode;
      voiceProfileId?: string;
    };

    count = body.count ?? count;
    aCount = body.split?.a ?? aCount;
    bCount = body.split?.b ?? bCount;
    workflowMode =
      body.workflowMode === "approval" || body.workflowMode === "autonomous"
        ? body.workflowMode
        : null;
    voiceProfileId = body.voiceProfileId ? String(body.voiceProfileId) : null;
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const rawMode = String(form.get("workflowMode") ?? "");
    if (rawMode === "approval" || rawMode === "autonomous") {
      workflowMode = rawMode;
    }
    voiceProfileId = String(form.get("voiceProfileId") ?? "").trim() || null;
  }

  if (aCount + bCount !== count) {
    return NextResponse.json(
      { ok: false, error: "Split must sum to count" },
      { status: 400 }
    );
  }

  const jobId = crypto.randomUUID();
  const latestReference = await getLatestReferenceVideo();
  const defaultWorkflowMode = await getWorkflowDefault();
  const selectedWorkflowMode = workflowMode ?? defaultWorkflowMode;

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
      voiceProfileId: selectedVoiceProfile?.id ?? null
    }
  });

  for (let i = 0; i < aCount; i += 1) {
    const concept = generateConcept(i, "A", referenceContext);
    const quality = scoreConcept(concept);
    await createJobItem({
      id: crypto.randomUUID(),
      jobId,
      mode: "A",
      status: selectedWorkflowMode === "approval" ? "awaiting_approval" : "queued",
      conceptJson: concept,
      approvalStatus: selectedWorkflowMode === "approval" ? "pending" : "not_required",
      qualityScore: quality.total,
      qualityJson: quality,
      estimatedCostUsd: estimateItemCostUsd("A", concept)
    });
  }

  for (let i = 0; i < bCount; i += 1) {
    const concept = generateConcept(i, "B", referenceContext);
    const quality = scoreConcept(concept);
    await createJobItem({
      id: crypto.randomUUID(),
      jobId,
      mode: "B",
      status: selectedWorkflowMode === "approval" ? "awaiting_approval" : "queued",
      conceptJson: concept,
      approvalStatus: selectedWorkflowMode === "approval" ? "pending" : "not_required",
      qualityScore: quality.total,
      qualityJson: quality,
      estimatedCostUsd: estimateItemCostUsd("B", concept)
    });
  }

  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true, jobId });
  }

  return NextResponse.redirect(new URL(`/jobs/${jobId}`, request.url));
}
