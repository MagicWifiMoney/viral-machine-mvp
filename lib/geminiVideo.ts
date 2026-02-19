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

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function apiKey(): string {
  const key = getOptionalEnv("GEMINI_API_KEY");
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return key;
}

function model(): string {
  return getOptionalEnv("GEMINI_VIDEO_MODEL") ?? "veo-3.1-fast-generate-preview";
}

export async function createGeminiVideoTask(
  input: CreateVideoTaskInput
): Promise<CreateVideoTaskResult> {
  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${model()}:predictLongRunning?key=${apiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: input.prompt }],
          parameters: {
            aspectRatio: "9:16"
          }
        })
      }
    );

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      return {
        taskId: `failed_${Date.now()}`,
        status: "failed",
        error: JSON.stringify(data)
      };
    }

    const opName = String(data.name ?? "");
    if (!opName) {
      return {
        taskId: `failed_${Date.now()}`,
        status: "failed",
        error: "Gemini operation name missing"
      };
    }

    return {
      taskId: opName,
      status: "processing"
    };
  } catch (error) {
    return {
      taskId: `failed_${Date.now()}`,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown Gemini error"
    };
  }
}

export async function getGeminiVideoTask(taskId: string): Promise<VideoTaskStatus> {
  try {
    const response = await fetch(`${GEMINI_BASE_URL}/${taskId}?key=${apiKey()}`, {
      method: "GET"
    });
    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return { status: "failed", error: JSON.stringify(data) };
    }

    const done = Boolean(data.done);
    const errorObj = data.error as Record<string, unknown> | undefined;
    if (errorObj) {
      return {
        status: "failed",
        error: typeof errorObj.message === "string" ? errorObj.message : JSON.stringify(errorObj)
      };
    }

    if (!done) {
      return { status: "processing" };
    }

    const videoUri = extractVideoUri(data);
    if (!videoUri) {
      return { status: "failed", error: "Gemini response did not include a video URI" };
    }

    const outputUrl = await downloadAndStoreVideo(videoUri, taskId);
    return { status: "completed", outputUrl };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown Gemini task error"
    };
  }
}

function extractVideoUri(data: Record<string, unknown>): string | null {
  const response = data.response as Record<string, unknown> | undefined;
  if (!response) {
    return null;
  }

  const generatedVideos = response.generatedVideos as Array<Record<string, unknown>> | undefined;
  const firstGenerated = generatedVideos?.[0];
  const firstGeneratedVideo = firstGenerated?.video as Record<string, unknown> | undefined;
  if (typeof firstGeneratedVideo?.uri === "string") {
    return firstGeneratedVideo.uri;
  }

  const generateVideoResponse = response.generateVideoResponse as
    | Record<string, unknown>
    | undefined;
  const samples = generateVideoResponse?.generatedSamples as Array<Record<string, unknown>> | undefined;
  const firstSample = samples?.[0];
  const firstSampleVideo = firstSample?.video as Record<string, unknown> | undefined;
  if (typeof firstSampleVideo?.uri === "string") {
    return firstSampleVideo.uri;
  }

  return null;
}

async function downloadAndStoreVideo(uri: string, taskId: string): Promise<string> {
  const response = await fetch(`${uri}&key=${apiKey()}`, {
    method: "GET",
    headers: {
      Accept: "video/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not download Gemini video (${response.status})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "video/mp4";

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const uploaded = await put(`jobs/b-videos/gemini-${taskId}.mp4`, bytes, {
      access: "public",
      contentType
    });
    return uploaded.url;
  }

  if (bytes.length <= 2_000_000) {
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  }

  return uri;
}
