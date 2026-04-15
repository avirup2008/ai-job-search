/** Deterministic company avatar — hash name → warm HSL + first letter. */
export function companyAvatar(name: string): { bg: string; letter: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  // Warm, medium-saturation hues skewed away from pure red/green to avoid status-color clashes
  const hue = Math.abs(h) % 360;
  return {
    bg: `hsl(${hue}, 28%, 34%)`,
    letter: (name.trim()[0] ?? "?").toUpperCase(),
  };
}

export type MatchBand = "strong" | "medium" | "weak" | "none";

export function matchBand(score: number | null | undefined): MatchBand {
  if (score == null || !Number.isFinite(score)) return "none";
  if (score >= 80) return "strong";
  if (score >= 65) return "medium";
  if (score >= 40) return "weak";
  return "weak";
}

export function matchLabel(band: MatchBand): string {
  if (band === "strong") return "Strong match";
  if (band === "medium") return "Partial match";
  if (band === "weak") return "Light match";
  return "Not scored";
}
