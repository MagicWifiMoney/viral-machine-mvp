import type { JobItemMode } from "@/types";

type ReferenceContext = {
  sourceUrl?: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  styleProfile?: Record<string, unknown>;
};

export function generateConcept(
  index: number,
  mode: JobItemMode,
  reference?: ReferenceContext
): Record<string, unknown> {
  const hooks = [
    "POV: your side hustle just outran your 9-5",
    "3 moves that instantly lift retention",
    "Why your edits feel slow (fix in 30s)",
    "The $0 workflow that fakes a production team",
    "This one framing tweak doubles watch time"
  ];

  const hook = hooks[index % hooks.length];

  if (mode === "A") {
    return {
      hook,
      mode,
      format: "editpack",
      structure: ["hook", "problem", "proof", "cta"],
      durationSeconds: 28,
      overlays: ["subtitle", "stat-callout", "arrow-annotation"],
      inspiration: reference ?? null
    };
  }

  return {
    hook,
    mode,
    format: "prompt_to_video",
    style: "fast-cut UGC inspired by reference",
    durationSeconds: 10,
    camera: "handheld vertical",
    cta: "Comment \"BLUEPRINT\"",
    inspiration: reference ?? null
  };
}
