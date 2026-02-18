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

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL,
  category TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  mime TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outputs (
  id UUID PRIMARY KEY,
  job_item_id UUID NOT NULL REFERENCES job_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_items_status ON job_items(status);
CREATE INDEX IF NOT EXISTS idx_assets_kind_category ON assets(kind, category);
