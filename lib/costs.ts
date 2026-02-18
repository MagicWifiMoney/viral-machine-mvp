import type { JobItemMode } from "@/types";

function roundUsd(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function estimateItemCostUsd(mode: JobItemMode, concept: Record<string, unknown>): number {
  const hookLength = String(concept.hook ?? "").length;

  if (mode === "A") {
    const llmPlanning = 0.002 + hookLength * 0.00001;
    return roundUsd(llmPlanning);
  }

  const duration = Number(concept.durationSeconds ?? 10);
  const boundedSeconds = Math.min(Math.max(duration, 4), 12);
  const videoGen = boundedSeconds * 0.015;
  const promptPrep = 0.003 + hookLength * 0.00001;
  return roundUsd(videoGen + promptPrep);
}

export function estimateVoiceoverCostUsd(text: string): number {
  const chars = text.length;
  return roundUsd(0.00008 * chars + 0.0015);
}
