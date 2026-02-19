import crypto from "node:crypto";
import { put } from "@vercel/blob";
import {
  claimJobItems,
  getJobById,
  getVoiceProfileById,
  insertOutput,
  refreshJobStatus,
  releaseLock,
  setJobItemRemoteTask,
  setJobItemStatus,
  tryAcquireLock
} from "@/lib/db";
import { createVideoTaskForItem, getVideoTaskForItem } from "@/lib/videoProvider";
import { isRenderAEnabled } from "@/lib/env";
import { synthesizeVoiceover } from "@/lib/elevenlabs";
import { estimateVoiceoverCostUsd } from "@/lib/costs";

async function saveJsonOutput(key: string, data: Record<string, unknown>): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const payload = Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64");
    return `data:application/json;base64,${payload}`;
  }

  const response = await put(key, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json"
  });
  return response.url;
}

export async function runMainWorker(): Promise<{
  ok: boolean;
  processed: number;
  errors: string[];
}> {
  const lockKey = "main-worker";
  const hasLock = await tryAcquireLock(lockKey);
  if (!hasLock) {
    return { ok: true, processed: 0, errors: ["Worker already running"] };
  }

  const errors: string[] = [];
  let processed = 0;

  try {
    const items = await claimJobItems(10);

    for (const item of items) {
      try {
        if (item.mode === "A") {
          const qualityScore =
            typeof item.quality_score === "number" ? item.quality_score : Number(item.quality_score ?? 0);
          const estimatedCostUsd = Number(item.estimated_cost_usd ?? 0);

          const outputUrl = await saveJsonOutput(
            `jobs/${item.job_id}/a-editpack-${item.id}.json`,
            item.concept_json
          );

          await insertOutput({
            id: crypto.randomUUID(),
            jobItemId: item.id,
            type: "A_EDITPACK",
            blobUrl: outputUrl,
            metaJson: {
              source: "worker",
              qualityScore: Number.isFinite(qualityScore) ? qualityScore : null,
              estimatedCostUsd: Number.isFinite(estimatedCostUsd) ? estimatedCostUsd : null
            }
          });

          const job = await getJobById(item.job_id);
          if (job?.voice_profile_id) {
            const profile = await getVoiceProfileById(job.voice_profile_id);
            if (profile) {
              const voiceText = String(
                item.concept_json.hook ??
                  "Here is your high-retention short-form script draft ready for your own footage."
              );
              const voiceover = await synthesizeVoiceover({
                voiceId: profile.external_voice_id,
                text: voiceText,
                outputKey: `jobs/${item.job_id}/a-voiceover-${item.id}.mp3`
              });

              if (voiceover.ok) {
                await insertOutput({
                  id: crypto.randomUUID(),
                  jobItemId: item.id,
                  type: "A_VOICEOVER_MP3",
                  blobUrl: voiceover.url,
                  metaJson: {
                    source: "elevenlabs",
                    voiceProfileId: profile.id,
                    estimatedCostUsd: estimateVoiceoverCostUsd(voiceText)
                  }
                });
              } else {
                errors.push(`Voiceover failed for ${item.id}: ${voiceover.error}`);
              }
            }
          }

          await setJobItemStatus(item.id, "completed");
          await refreshJobStatus(item.job_id);
          processed += 1;
          continue;
        }

        if (!item.remote_task_id) {
          const created = await createVideoTaskForItem(item);
          const qualityScore =
            typeof item.quality_score === "number" ? item.quality_score : Number(item.quality_score ?? 0);
          const estimatedCostUsd = Number(item.estimated_cost_usd ?? 0);

          if (created.status === "failed") {
            await setJobItemStatus(item.id, "failed", created.error ?? "Video task creation failed");
            await refreshJobStatus(item.job_id);
            errors.push(`B task create failed for ${item.id}: ${created.error ?? "unknown"}`);
            continue;
          }

          if (created.status === "completed" && created.outputUrl) {
            await insertOutput({
              id: crypto.randomUUID(),
              jobItemId: item.id,
              type: "B_MP4",
              blobUrl: created.outputUrl,
              metaJson: {
                source: created.provider,
                immediate: true,
                qualityScore: Number.isFinite(qualityScore) ? qualityScore : null,
                estimatedCostUsd: Number.isFinite(estimatedCostUsd) ? estimatedCostUsd : null
              }
            });
            await setJobItemStatus(item.id, "completed");
          } else {
            await setJobItemRemoteTask(item.id, created.taskId);
          }

          await refreshJobStatus(item.job_id);
          processed += 1;
          continue;
        }

        const polled = await getVideoTaskForItem(item.remote_task_id);
        const provider = item.remote_task_id.startsWith("gemini:") ? "gemini" : "openai";
        if (polled.status === "completed" && polled.outputUrl) {
          const qualityScore =
            typeof item.quality_score === "number" ? item.quality_score : Number(item.quality_score ?? 0);
          const estimatedCostUsd = Number(item.estimated_cost_usd ?? 0);
          await insertOutput({
            id: crypto.randomUUID(),
            jobItemId: item.id,
            type: "B_MP4",
            blobUrl: polled.outputUrl,
            metaJson: {
              source: provider,
              polled: true,
              qualityScore: Number.isFinite(qualityScore) ? qualityScore : null,
              estimatedCostUsd: Number.isFinite(estimatedCostUsd) ? estimatedCostUsd : null
            }
          });
          await setJobItemStatus(item.id, "completed");
        } else if (polled.status === "failed") {
          await setJobItemStatus(item.id, "failed", polled.error ?? "Video task failed");
          errors.push(`B task failed for ${item.id}: ${polled.error ?? "unknown"}`);
        }

        await refreshJobStatus(item.job_id);
        processed += 1;
      } catch (error) {
        await setJobItemStatus(
          item.id,
          "failed",
          error instanceof Error ? error.message : "Unknown worker error"
        );
        await refreshJobStatus(item.job_id);
        errors.push(`Processing failed for ${item.id}`);
      }
    }

    return { ok: errors.length === 0, processed, errors };
  } finally {
    await releaseLock(lockKey);
  }
}

export async function runRenderWorker(): Promise<{
  ok: boolean;
  rendered: number;
  skipped: boolean;
}> {
  if (!isRenderAEnabled()) {
    return { ok: true, rendered: 0, skipped: true };
  }

  return { ok: true, rendered: 0, skipped: false };
}
