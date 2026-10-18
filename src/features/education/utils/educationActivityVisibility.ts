import { isEducationSkillVisible } from "./educationVisibility";

/** Legacy active/completed activities can refer to hidden tiers; don't leak their titles. */
export function visibleEducationActivities<T>(
  activities: readonly T[],
  skillForActivity: (activity: T) => string | null | undefined,
  access: ReadonlyMap<string, boolean>,
): T[] {
  return activities.filter((activity) => {
    const slug = skillForActivity(activity);
    return Boolean(slug) && isEducationSkillVisible(slug, access);
  });
}
