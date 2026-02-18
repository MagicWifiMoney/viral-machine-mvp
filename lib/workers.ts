import crypto from "node:crypto";
import { put } from "@vercel/blob";
import {
  claimJobItems,
  insertOutput,
  refreshJobStatus,
  releaseLock,
  setJobItemRemoteTask,
  setJobItemStatus,
  tryAcquireLock
} from "@/lib/db";
import { createVideoTask, getVideoTask } from "@/lib/openaiVideo";
import { isRenderAEnabled } from "@/lib/env";

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
          const outputUrl = await saveJsonOutput(
            `jobs/${item.job_id}/a-editpack-${item.id}.json`,
            item.concept_json
          );

          await insertOutput({
            id: crypto.randomUUID(),
            jobItemId: item.id,
            type: "A_EDITPACK",
            blobUrl: outputUrl,
            metaJson: { source: "worker" }
          });

          await setJobItemStatus(item.id, "completed");
          await refreshJobStatus(item.job_id);
          processed += 1;
          continue;
        }

        if (!item.remote_task_id) {
          const prompt = String(item.concept_json.hook ?? "Create a viral short-form business video");
          const created = await createVideoTask({ prompt, seconds: 10 });

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
              metaJson: { source: "openai", immediate: true }
            });
            await setJobItemStatus(item.id, "completed");
          } else {
            await setJobItemRemoteTask(item.id, created.taskId);
          }

          await refreshJobStatus(item.job_id);
          processed += 1;
          continue;
        }

        const polled = await getVideoTask(item.remote_task_id);
        if (polled.status === "completed" && polled.outputUrl) {
          await insertOutput({
            id: crypto.randomUUID(),
            jobItemId: item.id,
            type: "B_MP4",
            blobUrl: polled.outputUrl,
            metaJson: { source: "openai", polled: true }
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
