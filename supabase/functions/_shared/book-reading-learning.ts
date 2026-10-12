export function calculateLearningMultiplier(skillSlug: string, attributes: Record<string, number> | null): number {
  if (!attributes) return 1;
  const mappings: Array<[string[], string]> = [
    [["instruments_", "guitar", "bass", "keyboard"], "musical_ability"],
    [["singing", "vocal", "rapping"], "vocal_talent"],
    [["drums", "percussion", "beatmaking"], "rhythm_sense"],
    [["songwriting_", "lyrics", "composing"], "creative_insight"],
    [["production", "mixing", "daw"], "technical_mastery"],
    [["stage_", "showmanship", "crowd"], "stage_presence"],
  ];
  let relevantAttribute = 0;
  const mapping = mappings.find(([patterns]) => patterns.some((pattern) => skillSlug.includes(pattern)));
  if (mapping) relevantAttribute = attributes[mapping[1]] ?? 0;
  else if (skillSlug.includes("genres_")) relevantAttribute = Math.max(attributes.musical_ability ?? 0, attributes.creative_insight ?? 0);
  const bounded = Number.isFinite(relevantAttribute) ? Math.max(0, Math.min(1000, relevantAttribute)) : 0;
  return 1 + (bounded / 1000) * 0.5;
}
