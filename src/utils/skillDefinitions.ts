import { useMemo } from "react";

import { SKILL_TREE_DEFINITIONS } from "@/data/skillTree";
import type { SkillDefinitionRecord } from "@/hooks/useSkillSystem.types";

type GenericSkillDefinition = {
  slug?: string | null;
  display_name?: string | null;
  description?: string | null;
  metadata?: unknown;
};

export type SkillDefinitionOption = {
  slug: string;
  displayName: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

const formatDisplayNameFromSlug = (slug: string): string =>
  slug
    .split(/[_-]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const extractMetadata = (
  definition: GenericSkillDefinition | SkillDefinitionRecord,
): Record<string, unknown> | null => {
  if ("metadata" in definition && definition.metadata !== undefined) {
    return (definition.metadata as Record<string, unknown> | null) ?? null;
  }

  return null;
};

const upsertDefinition = (
  map: Map<string, SkillDefinitionOption>,
  definition: GenericSkillDefinition | SkillDefinitionRecord,
) => {
  const slug = typeof definition.slug === "string" ? definition.slug : null;
  if (!slug) {
    return;
  }

  const displayName =
    typeof definition.display_name === "string" && definition.display_name.trim().length > 0
      ? definition.display_name.trim()
      : formatDisplayNameFromSlug(slug);

  const description =
    typeof definition.description === "string" ? definition.description : null;

  map.set(slug, {
    slug,
    displayName,
    description,
    metadata: extractMetadata(definition),
  });
};

export const mergeSkillDefinitions = (
  definitions?: GenericSkillDefinition[] | null,
) => {
  const map = new Map<string, SkillDefinitionOption>();

  for (const definition of SKILL_TREE_DEFINITIONS as SkillDefinitionRecord[]) {
    upsertDefinition(map, definition);
  }

  if (definitions) {
    for (const definition of definitions) {
      upsertDefinition(map, definition);
    }
  }

  const list = Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { list, map };
};

export const useMergedSkillDefinitions = (
  definitions?: GenericSkillDefinition[] | null,
) =>
  useMemo(() => mergeSkillDefinitions(definitions), [definitions]);

