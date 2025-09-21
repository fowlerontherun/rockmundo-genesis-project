import { z } from "zod";

import {
  EDUCATION_MENTOR_DIFFICULTIES,
  EDUCATION_MENTOR_FOCUS_SKILLS,
  type EducationMentorFocusSkill,
} from "@/types/education";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { ATTRIBUTE_KEYS, type AttributeKey } from "@/utils/attributeProgression";

export const mentorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  focusSkill: z.enum(EDUCATION_MENTOR_FOCUS_SKILLS, {
    errorMap: () => ({ message: "Select a focus skill" }),
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

export type EducationMentorRow = Tables<"education_mentors">;
export type EducationMentorInsert = TablesInsert<"education_mentors">;
export type EducationMentorUpdate = TablesUpdate<"education_mentors">;

export const focusSkillOptions = EDUCATION_MENTOR_FOCUS_SKILLS.map((value) => ({
  value,
  label: value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" "),
}));

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

export const formatFocusSkill = (skill: EducationMentorFocusSkill) =>
  focusSkillOptions.find((option) => option.value === skill)?.label ?? skill;
