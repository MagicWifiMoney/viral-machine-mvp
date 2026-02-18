import { sql } from "@vercel/postgres";
import type { Asset, Job, JobItem, JobItemMode, JobItemStatus } from "@/types";

export async function initDb(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY,
      status TEXT NOT NULL,
      requested_count INT NOT NULL,
      a_count INT NOT NULL,
      b_count INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS job_items (
      id UUID PRIMARY KEY,
      job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      concept_json JSONB NOT NULL,
      remote_task_id TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      mime TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS outputs (
      id UUID PRIMARY KEY,
      job_item_id UUID NOT NULL REFERENCES job_items(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS worker_locks (
      key TEXT PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_job_items_status ON job_items(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_kind_category ON assets(kind, category);`;
}

export async function createJob(
  job: Pick<Job, "id" | "status" | "requested_count" | "a_count" | "b_count">
): Promise<void> {
  await sql`
    INSERT INTO jobs (id, status, requested_count, a_count, b_count)
    VALUES (${job.id}, ${job.status}, ${job.requested_count}, ${job.a_count}, ${job.b_count});
  `;
}

export async function createJobItem(item: {
  id: string;
  jobId: string;
  mode: JobItemMode;
  status: JobItemStatus;
  conceptJson: Record<string, unknown>;
}): Promise<void> {
  await sql`
    INSERT INTO job_items (id, job_id, mode, status, concept_json)
    VALUES (${item.id}, ${item.jobId}, ${item.mode}, ${item.status}, ${JSON.stringify(item.conceptJson)}::jsonb);
  `;
}

export async function claimJobItems(limit = 5): Promise<JobItem[]> {
  const result = await sql<JobItem>`
    WITH to_claim AS (
      SELECT id
      FROM job_items
      WHERE status IN ('queued', 'awaiting_remote')
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE job_items ji
    SET status = CASE WHEN ji.status = 'queued' THEN 'processing' ELSE ji.status END,
        updated_at = NOW()
    FROM to_claim
    WHERE ji.id = to_claim.id
    RETURNING ji.*;
  `;

  return result.rows;
}

export async function setJobItemStatus(id: string, status: JobItemStatus, error?: string | null): Promise<void> {
  await sql`
    UPDATE job_items
    SET status = ${status},
        error = ${error ?? null},
        updated_at = NOW()
    WHERE id = ${id};
  `;
}

export async function setJobItemRemoteTask(id: string, taskId: string): Promise<void> {
  await sql`
    UPDATE job_items
    SET remote_task_id = ${taskId}, status = 'awaiting_remote', updated_at = NOW()
    WHERE id = ${id};
  `;
}

export async function insertOutput(args: {
  id: string;
  jobItemId: string;
  type: string;
  blobUrl: string;
  metaJson?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    INSERT INTO outputs (id, job_item_id, type, blob_url, meta_json)
    VALUES (
      ${args.id},
      ${args.jobItemId},
      ${args.type},
      ${args.blobUrl},
      ${JSON.stringify(args.metaJson ?? {})}::jsonb
    );
  `;
}

export async function getJobWithDetails(jobId: string): Promise<{
  job: Job | null;
  items: JobItem[];
  outputs: Array<{ job_item_id: string; type: string; blob_url: string }>;
}> {
  const [jobResult, itemResult, outputResult] = await Promise.all([
    sql<Job>`SELECT * FROM jobs WHERE id = ${jobId} LIMIT 1;`,
    sql<JobItem>`SELECT * FROM job_items WHERE job_id = ${jobId} ORDER BY created_at ASC;`,
    sql<{ job_item_id: string; type: string; blob_url: string }>`
      SELECT o.job_item_id, o.type, o.blob_url
      FROM outputs o
      INNER JOIN job_items ji ON ji.id = o.job_item_id
      WHERE ji.job_id = ${jobId}
      ORDER BY o.created_at ASC;
    `
  ]);

  return {
    job: jobResult.rows[0] ?? null,
    items: itemResult.rows,
    outputs: outputResult.rows
  };
}

export async function refreshJobStatus(jobId: string): Promise<void> {
  await sql`
    UPDATE jobs
    SET status = (
      CASE
        WHEN EXISTS (SELECT 1 FROM job_items WHERE job_id = ${jobId} AND status IN ('processing', 'queued', 'awaiting_remote')) THEN 'running'
        WHEN EXISTS (SELECT 1 FROM job_items WHERE job_id = ${jobId} AND status = 'failed')
             AND EXISTS (SELECT 1 FROM job_items WHERE job_id = ${jobId} AND status = 'completed') THEN 'partial_failed'
        WHEN EXISTS (SELECT 1 FROM job_items WHERE job_id = ${jobId} AND status = 'failed') THEN 'failed'
        ELSE 'completed'
      END
    ),
    updated_at = NOW()
    WHERE id = ${jobId};
  `;
}

export async function upsertAsset(asset: {
  id: string;
  kind: string;
  category: string;
  blobUrl: string;
  mime: string;
}): Promise<void> {
  await sql`
    INSERT INTO assets (id, kind, category, blob_url, mime, active)
    VALUES (${asset.id}, ${asset.kind}, ${asset.category}, ${asset.blobUrl}, ${asset.mime}, TRUE);
  `;
}

export async function listAssets(): Promise<Asset[]> {
  const result = await sql<Asset>`
    SELECT *
    FROM assets
    WHERE active = TRUE
    ORDER BY created_at DESC;
  `;

  return result.rows;
}

export async function tryAcquireLock(key: string): Promise<boolean> {
  const result = await sql<{ acquired: boolean }>`
    SELECT pg_try_advisory_lock(hashtext(${key})) AS acquired;
  `;
  return Boolean(result.rows[0]?.acquired);
}

export async function releaseLock(key: string): Promise<void> {
  await sql`SELECT pg_advisory_unlock(hashtext(${key}));`;
}
