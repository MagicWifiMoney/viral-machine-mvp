import type { JobItem } from "@/types";
import { getVideoProvider } from "@/lib/env";
import { createVideoTask, getVideoTask } from "@/lib/openaiVideo";
import { createGeminiVideoTask, getGeminiVideoTask } from "@/lib/geminiVideo";

type CreateResult = {
  provider: "openai" | "gemini";
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string;
  error?: string;
};

type PollResult = {
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string;
  error?: string;
};

function pickProviderFromItem(item: JobItem): "openai" | "gemini" {
  const requested = String(item.concept_json.videoProvider ?? "").toLowerCase();
  if (requested === "gemini") {
    return "gemini";
  }
  if (requested === "openai") {
    return "openai";
  }

  const configured = getVideoProvider();
  if (configured === "gemini") {
    return "gemini";
  }
  if (configured === "auto") {
    return process.env.GEMINI_API_KEY ? "gemini" : "openai";
  }
  return "openai";
}

export async function createVideoTaskForItem(item: JobItem): Promise<CreateResult> {
  const provider = pickProviderFromItem(item);
  const prompt = String(item.concept_json.hook ?? "Create a viral short-form business video");

  if (provider === "gemini") {
    const created = await createGeminiVideoTask({ prompt, seconds: 8 });
    return {
      provider,
      ...created,
      taskId: created.taskId.startsWith("operations/") ? `gemini:${created.taskId}` : `gemini:${created.taskId}`
    };
  }

  const created = await createVideoTask({ prompt, seconds: 10 });
  return {
    provider,
    ...created,
    taskId: created.taskId.startsWith("openai:") ? created.taskId : `openai:${created.taskId}`
  };
}

export async function getVideoTaskForItem(taskId: string): Promise<PollResult> {
  const [prefix, raw] = taskId.includes(":") ? taskId.split(/:(.*)/s) : ["openai", taskId];

  if (prefix === "gemini") {
    return getGeminiVideoTask(raw);
  }

  return getVideoTask(raw);
}
