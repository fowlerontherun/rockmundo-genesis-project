import type { SkillAvailability, SkillRoleKey, SkillRoleLink } from "@/utils/skillCatalogue";
import type { SkillTier } from "@/utils/skillFamilies";

export interface EducationLearningSkill {
  slug: string;
  name: string;
  tier: SkillTier;
  max_level: number;
  is_active: boolean;
  is_hidden: boolean;
  is_foundational: boolean;
}
import { isEducationSkillVisible } from "./educationVisibility";

export type LearningGoal = SkillRoleKey | "all";

export interface EducationProgressRecord {
  skill_slug: string;
  current_level: number | null;
  current_xp?: number | null;
  required_xp?: number | null;
}

export interface LearningRecommendation {
  slug: string;
  title: string;
  currentLevel: number;
  nextLevel: number | null;
  progressPercent: number;
  reason: string;
  matchedGoal: boolean;
  isNew: boolean;
}

/** Advisory rankings only. Eligibility and XP award rules remain server-authoritative. */
export function selectLearningRecommendations(args: {
  catalogue: EducationLearningSkill[];
  progress: EducationProgressRecord[];
  availability: SkillAvailability[];
  access: ReadonlyMap<string, boolean>;
  roleLinks: SkillRoleLink[];
  goal: LearningGoal;
  activeSkillSlugs?: ReadonlySet<string>;
  limit?: number;
}): LearningRecommendation[] {
  const records = new Map(args.progress.map((record) => [record.skill_slug, record]));
  const statuses = new Map(args.availability.map((entry) => [entry.slug, entry.status]));
  const active = args.activeSkillSlugs ?? new Set<string>();

  const goals: Partial<Record<SkillRoleKey, RegExp>> = {
    lead_guitarist: /(^|_)(guitar|guitars)(_|$)/i,
    rhythm_guitarist: /(^|_)(guitar|guitars)(_|$)/i,
    bassist: /(^|_)(bass|bass_guitar)(_|$)/i,
    drummer: /(^|_)(drums?|percussion)(_|$)/i,
    lead_vocalist: /(^|_)(singing|vocals?|vocal_performance)(_|$)/i,
    backing_vocalist: /(^|_)(singing|vocals?|vocal_performance)(_|$)/i,
    songwriter: /(^|_)(songwriting|lyrics?|composing|composition|arrangement)(_|$)/i,
    dj: /(^|_)(dj|mixing|beatmaking|sampling|remixing)(_|$)/i,
    producer: /(^|_)(production|mixing|mastering|daw|sound_design)(_|$)/i,
    sound_engineer: /(^|_)(sound_engineering|mixing|mastering|recording)(_|$)/i,
    live_frontperson: /(^|_)(showmanship|performance|crowd_interaction|stage_presence)(_|$)/i,
  };
  return args.catalogue
    .filter((skill) => skill.is_active && !skill.is_hidden && isEducationSkillVisible(skill.slug, args.access))
    .flatMap((skill) => {
      const record = records.get(skill.slug);
      const level = Math.max(0, Number(record?.current_level) || 0);
      const status = statuses.get(skill.slug);
      if (status === "hidden" || status === "inactive" || status === "prerequisites_missing") return [];
      // The deployed catalogue view is optional. A positive bulk tier-access result
      // can establish eligibility even where role-availability metadata is absent.
      if (level >= skill.max_level) return [];

      const currentXp = Math.max(0, Number(record?.current_xp) || 0);
      const requiredXp = Number(record?.required_xp) || 0;
      const progressPercent = requiredXp > 0 ? Math.max(0, Math.min(100, Math.round(currentXp / requiredXp * 100))) : 0;
      const explicitRole = args.goal !== "all" && args.roleLinks.some((link) => link.skill_slug === skill.slug && link.role_key === args.goal);
      const rolePattern = args.goal !== "all" ? goals[args.goal] : undefined;
      const matchedGoal = Boolean(explicitRole || rolePattern?.test(skill.slug));
      const isNew = level === 0;
      const learningAlready = active.has(skill.slug);
      const score = (matchedGoal ? 80 : 0)
        + (learningAlready ? 18 : 0)
        + (isNew ? 12 : 20)
        + (skill.is_foundational ? 8 : 0)
        + progressPercent / 4
        + (progressPercent >= 75 ? 12 : 0);
      const reason = learningAlready
        ? "Already studying this skill — keep the momentum going."
        : matchedGoal && isNew
          ? "Available to learn now and relevant to your selected role."
          : matchedGoal
            ? "Relevant to your selected role and progressing towards the next level."
            : isNew
              ? "A skill you can start learning now."
              : progressPercent >= 75
                ? "Close to your next level."
                : "An existing skill with room to grow.";
      return [{ score, slug: skill.slug, title: skill.name, currentLevel: level, nextLevel: level + 1, progressPercent, reason, matchedGoal, isNew }];
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.slug.localeCompare(b.slug))
    .slice(0, Math.max(0, args.limit ?? 4))
    .map(({ score: _score, ...recommendation }) => recommendation);
}
