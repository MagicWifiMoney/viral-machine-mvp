import type { JobItemMode } from "@/types";

export function generateConcept(index: number, mode: JobItemMode): Record<string, unknown> {
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
      overlays: ["subtitle", "stat-callout", "arrow-annotation"]
    };
  }

  return {
    hook,
    mode,
    format: "prompt_to_video",
    style: "fast-cut UGC",
    durationSeconds: 10,
    camera: "handheld vertical",
    cta: "Comment \"BLUEPRINT\""
  };
}
