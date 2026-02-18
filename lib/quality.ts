export type QualityBreakdown = {
  hook: number;
  clarity: number;
  proof: number;
  cta: number;
  visualFit: number;
  total: number;
};

function scoreRange(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreConcept(concept: Record<string, unknown>): QualityBreakdown {
  const hookText = String(concept.hook ?? "");
  const overlays = Array.isArray(concept.overlays) ? concept.overlays : [];
  const structure = Array.isArray(concept.structure) ? concept.structure : [];
  const cta = String(concept.cta ?? "");
  const inspiration = concept.inspiration as Record<string, unknown> | null | undefined;

  const hook = scoreRange(45 + Math.min(hookText.length, 80) * 0.6);
  const clarity = scoreRange(40 + structure.length * 12 + overlays.length * 5);
  const proof = scoreRange(
    35 +
      (hookText.toLowerCase().includes("$") ? 15 : 0) +
      (hookText.toLowerCase().includes("proof") ? 20 : 0)
  );
  const ctaScore = scoreRange(35 + Math.min(cta.length, 40) * 1.2);
  const visualFit = scoreRange(50 + (inspiration?.styleProfile ? 18 : 0));

  const total = scoreRange((hook + clarity + proof + ctaScore + visualFit) / 5);

  return {
    hook,
    clarity,
    proof,
    cta: ctaScore,
    visualFit,
    total
  };
}
