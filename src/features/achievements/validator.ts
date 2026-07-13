import {
  ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_TIERS, ACHIEVEMENT_TYPES, CANONICAL_ACHIEVEMENTS,
  CANONICAL_CRITERIA, COMPARISONS, CRITERION_SCOPES, CRITERION_TYPES, type AchievementDefinition,
  type AchievementCriterionDefinition,
} from "./catalogue";

export interface CatalogueValidationResult { errors: string[]; warnings: string[]; }

const categorySet = new Set<string>(ACHIEVEMENT_CATEGORIES);
const tierSet = new Set<string>(ACHIEVEMENT_TIERS);
const typeSet = new Set<string>(ACHIEVEMENT_TYPES);
const criterionTypeSet = new Set<string>(CRITERION_TYPES);
const comparisonSet = new Set<string>(COMPARISONS);
const scopeSet = new Set<string>(CRITERION_SCOPES);

export function validateAchievementCatalogue(
  achievements: AchievementDefinition[] = CANONICAL_ACHIEVEMENTS,
  criteria: AchievementCriterionDefinition[] = CANONICAL_CRITERIA,
): CatalogueValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const slugs = new Set<string>();
  const criteriaBySlug = new Map<string, AchievementCriterionDefinition[]>();

  for (const criterion of criteria) {
    const list = criteriaBySlug.get(criterion.achievement_slug) ?? [];
    list.push(criterion);
    criteriaBySlug.set(criterion.achievement_slug, list);
    if (!criterionTypeSet.has(criterion.criterion_type)) errors.push(`Invalid criterion type ${criterion.criterion_type} for ${criterion.achievement_slug}`);
    if (!comparisonSet.has(criterion.comparison)) errors.push(`Invalid comparison ${criterion.comparison} for ${criterion.achievement_slug}`);
    if (!scopeSet.has(criterion.scope)) errors.push(`Invalid scope ${criterion.scope} for ${criterion.achievement_slug}`);
    if (!criterion.target_key) errors.push(`Missing target key for ${criterion.achievement_slug}`);
    if (criterion.sequence_order != null && !criterion.sequence_group) errors.push(`Sequence order without group for ${criterion.achievement_slug}`);
  }

  for (const achievement of achievements) {
    if (slugs.has(achievement.slug)) errors.push(`Duplicate achievement slug ${achievement.slug}`);
    slugs.add(achievement.slug);
    if (!achievement.name.trim()) errors.push(`Missing name for ${achievement.slug}`);
    if (!achievement.description.trim()) errors.push(`Missing description for ${achievement.slug}`);
    if (!categorySet.has(achievement.category)) errors.push(`Invalid category ${achievement.category} for ${achievement.slug}`);
    if (!tierSet.has(achievement.tier)) errors.push(`Invalid tier ${achievement.tier} for ${achievement.slug}`);
    if (!typeSet.has(achievement.achievement_type)) errors.push(`Invalid type ${achievement.achievement_type} for ${achievement.slug}`);
    if (!criteriaBySlug.has(achievement.slug)) errors.push(`Active achievement ${achievement.slug} has no criteria`);
    if (achievement.is_repeatable && (!achievement.repeat_limit || achievement.repeat_limit < 1 || achievement.repeat_limit > 25)) {
      errors.push(`Repeatable achievement ${achievement.slug} needs a safe repeat limit`);
    }
    if (achievement.is_hidden && achievement.description.toLowerCase().includes("exactly")) {
      errors.push(`Hidden achievement ${achievement.slug} appears to leak exact criteria`);
    }
    if (achievement.points < 0 || achievement.points > 100) errors.push(`Achievement ${achievement.slug} has invalid points`);
  }

  for (const slug of criteriaBySlug.keys()) {
    if (!slugs.has(slug)) errors.push(`Criteria references unknown achievement ${slug}`);
  }

  const chainCounts = new Map<string, number>();
  for (const achievement of achievements) {
    if (achievement.chain_key) chainCounts.set(achievement.chain_key, (chainCounts.get(achievement.chain_key) ?? 0) + 1);
  }
  for (const [chain, count] of chainCounts.entries()) {
    if (count < 2) warnings.push(`Chain ${chain} has only one achievement`);
  }

  return { errors, warnings };
}
