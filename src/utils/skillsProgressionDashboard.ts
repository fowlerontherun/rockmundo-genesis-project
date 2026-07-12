import type { CanonicalSkill, SkillAttributeLink, SkillAvailability, SkillPrerequisite, SkillRoleKey, SkillRoleLink, SkillSystemLink, SkillUnlockRoute } from "./skillCatalogue";
import type { SkillDisplayProgress } from "./skillProgressDisplay";
import { getSkillDisplayProgress } from "./skillProgressDisplay";

export type ReadinessBand = "Beginner" | "Developing" | "Competent" | "Strong" | "Advanced" | "Elite";
export type SkillSortKey = "recommended" | "level" | "closest" | "recent" | "alphabetical" | "role" | "system" | "unlock" | "lowestGap" | "highestGap";
export type LockFilter = "all" | "unlocked" | "locked" | "trainable" | "available" | "favourite" | "maxed";

export interface SkillDashboardRow {
  catalogue: CanonicalSkill;
  progress: SkillDisplayProgress;
  availability?: SkillAvailability;
  roleLinks: SkillRoleLink[];
  systemLinks: SkillSystemLink[];
  attributeLinks: SkillAttributeLink[];
  prerequisites: SkillPrerequisite[];
  unlockRoutes: SkillUnlockRoute[];
  isFavourite: boolean;
  roleScore: number;
  recommendationScore: number;
  gap: number;
}

export interface SkillFilters {
  search?: string;
  category?: string;
  subcategory?: string;
  role?: SkillRoleKey | "all";
  system?: string;
  lock?: LockFilter;
  sort?: SkillSortKey;
}

export interface RoleReadinessSummary {
  role: SkillRoleKey;
  score: number;
  band: ReadinessBand;
  foundationSkills: SkillDashboardRow[];
  specialistSkills: SkillDashboardRow[];
  strengths: SkillDashboardRow[];
  gaps: SkillDashboardRow[];
  blocked: SkillDashboardRow[];
  usefulAttributes: string[];
  impact: string[];
}

const bandForScore = (score: number): ReadinessBand => {
  if (score >= 85) return "Elite";
  if (score >= 70) return "Advanced";
  if (score >= 55) return "Strong";
  if (score >= 35) return "Competent";
  if (score >= 15) return "Developing";
  return "Beginner";
};

const stable = (a: SkillDashboardRow, b: SkillDashboardRow) => a.catalogue.display_order - b.catalogue.display_order || a.catalogue.name.localeCompare(b.catalogue.name);

export function buildSkillDashboardRows(args: {
  catalogue: CanonicalSkill[];
  progress: Array<Record<string, unknown>>;
  availability: SkillAvailability[];
  roleLinks: SkillRoleLink[];
  systemLinks: SkillSystemLink[];
  attributeLinks: SkillAttributeLink[];
  prerequisites: SkillPrerequisite[];
  unlockRoutes: SkillUnlockRoute[];
  favourites?: string[];
  selectedRole?: SkillRoleKey | "all" | null;
}): SkillDashboardRow[] {
  const progressBySlug = new Map(args.progress.map((p) => [String(p.skill_slug ?? p.slug), getSkillDisplayProgress(p)]));
  const availabilityBySlug = new Map(args.availability.map((a) => [a.slug, a]));
  const favourites = new Set(args.favourites ?? []);
  return args.catalogue
    .filter((skill) => skill.is_active && !skill.is_hidden)
    .map((skill) => {
      const progress = progressBySlug.get(skill.slug) ?? getSkillDisplayProgress({ current_level: 0, xp_into_level: 0, xp_required_for_next_level: 100, is_unlocked: false });
      const roleLinks = args.roleLinks.filter((l) => l.skill_slug === skill.slug);
      const selectedRoleLink = args.selectedRole && args.selectedRole !== "all" ? roleLinks.find((l) => l.role_key === args.selectedRole) : undefined;
      const roleScore = selectedRoleLink ? selectedRoleLink.weight * (selectedRoleLink.relevance === "primary" ? 3 : selectedRoleLink.relevance === "secondary" ? 2 : 1) : Math.max(0, ...roleLinks.map((l) => l.weight));
      const target = selectedRoleLink?.minimum_recommended_level ?? (skill.is_foundational ? 3 : 1);
      const gap = Math.max(0, target - progress.current_level);
      const availability = availabilityBySlug.get(skill.slug);
      const closeBonus = progress.xp_required_for_next_level ? progress.progress_percent / 20 : 0;
      const unlockBonus = availability?.status === "available_to_unlock" ? 8 : 0;
      const recommendationScore = roleScore * 10 + gap * 4 + closeBonus + unlockBonus + (progress.can_practice ? 3 : 0);
      return {
        catalogue: skill,
        progress,
        availability,
        roleLinks,
        systemLinks: args.systemLinks.filter((l) => l.skill_slug === skill.slug),
        attributeLinks: args.attributeLinks.filter((l) => l.skill_slug === skill.slug),
        prerequisites: args.prerequisites.filter((p) => p.skill_slug === skill.slug && p.prerequisite_type !== "hidden_unlock"),
        unlockRoutes: args.unlockRoutes.filter((r) => r.skill_slug === skill.slug && r.is_active && r.route_type !== "hidden_discovery"),
        isFavourite: favourites.has(skill.slug),
        roleScore,
        recommendationScore,
        gap,
      };
    })
    .sort(stable);
}

export function filterAndSortSkillRows(rows: SkillDashboardRow[], filters: SkillFilters): SkillDashboardRow[] {
  const q = (filters.search ?? "").trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (q && ![row.catalogue.name, row.catalogue.description, row.catalogue.category, row.catalogue.subcategory ?? ""].join(" ").toLowerCase().includes(q)) return false;
    if (filters.category && filters.category !== "all" && row.catalogue.category !== filters.category) return false;
    if (filters.subcategory && filters.subcategory !== "all" && row.catalogue.subcategory !== filters.subcategory) return false;
    if (filters.role && filters.role !== "all" && !row.roleLinks.some((l) => l.role_key === filters.role)) return false;
    if (filters.system && filters.system !== "all" && !row.systemLinks.some((l) => l.system_key === filters.system)) return false;
    switch (filters.lock) {
      case "unlocked": return row.progress.is_unlocked;
      case "locked": return !row.progress.is_unlocked;
      case "trainable": return row.progress.can_practice;
      case "available": return row.availability?.status === "available_to_unlock";
      case "favourite": return row.isFavourite;
      case "maxed": return row.progress.is_max_level;
      default: return true;
    }
  });
  const sorted = [...filtered];
  const sort = filters.sort ?? "recommended";
  sorted.sort((a, b) => {
    const tie = stable(a, b);
    if (sort === "level") return b.progress.current_level - a.progress.current_level || tie;
    if (sort === "closest") return b.progress.progress_percent - a.progress.progress_percent || tie;
    if (sort === "alphabetical") return a.catalogue.name.localeCompare(b.catalogue.name) || tie;
    if (sort === "role") return b.roleScore - a.roleScore || tie;
    if (sort === "system") return b.systemLinks.length - a.systemLinks.length || tie;
    if (sort === "unlock") return (b.availability?.status === "available_to_unlock" ? 1 : 0) - (a.availability?.status === "available_to_unlock" ? 1 : 0) || tie;
    if (sort === "lowestGap") return a.gap - b.gap || tie;
    if (sort === "highestGap") return b.gap - a.gap || tie;
    return b.recommendationScore - a.recommendationScore || tie;
  });
  return sorted;
}

export function summarizeRoleReadiness(role: SkillRoleKey, rows: SkillDashboardRow[]): RoleReadinessSummary {
  const relevant = rows.filter((r) => r.roleLinks.some((l) => l.role_key === role));
  const weighted = relevant.reduce((acc, row) => {
    const link = row.roleLinks.find((l) => l.role_key === role)!;
    const target = Math.max(1, link.minimum_recommended_level);
    return acc + Math.min(1, row.progress.current_level / target) * link.weight;
  }, 0);
  const total = relevant.reduce((acc, row) => acc + (row.roleLinks.find((l) => l.role_key === role)?.weight ?? 0), 0) || 1;
  const score = Math.round((weighted / total) * 100);
  const sorted = relevant.sort((a, b) => b.roleScore - a.roleScore || stable(a, b));
  return {
    role,
    score,
    band: bandForScore(score),
    foundationSkills: sorted.filter((r) => r.catalogue.is_foundational).slice(0, 5),
    specialistSkills: sorted.filter((r) => !r.catalogue.is_foundational).slice(0, 5),
    strengths: sorted.filter((r) => r.gap === 0 && r.progress.is_unlocked).slice(0, 4),
    gaps: sorted.filter((r) => r.gap > 0).sort((a, b) => b.gap - a.gap || stable(a, b)).slice(0, 5),
    blocked: sorted.filter((r) => r.availability?.status === "prerequisites_missing").slice(0, 4),
    usefulAttributes: Array.from(new Set(sorted.flatMap((r) => r.attributeLinks.map((l) => l.attribute_key)))).slice(0, 6),
    impact: Array.from(new Set(sorted.flatMap((r) => r.systemLinks.map((l) => l.system_key.replace(/_/g, " "))))).slice(0, 5),
  };
}

export function buildRecommendations(rows: SkillDashboardRow[], role?: SkillRoleKey | "all" | null, limit = 5): Array<{ id: string; title: string; reason: string; skillSlug?: string }> {
  return rows
    .filter((r) => r.catalogue.is_active && !r.catalogue.is_hidden && r.availability?.status !== "hidden" && r.availability?.status !== "inactive")
    .filter((r) => !role || role === "all" || r.roleLinks.some((l) => l.role_key === role) || r.progress.progress_percent >= 70)
    .sort((a, b) => b.recommendationScore - a.recommendationScore || stable(a, b))
    .slice(0, limit)
    .map((r) => ({
      id: `skill:${r.catalogue.slug}`,
      skillSlug: r.catalogue.slug,
      title: r.progress.is_unlocked ? `Improve ${r.catalogue.name} to level ${r.progress.next_level ?? r.progress.current_level}` : `Unlock ${r.catalogue.name}`,
      reason: r.progress.is_unlocked
        ? `${r.catalogue.name} supports ${r.systemLinks.map((l) => l.system_key.replace(/_/g, " ")).slice(0, 2).join(" and ") || "your progression"}${r.gap > 0 ? " and is a current role gap" : ""}. Estimated contributions are previews, not guaranteed outcome changes.`
        : `${r.catalogue.name} is a foundation or role-relevant skill with accessible routes: ${r.unlockRoutes.map((u) => u.route_type.replace(/_/g, " ")).join(", ") || "education or activity progression"}.`,
    }));
}
