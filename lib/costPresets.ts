import type { CostPreset } from "@/types";

export type CostPresetConfig = {
  key: CostPreset;
  maxPerOutputUsd: number;
  maxBatchUsd: number;
  defaultProvider: "auto" | "openai" | "gemini";
};

const PRESETS: Record<CostPreset, CostPresetConfig> = {
  cheap: {
    key: "cheap",
    maxPerOutputUsd: 0.08,
    maxBatchUsd: 4,
    defaultProvider: "openai"
  },
  balanced: {
    key: "balanced",
    maxPerOutputUsd: 0.2,
    maxBatchUsd: 12,
    defaultProvider: "auto"
  },
  max_quality: {
    key: "max_quality",
    maxPerOutputUsd: 0.6,
    maxBatchUsd: 30,
    defaultProvider: "gemini"
  }
};

export function getCostPresetConfig(preset: CostPreset): CostPresetConfig {
  return PRESETS[preset];
}
