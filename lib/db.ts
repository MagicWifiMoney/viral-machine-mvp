import { sql } from "@vercel/postgres";
import type {
  ApprovalStatus,
  Asset,
  Job,
  JobItem,
  JobItemMode,
  JobItemStatus,
  ReferenceVideo,
  VoiceProfile,
  WorkflowMode
} from "@/types";

export async function initDb(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY,
      status TEXT NOT NULL,
      requested_count INT NOT NULL,
      a_count INT NOT NULL,
      b_count INT NOT NULL,
      workflow_mode TEXT NOT NULL DEFAULT 'autonomous',
      voice_profile_id UUID,
      settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
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
      approval_status TEXT NOT NULL DEFAULT 'not_required',
      approval_note TEXT,
      quality_score NUMERIC,
      quality_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      estimated_cost_usd NUMERIC,
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

  await sql`
    CREATE TABLE IF NOT EXISTS reference_videos (
      id UUID PRIMARY KEY,
      source_url TEXT NOT NULL,
      platform TEXT,
      extractor TEXT,
      title TEXT,
      author_name TEXT,
      notes TEXT,
      style_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS voice_profiles (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_voice_id TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_mode TEXT NOT NULL DEFAULT 'autonomous';`;
  await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS voice_profile_id UUID;`;
  await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS settings_json JSONB NOT NULL DEFAULT '{}'::jsonb;`;
  await sql`ALTER TABLE job_items ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'not_required';`;
  await sql`ALTER TABLE job_items ADD COLUMN IF NOT EXISTS approval_note TEXT;`;
  await sql`ALTER TABLE job_items ADD COLUMN IF NOT EXISTS quality_score NUMERIC;`;
  await sql`ALTER TABLE job_items ADD COLUMN IF NOT EXISTS quality_json JSONB NOT NULL DEFAULT '{}'::jsonb;`;
  await sql`ALTER TABLE job_items ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC;`;
  await sql`ALTER TABLE reference_videos ADD COLUMN IF NOT EXISTS platform TEXT;`;
  await sql`ALTER TABLE reference_videos ADD COLUMN IF NOT EXISTS extractor TEXT;`;

  await sql`CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_job_items_status ON job_items(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_kind_category ON assets(kind, category);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_voice_profiles_default ON voice_profiles(is_default);`;
}

export async function createJob(
  job: Pick<Job, "id" | "status" | "requested_count" | "a_count" | "b_count"> & {
    workflow_mode?: WorkflowMode;
    voice_profile_id?: string | null;
    settings_json?: Record<string, unknown>;
  }
): Promise<void> {
  await sql`
    INSERT INTO jobs (id, status, requested_count, a_count, b_count, workflow_mode, voice_profile_id, settings_json)
    VALUES (
      ${job.id},
      ${job.status},
      ${job.requested_count},
      ${job.a_count},
      ${job.b_count},
      ${job.workflow_mode ?? "autonomous"},
      ${job.voice_profile_id ?? null},
      ${JSON.stringify(job.settings_json ?? {})}::jsonb
    );
  `;
}

export async function createJobItem(item: {
  id: string;
  jobId: string;
  mode: JobItemMode;
  status: JobItemStatus;
  conceptJson: Record<string, unknown>;
  approvalStatus?: ApprovalStatus;
  qualityScore?: number | null;
  qualityJson?: Record<string, unknown>;
  estimatedCostUsd?: number | null;
}): Promise<void> {
  await sql`
    INSERT INTO job_items (
      id,
      job_id,
      mode,
      status,
      concept_json,
      approval_status,
      quality_score,
      quality_json,
      estimated_cost_usd
    )
    VALUES (
      ${item.id},
      ${item.jobId},
      ${item.mode},
      ${item.status},
      ${JSON.stringify(item.conceptJson)}::jsonb,
      ${item.approvalStatus ?? "not_required"},
      ${item.qualityScore ?? null},
      ${JSON.stringify(item.qualityJson ?? {})}::jsonb,
      ${item.estimatedCostUsd ?? null}
    );
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
  outputs: Array<{
    job_item_id: string;
    type: string;
    blob_url: string;
    meta_json: Record<string, unknown>;
  }>;
}> {
  const [jobResult, itemResult, outputResult] = await Promise.all([
    sql<Job>`SELECT * FROM jobs WHERE id = ${jobId} LIMIT 1;`,
    sql<JobItem>`SELECT * FROM job_items WHERE job_id = ${jobId} ORDER BY created_at ASC;`,
    sql<{ job_item_id: string; type: string; blob_url: string; meta_json: Record<string, unknown> }>`
      SELECT o.job_item_id, o.type, o.blob_url, o.meta_json
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

export async function getJobById(jobId: string): Promise<Job | null> {
  const result = await sql<Job>`
    SELECT *
    FROM jobs
    WHERE id = ${jobId}
    LIMIT 1;
  `;
  return result.rows[0] ?? null;
}

export async function refreshJobStatus(jobId: string): Promise<void> {
  await sql`
    UPDATE jobs
    SET status = (
      CASE
        WHEN EXISTS (SELECT 1 FROM job_items WHERE job_id = ${jobId} AND status IN ('processing', 'queued', 'awaiting_remote')) THEN 'running'
        WHEN EXISTS (SELECT 1 FROM job_items WHERE job_id = ${jobId} AND status = 'awaiting_approval') THEN 'running'
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

export async function createReferenceVideo(input: {
  id: string;
  sourceUrl: string;
  platform?: string | null;
  extractor?: string | null;
  title?: string | null;
  authorName?: string | null;
  notes?: string | null;
  styleJson?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    INSERT INTO reference_videos (id, source_url, platform, extractor, title, author_name, notes, style_json)
    VALUES (
      ${input.id},
      ${input.sourceUrl},
      ${input.platform ?? null},
      ${input.extractor ?? null},
      ${input.title ?? null},
      ${input.authorName ?? null},
      ${input.notes ?? null},
      ${JSON.stringify(input.styleJson ?? {})}::jsonb
    );
  `;
}

export async function getLatestReferenceVideo(): Promise<ReferenceVideo | null> {
  const result = await sql<ReferenceVideo>`
    SELECT *
    FROM reference_videos
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  return result.rows[0] ?? null;
}

export async function setJobItemApproval(args: {
  jobItemId: string;
  status: ApprovalStatus;
  itemStatus: JobItemStatus;
  note?: string | null;
}): Promise<void> {
  await sql`
    UPDATE job_items
    SET approval_status = ${args.status},
        status = ${args.itemStatus},
        approval_note = ${args.note ?? null},
        updated_at = NOW()
    WHERE id = ${args.jobItemId};
  `;
}

export async function listVoiceProfiles(): Promise<VoiceProfile[]> {
  const result = await sql<VoiceProfile>`
    SELECT *
    FROM voice_profiles
    ORDER BY is_default DESC, created_at DESC;
  `;
  return result.rows;
}

export async function createVoiceProfile(input: {
  id: string;
  name: string;
  provider: "elevenlabs";
  externalVoiceId: string;
  isDefault?: boolean;
  settingsJson?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    INSERT INTO voice_profiles (id, name, provider, external_voice_id, is_default, settings_json)
    VALUES (
      ${input.id},
      ${input.name},
      ${input.provider},
      ${input.externalVoiceId},
      ${Boolean(input.isDefault)},
      ${JSON.stringify(input.settingsJson ?? {})}::jsonb
    );
  `;
}

export async function updateVoiceProfile(input: {
  id: string;
  name?: string;
  externalVoiceId?: string;
  isDefault?: boolean;
  settingsJson?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    UPDATE voice_profiles
    SET name = COALESCE(${input.name ?? null}, name),
        external_voice_id = COALESCE(${input.externalVoiceId ?? null}, external_voice_id),
        is_default = COALESCE(${input.isDefault ?? null}, is_default),
        settings_json = CASE
          WHEN ${input.settingsJson ? 1 : 0} = 1 THEN ${JSON.stringify(input.settingsJson ?? {})}::jsonb
          ELSE settings_json
        END,
        updated_at = NOW()
    WHERE id = ${input.id};
  `;
}

export async function clearVoiceProfileDefaults(): Promise<void> {
  await sql`UPDATE voice_profiles SET is_default = FALSE WHERE is_default = TRUE;`;
}

export async function getVoiceProfileById(id: string): Promise<VoiceProfile | null> {
  const result = await sql<VoiceProfile>`
    SELECT *
    FROM voice_profiles
    WHERE id = ${id}
    LIMIT 1;
  `;
  return result.rows[0] ?? null;
}

export async function getDefaultVoiceProfile(): Promise<VoiceProfile | null> {
  const result = await sql<VoiceProfile>`
    SELECT *
    FROM voice_profiles
    WHERE is_default = TRUE
    ORDER BY updated_at DESC
    LIMIT 1;
  `;
  return result.rows[0] ?? null;
}

export async function getAppSetting<T>(key: string): Promise<T | null> {
  const result = await sql<{ value_json: T }>`
    SELECT value_json
    FROM app_settings
    WHERE key = ${key}
    LIMIT 1;
  `;
  return result.rows[0]?.value_json ?? null;
}

export async function setAppSetting(key: string, value: Record<string, unknown>): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value_json, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW();
  `;
}
