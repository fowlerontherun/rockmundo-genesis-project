import {
  CANONICAL_ATTRIBUTE_LINKS,
  CANONICAL_PREREQUISITES,
  CANONICAL_ROLE_LINKS,
  CANONICAL_SKILLS,
  CANONICAL_SYSTEM_LINKS,
  KNOWN_ATTRIBUTE_KEYS,
  SKILL_ROLE_KEYS,
  SKILL_SYSTEM_KEYS,
  SKILL_TYPES,
} from "./skillCatalogue";

export interface SkillCatalogueValidationResult {
  errors: string[];
  warnings: string[];
}
const groupBy = <T, K extends string>(items: T[], key: (item: T) => K) =>
  items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );

export function detectPrerequisiteCycles(
  prerequisites = CANONICAL_PREREQUISITES,
): string[][] {
  const graph = groupBy(
    prerequisites.filter((p) => p.prerequisite_type === "required"),
    (p) => p.prerequisite_skill_slug,
  );
  const cycles: string[][] = [];
  const visit = (node: string, path: string[]) => {
    if (path.includes(node)) {
      cycles.push([...path.slice(path.indexOf(node)), node]);
      return;
    }
    for (const edge of graph[node] ?? [])
      visit(edge.skill_slug, [...path, node]);
  };
  CANONICAL_SKILLS.forEach((s) => visit(s.slug, []));
  return cycles;
}

export function validateSkillCatalogue(): SkillCatalogueValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const skillsBySlug = groupBy(CANONICAL_SKILLS, (s) => s.slug);
  Object.entries(skillsBySlug).forEach(([slug, rows]) => {
    if (rows.length > 1) errors.push(`Duplicate skill slug: ${slug}`);
  });
  for (const skill of CANONICAL_SKILLS) {
    if (!skill.name.trim()) errors.push(`${skill.slug} is missing a name`);
    if (!skill.category.trim())
      errors.push(`${skill.slug} is missing a category`);
    if (!SKILL_TYPES.includes(skill.skill_type as any))
      errors.push(`${skill.slug} has invalid skill_type ${skill.skill_type}`);
    if (!skill.progression_curve_key)
      errors.push(`${skill.slug} is missing a progression curve`);
    if (skill.max_level <= 0)
      errors.push(`${skill.slug} has invalid max_level`);
    if (
      skill.is_active &&
      skill.is_practiceable &&
      !CANONICAL_ATTRIBUTE_LINKS.some(
        (l) =>
          l.skill_slug === skill.slug &&
          l.relationship_type === "learning_speed",
      )
    )
      errors.push(`${skill.slug} has no learning_speed attribute links`);
  }
  const weightGroups = groupBy(
    CANONICAL_ATTRIBUTE_LINKS,
    (l) => `${l.skill_slug}:${l.relationship_type}`,
  );
  Object.entries(weightGroups).forEach(([key, rows]) => {
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    if (Math.abs(total - 1) > 0.001)
      errors.push(`${key} weights total ${total}, expected 1`);
  });
  for (const link of CANONICAL_ATTRIBUTE_LINKS)
    if (!KNOWN_ATTRIBUTE_KEYS.includes(link.attribute_key))
      errors.push(
        `${link.skill_slug} references unknown attribute ${link.attribute_key}`,
      );
  for (const link of CANONICAL_SYSTEM_LINKS)
    if (!SKILL_SYSTEM_KEYS.includes(link.system_key as any))
      errors.push(
        `${link.skill_slug} references unknown system ${link.system_key}`,
      );
  for (const link of CANONICAL_ROLE_LINKS)
    if (!SKILL_ROLE_KEYS.includes(link.role_key as any))
      errors.push(
        `${link.skill_slug} references unknown role ${link.role_key}`,
      );
  for (const prerequisite of CANONICAL_PREREQUISITES) {
    if (prerequisite.skill_slug === prerequisite.prerequisite_skill_slug)
      errors.push(`${prerequisite.skill_slug} cannot require itself`);
    const skill = skillsBySlug[prerequisite.skill_slug]?.[0];
    const required = skillsBySlug[prerequisite.prerequisite_skill_slug]?.[0];
    if (!skill || !required)
      errors.push(
        `${prerequisite.skill_slug} references missing prerequisite ${prerequisite.prerequisite_skill_slug}`,
      );
    if (required && !required.is_active && skill?.is_active)
      errors.push(
        `${prerequisite.skill_slug} is blocked by inactive prerequisite ${required.slug}`,
      );
    if (required && prerequisite.required_level > required.max_level)
      errors.push(
        `${prerequisite.skill_slug} requires impossible level ${prerequisite.required_level} of ${required.slug}`,
      );
  }
  detectPrerequisiteCycles().forEach((cycle) =>
    errors.push(`Circular prerequisite chain: ${cycle.join(" -> ")}`),
  );
  const linkedSlugs = new Set(
    [
      ...CANONICAL_ATTRIBUTE_LINKS,
      ...CANONICAL_PREREQUISITES,
      ...CANONICAL_ROLE_LINKS,
      ...CANONICAL_SYSTEM_LINKS,
    ]
      .flatMap((l: any) => [l.skill_slug, l.prerequisite_skill_slug])
      .filter(Boolean),
  );
  CANONICAL_SKILLS.filter((s) => !linkedSlugs.has(s.slug)).forEach((s) =>
    warnings.push(`${s.slug} has no catalogue relationships beyond metadata`),
  );
  return { errors, warnings };
}
