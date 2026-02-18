import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { getOptionalEnv } from "@/lib/env";

type CreateVideoTaskInput = {
  prompt: string;
  seconds?: number;
};

type CreateVideoTaskResult = {
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string;
  error?: string;
};

type VideoTaskStatus = {
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string;
  error?: string;
};

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function headers(): HeadersInit {
  const apiKey = getOptionalEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return {
    Authorization: `Bearer ${apiKey}`
  };
}

function model(): string {
  return getOptionalEnv("OPENAI_VIDEO_MODEL") ?? "sora-2";
}

function normalizeSeconds(value?: number): 4 | 8 | 12 {
  if (value === 4 || value === 8 || value === 12) {
    return value;
  }

  if (typeof value === "number") {
    if (value <= 6) {
      return 4;
    }
    if (value <= 10) {
      return 8;
    }
    return 12;
  }

  return 8;
}

export async function createVideoTask(
  input: CreateVideoTaskInput
): Promise<CreateVideoTaskResult> {
  try {
    const form = new FormData();
    form.append("model", model());
    form.append("prompt", input.prompt);
    form.append("seconds", String(normalizeSeconds(input.seconds)));
    form.append("size", "720x1280");

    const response = await fetch(`${OPENAI_BASE_URL}/videos`, {
      method: "POST",
      headers: headers(),
      body: form
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return {
        taskId: `failed_${crypto.randomUUID()}`,
        status: "failed",
        error: formatApiError(data, `OpenAI request failed (${response.status})`)
      };
    }

    return {
      taskId: String(data.id ?? data.task_id ?? crypto.randomUUID()),
      status: mapStatus(data.status),
      outputUrl: extractOutputUrl(data)
    };
  } catch (error) {
    return {
      taskId: `failed_${crypto.randomUUID()}`,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown OpenAI error"
    };
  }
}

export async function getVideoTask(taskId: string): Promise<VideoTaskStatus> {
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/videos/${taskId}`, {
      method: "GET",
      headers: headers()
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return {
        status: "failed",
        error: formatApiError(data, `OpenAI task fetch failed (${response.status})`)
      };
    }

    const status = mapStatus(data.status);
    let outputUrl = extractOutputUrl(data);

    // Some responses require fetching binary content separately.
    if (status === "completed" && !outputUrl) {
      outputUrl = await resolveVideoContentUrl(taskId);
    }

    return {
      status,
      outputUrl
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown task status error"
    };
  }
}

function mapStatus(status: unknown): "queued" | "processing" | "completed" | "failed" {
  if (status === "completed" || status === "succeeded") {
    return "completed";
  }

  if (status === "processing" || status === "running" || status === "in_progress") {
    return "processing";
  }

  if (status === "failed" || status === "error" || status === "cancelled") {
    return "failed";
  }

  return "queued";
}

function extractOutputUrl(data: Record<string, unknown>): string | undefined {
  if (typeof data.output_url === "string") {
    return data.output_url;
  }

  if (typeof data.url === "string") {
    return data.url;
  }

  if (typeof data.content_url === "string") {
    return data.content_url;
  }

  const result = data.result as Record<string, unknown> | undefined;
  if (result && typeof result.url === "string") {
    return result.url;
  }

  return undefined;
}

function formatApiError(data: Record<string, unknown>, fallback: string): string {
  const error = data.error as Record<string, unknown> | string | undefined;
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error.message === "string") {
    const code = typeof error.code === "string" ? ` (${error.code})` : "";
    return `${error.message}${code}`;
  }

  return JSON.stringify(error);
}

async function resolveVideoContentUrl(taskId: string): Promise<string | undefined> {
  const contentUrl = `${OPENAI_BASE_URL}/videos/${taskId}/content`;
  const response = await fetch(contentUrl, {
    method: "GET",
    headers: headers()
  });

  if (!response.ok) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "video/mp4";
  const bytes = Buffer.from(await response.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const uploaded = await put(`jobs/b-videos/${taskId}.mp4`, bytes, {
      access: "public",
      contentType
    });
    return uploaded.url;
  }

  // Keep fallback bounded if Blob is unavailable.
  if (bytes.length <= 2_000_000) {
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  }

  return contentUrl;
}
