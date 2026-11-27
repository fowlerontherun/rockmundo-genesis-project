export type SkillState = { level: number; xp: number; required: number };
export type ProgressSnapshot = {
  total_xp: number;
  level: number;
  skills: Record<string, SkillState>;
  captured_at: string;
};

export type LoginProgressClaim =
  | { show: false }
  | {
      show: true;
      session_id: string;
      first_login: boolean;
      previous: ProgressSnapshot | null;
      current: ProgressSnapshot;
    };

export interface SkillChange {
  slug: string;
  previousLevel: number;
  currentLevel: number;
  xpGained: number;
  currentXp: number;
  requiredXp: number;
  percent: number;
}

const safe = (value: number | undefined) =>
  Math.max(0, typeof value === "number" && Number.isFinite(value) ? value : 0);

export function buildLoginProgressView(claim: Extract<LoginProgressClaim, { show: true }>) {
  const { current, previous } = claim;
  const changedSkills: SkillChange[] = Object.entries(current.skills ?? {}).map(([slug, state]) => {
    const old = previous?.skills?.[slug];
    const level = safe(state.level);
    const oldLevel = safe(old?.level);
    const xp = safe(state.xp);
    const required = safe(state.required);
    return {
      slug, previousLevel: oldLevel, currentLevel: level,
      xpGained: level === oldLevel ? Math.max(0, xp - safe(old?.xp)) : 0,
      currentXp: xp, requiredXp: required,
      percent: required > 0 ? Math.min(100, Math.round(xp / required * 100)) : 100,
    };
  });
  const improved = claim.first_login ? [] : changedSkills.filter(
    (skill) => skill.currentLevel > skill.previousLevel || skill.xpGained > 0,
  );
  improved.sort((a, b) =>
    (b.currentLevel - b.previousLevel) - (a.currentLevel - a.previousLevel)
    || b.xpGained - a.xpGained || a.slug.localeCompare(b.slug),
  );
  const strongest = changedSkills.filter((skill) => skill.currentLevel > 0 || skill.currentXp > 0)
    .sort((a, b) => b.currentLevel - a.currentLevel || b.currentXp - a.currentXp);
  const xpGained = !claim.first_login && previous
    ? Math.max(0, safe(current.total_xp) - safe(previous.total_xp)) : 0;
  const levelGained = !claim.first_login && previous
    ? Math.max(0, safe(current.level) - safe(previous.level)) : 0;
  return {
    xpGained, levelGained,
    currentTotalXp: safe(current.total_xp),
    currentLevel: safe(current.level),
    unlockedSkills: changedSkills.filter((skill) => skill.currentLevel > 0).length,
    skillsImproved: improved.length,
    featuredSkills: (improved.length ? improved : strongest).slice(0, 5),
    hasGains: xpGained > 0 || levelGained > 0 || improved.length > 0,
  };
}
