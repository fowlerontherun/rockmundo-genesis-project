import { z } from "zod";

import { EDUCATION_MENTOR_DIFFICULTIES } from "@/types/education";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase-types";
import { ATTRIBUTE_KEYS, type AttributeKey } from "@/utils/attributeProgression";
import { SKILL_TREE_DEFINITIONS } from "@/data/skillTree";
import type { SkillDefinitionRecord } from "@/hooks/useSkillSystem.types";

const focusSkillOptionsSource = (
  SKILL_TREE_DEFINITIONS as SkillDefinitionRecord[]
).filter((definition) => Boolean(definition.slug));

const formatSkillLabel = (slug: string, displayName?: string | null) => {
  if (displayName && displayName.trim().length > 0) {
    return displayName;
  }

  return slug
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const focusSkillOptions = focusSkillOptionsSource
  .map((definition) => ({
    value: definition.slug!,
    label: formatSkillLabel(definition.slug!, definition.display_name),
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const focusSkillValues = focusSkillOptions.map((option) => option.value);

export const mentorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  focusSkill: z
    .string({ required_error: "Select a focus skill" })
    .min(1, "Select a focus skill")
    .refine((value) => focusSkillValues.includes(value), {
      message: "Select a valid focus skill",
    }),
  description: z.string().min(1, "Description is required"),
  specialty: z.string().min(1, "Specialty is required"),
  cost: z
    .coerce
    .number({ invalid_type_error: "Cost must be a number" })
    .int("Cost must be a whole number")
    .min(0, "Cost cannot be negative"),
  cooldownHours: z
    .coerce
    .number({ invalid_type_error: "Cooldown must be a number" })
    .int("Cooldown must be a whole number")
    .min(0, "Cooldown cannot be negative"),
  baseXp: z
    .coerce
    .number({ invalid_type_error: "Base XP must be a number" })
    .int("Base XP must be a whole number")
    .min(0, "Base XP cannot be negative"),
  difficulty: z.enum(EDUCATION_MENTOR_DIFFICULTIES, {
    errorMap: () => ({ message: "Select a difficulty" }),
  }),
  attributeKeys: z
    .array(z.enum(ATTRIBUTE_KEYS as [AttributeKey, ...AttributeKey[]], {
      errorMap: () => ({ message: "Select valid attributes" }),
    }))
    .min(1, "Select at least one attribute"),
  requiredSkillValue: z
    .coerce
    .number({ invalid_type_error: "Required skill must be a number" })
    .int("Required skill must be a whole number")
    .min(0, "Required skill cannot be negative"),
  skillGainRatio: z
    .coerce
    .number({ invalid_type_error: "Skill gain ratio must be a number" })
    .min(0.01, "Skill gain ratio must be positive"),
  bonusDescription: z.string().min(1, "Bonus description is required"),
});

export type MentorFormValues = z.infer<typeof mentorSchema>;

export type EducationMentorRow = any;
export type EducationMentorInsert = any;
export type EducationMentorUpdate = any;

export const difficultyOptions = EDUCATION_MENTOR_DIFFICULTIES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

export const attributeOptions = ATTRIBUTE_KEYS.map((key) => ({
  value: key,
  label: key
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" "),
}));

export const formatFocusSkill = (skill: string) =>
  focusSkillOptions.find((option) => option.value === skill)?.label ??
  formatSkillLabel(skill);
