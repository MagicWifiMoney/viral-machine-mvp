export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial_failed"
  | "failed";

export type JobItemMode = "A" | "B";

export type JobItemStatus =
  | "queued"
  | "processing"
  | "awaiting_remote"
  | "completed"
  | "failed"
  | "skipped";

export type OutputType = "A_EDITPACK" | "A_MP4" | "B_MP4";

export type AssetKind = "broll" | "proof" | "music";

export interface Job {
  id: string;
  status: JobStatus;
  requested_count: number;
  a_count: number;
  b_count: number;
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
