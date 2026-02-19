type Candidate = {
  text: string;
  score: number;
  rationale: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTitle(title: string): number {
  let score = 45;
  if (/\d/.test(title)) score += 18;
  if (title.length <= 55) score += 12;
  if (title.toLowerCase().includes("how")) score += 8;
  if (title.includes("?")) score += 6;
  return clamp(score);
}

export function generateTitleCandidates(hook: string, cta: string): Candidate[] {
  const base = [
    `How to ${hook.toLowerCase()}`,
    `${hook} (without burning out)`,
    `Stop scrolling: ${hook}`,
    `${hook} | ${cta}`
  ];

  return base.map((text) => ({
    text,
    score: scoreTitle(text),
    rationale: "High-clarity short title with curiosity and direct value."
  }));
}

export function generateThumbnailPromptCandidates(hook: string): Candidate[] {
  const prompts = [
    `Vertical thumbnail, high contrast text "${hook}", creator pointing at chart, bright teal accents`,
    `Close-up face reaction with bold text "${hook}", clean background, red arrow annotation`,
    `Split-screen: problem on left, outcome on right, text overlay "${hook}"`
  ];

  return prompts.map((text, index) => ({
    text,
    score: clamp(70 - index * 6),
    rationale: "Readable mobile-first composition with a clear hook."
  }));
}
