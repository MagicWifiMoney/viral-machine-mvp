export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial_failed"
  | "failed";

export type JobItemMode = "A" | "B";
export type WorkflowMode = "autonomous" | "approval";

export type JobItemStatus =
  | "queued"
  | "awaiting_approval"
  | "processing"
  | "awaiting_remote"
  | "completed"
  | "failed"
  | "skipped";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export type OutputType = "A_EDITPACK" | "A_MP4" | "B_MP4" | "A_VOICEOVER_MP3";
export type CostPreset = "cheap" | "balanced" | "max_quality";
export type TrendSource = "youtube_shorts";
export type RatingValue = "win" | "neutral" | "loss";
export type PublishChannel = "tiktok" | "instagram_reels";

export type AssetKind = "broll" | "proof" | "music";

export interface Job {
  id: string;
  status: JobStatus;
  requested_count: number;
  a_count: number;
  b_count: number;
  workflow_mode: WorkflowMode;
  voice_profile_id: string | null;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JobItem {
  id: string;
  job_id: string;
  mode: JobItemMode;
  status: JobItemStatus;
  concept_json: Record<string, unknown>;
  remote_task_id: string | null;
  approval_status: ApprovalStatus;
  approval_note: string | null;
  quality_score: number | null;
  quality_json: Record<string, unknown>;
  estimated_cost_usd: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Output {
  id: string;
  job_item_id: string;
  type: OutputType;
  blob_url: string;
  meta_json: Record<string, unknown>;
  created_at: string;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  category: string;
  blob_url: string;
  mime: string;
  active: boolean;
  created_at: string;
}

export interface ReferenceVideo {
  id: string;
  source_url: string;
  platform: string | null;
  extractor: string | null;
  title: string | null;
  author_name: string | null;
  notes: string | null;
  style_json: Record<string, unknown>;
  created_at: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  provider: "elevenlabs";
  external_voice_id: string;
  is_default: boolean;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TrendPattern {
  id: string;
  source: TrendSource;
  query: string;
  title: string;
  pattern_json: Record<string, unknown>;
  score: number;
  captured_at: string;
}

export interface BrandBrain {
  id: string;
  claims_json: string[];
  default_cta: string | null;
  tone: string | null;
  banned_words_json: string[];
  updated_at: string;
}

export interface OutputRating {
  id: string;
  output_id: string;
  rating: RatingValue;
  note: string | null;
  created_at: string;
}

export interface PublishQueueItem {
  id: string;
  output_id: string;
  channel: PublishChannel;
  scheduled_for: string;
  external_post_id: string | null;
  status: string;
  payload_json: Record<string, unknown>;
  error: string | null;
  created_at: string;
  updated_at: string;
}
