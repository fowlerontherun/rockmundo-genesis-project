export type SuitabilityInput = {
  requiredSkills?: Record<string, number>;
  preferredSkills?: Record<string, number>;
  playerSkills?: Record<string, number>;
  sameLocation?: boolean;
  hasFullTimeConflict?: boolean;
  fame?: number;
};

export function calculateCompanyJobSuitability(input: SuitabilityInput) {
  let score = 50;
  const reasons: string[] = [];
  const missingRequirements: string[] = [];
  const required = input.requiredSkills ?? {};
  const preferred = input.preferredSkills ?? {};
  const skills = input.playerSkills ?? {};

  for (const [skill, level] of Object.entries(required)) {
    const actual = skills[skill] ?? 0;
    if (actual >= level) {
      score += 8;
      reasons.push(`Meets required ${skill}`);
    } else {
      score -= 12;
      missingRequirements.push(`${skill} ${level}+`);
    }
  }

  for (const [skill, level] of Object.entries(preferred)) {
    const actual = skills[skill] ?? 0;
    if (actual >= level) {
      score += 4;
      reasons.push(`Matches preferred ${skill}`);
    }
  }

  if (input.sameLocation) {
    score += 10;
    reasons.push("Already in the company location");
  } else {
    score -= 10;
    reasons.push("Would need to travel or relocate");
  }

  if (input.hasFullTimeConflict) {
    score -= 30;
    missingRequirements.push("No conflicting full-time employment");
  }

  score += Math.min(10, Math.floor((input.fame ?? 0) / 100));
  score = Math.max(0, Math.min(100, score));

  const rating = score >= 85 ? "Excellent match" : score >= 70 ? "Good match" : score >= 45 ? "Partial match" : "Poor match";
  return { score, rating, reasons, missingRequirements };
}
