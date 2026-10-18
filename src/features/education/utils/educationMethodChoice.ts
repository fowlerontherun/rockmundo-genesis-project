export const EDUCATION_METHODS = ["books", "university", "videos", "mentors", "players"] as const;
export type EducationMethod = typeof EDUCATION_METHODS[number];
export type EducationMethodCounts = Partial<Record<Exclude<EducationMethod, "players">, number | null>>;

/** Explicit bookmarks and player choices win. Only auto-pick when a skill is selected. */
export function chooseEducationMethod(
  requested: string | null,
  skillFocused: boolean,
  counts?: EducationMethodCounts | null,
): EducationMethod {
  if (requested && EDUCATION_METHODS.some((method) => method === requested)) {
    return requested as EducationMethod;
  }
  if (!skillFocused || !counts) return "books";
  for (const method of ["videos", "books", "university", "mentors"] as const) {
    if ((counts[method] ?? 0) > 0) return method;
  }
  return "books";
}

/** Unknown provider responses must not be mistaken for zero available resources. */
export function hasNoListedEducationResources(counts?: EducationMethodCounts | null): boolean {
  if (!counts) return false;
  return (["books", "university", "videos", "mentors"] as const).every((method) => counts[method] === 0);
}
