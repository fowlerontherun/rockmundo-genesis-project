import { z } from "zod";

import { SKILL_TREE_DEFINITIONS, type TierName } from "@/data/skillTree";
import type { Database } from "@/lib/supabase-types";
import type { SkillDefinitionRecord } from "@/hooks/useSkillSystem.types";

import { getMetadataValue, parseString, parseTier } from "./shared";

export const BOOK_XP_VALUE = 10;
export const BOOK_SEED_COSTS: Record<TierName, number> = {
  Basic: 250,
  Professional: 750,
  Mastery: 1500,
};

export const skillBookSchema = z.object({
  skillSlug: z.string().min(1, "Skill selection is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  cost: z
    .coerce
    .number({ invalid_type_error: "Cost must be a number" })
    .min(0, "Cost cannot be negative"),
  xpValue: z
    .coerce
    .number({ invalid_type_error: "XP reward must be a number" })
    .min(0, "XP cannot be negative"),
  isActive: z.boolean(),
});

export type SkillBookFormValues = z.infer<typeof skillBookSchema>;

export type SkillBooksTable = Database["public"]["Tables"] extends { skill_books: infer T }
  ? T
  : {
      Row: {
        id: string;
        skill_slug: string;
        title: string;
        description: string | null;
        cost: number | null;
        xp_value: number | null;
        is_active: boolean | null;
        created_at: string | null;
        updated_at: string | null;
      };
      Insert: {
        skill_slug: string;
        title: string;
        description?: string | null;
        cost?: number | null;
        xp_value?: number | null;
        is_active?: boolean | null;
      };
      Update: {
        skill_slug?: string;
        title?: string;
        description?: string | null;
        cost?: number | null;
        xp_value?: number | null;
        is_active?: boolean | null;
      };
    };

export type SkillBookRow = SkillBooksTable extends { Row: infer R } ? R : never;
export type SkillBookInsert = SkillBooksTable extends { Insert: infer I } ? I : never;
export type SkillBookUpdate = SkillBooksTable extends { Update: infer U } ? U : never;

export type SkillDefinitionsTable = Database["public"]["Tables"] extends { skill_definitions: infer T }
  ? T
  : {
      Row: {
        id: string;
        slug: string;
        display_name: string | null;
        metadata?: Record<string, unknown> | null;
        description?: string | null;
      };
    };

export type SkillDefinitionRow = SkillDefinitionsTable extends { Row: infer R } ? R : never;

export type SkillMetadata = {
  name: string;
  track?: string;
  tier?: TierName;
  category?: string;
};

export type SkillOption = SkillMetadata & { value: string };

export const buildSkillTreeMetadata = () => {
  const metadataMap = new Map<string, SkillMetadata>();

  for (const definition of SKILL_TREE_DEFINITIONS as SkillDefinitionRecord[]) {
    const slug = definition.slug;
    if (!slug) {
      continue;
    }

    const metadata = definition.metadata ?? null;
    metadataMap.set(slug, {
      name: parseString(definition.display_name) ?? slug,
      track: parseString(getMetadataValue(metadata, "track")),
      tier: parseTier(getMetadataValue(metadata, "tier")),
      category: parseString(getMetadataValue(metadata, "category")),
    });
  }

  return metadataMap;
};

export const indexSkillDefinitions = (definitions: SkillDefinitionRow[]) => {
  return definitions.reduce<Record<string, SkillDefinitionRow>>((acc, definition) => {
    if (definition.slug) {
      acc[definition.slug] = definition;
    }
    return acc;
  }, {});
};

export const buildSkillOptions = (
  skillDefinitions: SkillDefinitionRow[],
  skillTreeMetadata: Map<string, SkillMetadata>,
) => {
  const options = new Map<string, SkillOption>();

  const upsertOption = (
    slug: string | null | undefined,
    displayName: string | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
  ) => {
    const normalizedSlug = parseString(slug);
    if (!normalizedSlug) {
      return;
    }

    const tree = skillTreeMetadata.get(normalizedSlug);
    const option: SkillOption = {
      value: normalizedSlug,
      name: parseString(displayName) ?? tree?.name ?? normalizedSlug,
      track: parseString(getMetadataValue(metadata, "track")) ?? tree?.track,
      tier: parseTier(getMetadataValue(metadata, "tier")) ?? tree?.tier,
      category: parseString(getMetadataValue(metadata, "category")) ?? tree?.category,
    };

    const existing = options.get(normalizedSlug);
    if (existing) {
      options.set(normalizedSlug, {
        value: normalizedSlug,
        name: option.name ?? existing.name,
        track: option.track ?? existing.track,
        tier: option.tier ?? existing.tier,
        category: option.category ?? existing.category,
      });
    } else {
      options.set(normalizedSlug, option);
    }
  };

  for (const definition of skillDefinitions) {
    upsertOption(definition.slug, definition.display_name ?? null, definition.metadata ?? null);
  }

  for (const definition of SKILL_TREE_DEFINITIONS as SkillDefinitionRecord[]) {
    upsertOption(definition.slug, definition.display_name ?? null, definition.metadata ?? null);
  }

  return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const resolveSkillMetadata = (
  skillSlug: string,
  definitionBySlug: Record<string, SkillDefinitionRow>,
  skillTreeMetadata: Map<string, SkillMetadata>,
): SkillMetadata => {
  const normalizedSlug = parseString(skillSlug) ?? skillSlug;
  const treeMetadata = normalizedSlug ? skillTreeMetadata.get(normalizedSlug) : undefined;
  const definition = normalizedSlug ? definitionBySlug[normalizedSlug] : undefined;
  const metadata = definition?.metadata ?? null;

  return {
    name: parseString(definition?.display_name) ?? treeMetadata?.name ?? normalizedSlug,
    track: parseString(getMetadataValue(metadata, "track")) ?? treeMetadata?.track,
    tier: parseTier(getMetadataValue(metadata, "tier")) ?? treeMetadata?.tier,
    category: parseString(getMetadataValue(metadata, "category")) ?? treeMetadata?.category,
  };
};

export const buildSeedRecords = (): SkillBookInsert[] => {
  return SKILL_TREE_DEFINITIONS.map((definition) => {
    const slug = definition.slug;
    const metadata = definition.metadata ?? null;
    const tier = parseTier(getMetadataValue(metadata, "tier")) ?? "Basic";

    return {
      skill_slug: slug,
      title: parseString(definition.display_name) ?? slug,
      description: definition.description ?? null,
      cost: BOOK_SEED_COSTS[tier] ?? BOOK_SEED_COSTS.Basic,
      xp_value: BOOK_XP_VALUE,
      is_active: true,
    } satisfies SkillBookInsert;
  });
};
