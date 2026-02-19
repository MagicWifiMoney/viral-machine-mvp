import type { JobItemMode } from "@/types";

type ReferenceContext = {
  sourceUrl?: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  platform?: string;
  styleProfile?: Record<string, unknown>;
};

type BrandContext = {
  claims?: string[];
  defaultCta?: string | null;
  tone?: string | null;
  bannedWords?: string[];
};

type TrendContext = {
  title?: string;
  hookStyle?: string;
};

type LearningContext = {
  winnerCount?: number;
  loserCount?: number;
};

type GenerationOptions = {
  variantIndex?: number;
  variantCount?: number;
  brand?: BrandContext;
  trend?: TrendContext | null;
  learning?: LearningContext;
};

export function generateConcept(
  index: number,
  mode: JobItemMode,
  reference?: ReferenceContext,
  options?: GenerationOptions
): Record<string, unknown> {
  const baseHooks = [
    "POV: your side hustle just outran your 9-5",
    "3 moves that instantly lift retention",
    "Why your edits feel slow (fix in 30s)",
    "The $0 workflow that fakes a production team",
    "This one framing tweak doubles watch time"
  ];
  const variantIndex = options?.variantIndex ?? 0;
  const variantCount = options?.variantCount ?? 1;
  const hooks = [...baseHooks];
  if (options?.trend?.title) {
    hooks.unshift(`Trend remix: ${options.trend.title}`);
  }
  if ((options?.learning?.winnerCount ?? 0) > (options?.learning?.loserCount ?? 0)) {
    hooks.unshift("Use this proven hook framework before you post");
  }

  const hook = hooks[(index + variantIndex) % hooks.length];
  const cta = options?.brand?.defaultCta ?? "Comment \"BLUEPRINT\"";
  const tone = options?.brand?.tone ?? "direct";
  const claim =
    options?.brand?.claims && options.brand.claims.length > 0
      ? options.brand.claims[(index + variantIndex) % options.brand.claims.length]
      : null;

  if (mode === "A") {
    return {
      hook,
      mode,
      format: "editpack",
      structure: ["hook", "problem", "proof", "cta"],
      durationSeconds: 28,
      overlays: ["subtitle", "stat-callout", "arrow-annotation"],
      inspiration: reference ?? null,
      variantIndex,
      variantCount,
      tone,
      claim,
      cta,
      trend: options?.trend ?? null
    };
  }

  return {
    hook,
    mode,
    format: "prompt_to_video",
    style: "fast-cut UGC inspired by reference",
    durationSeconds: 10,
    camera: "handheld vertical",
    cta,
    inspiration: reference ?? null,
    variantIndex,
    variantCount,
    tone,
    claim,
    trend: options?.trend ?? null
  };
}
