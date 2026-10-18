/** Player-facing labels used across the skill-first education experience. */
export function formatEducationSkillName(slug?: string | null): string {
  if (!slug) return "General learning";
  return slug
    .replace(/^(instruments_|genres_)/, "")
    .replace(/^(basic_|professional_|mastery_)/, "")
    .replace(/_(basic|professional|mastery)_/g, "_")
    .replace(/_(mastery|professional)$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function percentComplete(completed: number | null | undefined, target: number | null | undefined): number {
  if (!Number.isFinite(completed) || !Number.isFinite(target) || Number(target) <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(completed) / Number(target)) * 100)));
}
