import { z } from "zod";

import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import {
  LESSON_DIFFICULTIES,
  LESSON_DIFFICULTY_CONFIG,
  SKILL_LABELS,
  type LessonDifficulty,
  type PrimarySkill,
} from "@/features/education/constants";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_METADATA,
  type AttributeKey,
} from "@/utils/attributeProgression";

export type YoutubeLessonRow = Tables<'education_youtube_lessons'>;
export type YoutubeLessonInsert = TablesInsert<'education_youtube_lessons'>;
export type YoutubeLessonUpdate = TablesUpdate<'education_youtube_lessons'>;
export type YoutubeResourceRow = Tables<'education_youtube_resources'>;
export type YoutubeResourceInsert = TablesInsert<'education_youtube_resources'>;
export type YoutubeResourceUpdate = TablesUpdate<'education_youtube_resources'>;

const SKILL_VALUES = Object.keys(SKILL_LABELS) as PrimarySkill[];
const SKILL_ENUM = z.enum(SKILL_VALUES as [PrimarySkill, ...PrimarySkill[]]);
const ATTRIBUTE_VALUE_OPTIONS = ATTRIBUTE_KEYS as [AttributeKey, ...AttributeKey[]];
const ATTRIBUTE_ENUM = z.enum(ATTRIBUTE_VALUE_OPTIONS);
const LESSON_DIFFICULTY_ENUM = z.enum(LESSON_DIFFICULTIES);

export const skillOptions = SKILL_VALUES.map((value) => ({
  value,
  label: SKILL_LABELS[value],
}));

export const lessonDifficultyOptions = LESSON_DIFFICULTIES.map((value) => ({
  value,
  label: LESSON_DIFFICULTY_CONFIG[value].label,
}));

export const attributeOptions = ATTRIBUTE_KEYS.map((value) => ({
  value,
  label: ATTRIBUTE_METADATA[value].label,
  description: ATTRIBUTE_METADATA[value].description,
}));

export const youtubeLessonSchema = z.object({
  skill: SKILL_ENUM,
  title: z.string().min(1, "Title is required").max(120),
  channel: z.string().min(1, "Channel is required").max(120),
  focus: z.string().min(1, "Focus is required").max(120),
  summary: z.string().min(1, "Summary is required").max(600),
  url: z.string().url("Enter a valid URL"),
  difficulty: LESSON_DIFFICULTY_ENUM,
  durationMinutes: z.coerce.number().int().min(5).max(360),
  attributeKeys: z.array(ATTRIBUTE_ENUM).max(4).default([]),
  requiredSkillValue: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d+$/.test(value) && Number(value) <= 1000),
      "Enter a value between 0 and 1000 or leave blank.",
    )
    .default(""),
});

export type YoutubeLessonFormValues = z.infer<typeof youtubeLessonSchema>;

export const defaultLessonFormValues: YoutubeLessonFormValues = {
  skill: SKILL_VALUES[0],
  title: "",
  channel: "",
  focus: "",
  summary: "",
  url: "",
  difficulty: LESSON_DIFFICULTIES[0],
  durationMinutes: 30,
  attributeKeys: [],
  requiredSkillValue: "",
};

export const youtubeResourceSchema = z.object({
  collectionKey: z.string().trim().min(1, "Collection key is required").max(60),
  collectionTitle: z.string().trim().min(1, "Collection title is required").max(120),
  collectionDescription: z.string().trim().max(400),
  collectionSortOrder: z.coerce.number().int().min(0).max(1000),
  resourceName: z.string().trim().min(1, "Resource name is required").max(120),
  resourceFormat: z.string().trim().min(1, "Format is required").max(60),
  resourceFocus: z.string().trim().min(1, "Focus is required").max(120),
  resourceSummary: z.string().trim().min(1, "Summary is required").max(500),
  resourceUrl: z.string().url("Enter a valid URL"),
  resourceSortOrder: z.coerce.number().int().min(0).max(1000),
});

export type YoutubeResourceFormValues = z.infer<typeof youtubeResourceSchema>;

export const defaultResourceFormValues: YoutubeResourceFormValues = {
  collectionKey: "",
  collectionTitle: "",
  collectionDescription: "",
  collectionSortOrder: 0,
  resourceName: "",
  resourceFormat: "",
  resourceFocus: "",
  resourceSummary: "",
  resourceUrl: "",
  resourceSortOrder: 0,
};

export const mapLessonRowToFormValues = (
  row: YoutubeLessonRow,
): YoutubeLessonFormValues => ({
  skill: (row.skill as PrimarySkill) ?? SKILL_VALUES[0],
  title: row.title,
  channel: row.channel,
  focus: row.focus,
  summary: row.summary,
  url: row.url,
  difficulty: (row.difficulty as LessonDifficulty) ?? LESSON_DIFFICULTIES[0],
  durationMinutes: row.duration_minutes,
  attributeKeys: (row.attribute_keys ?? []).filter((key): key is AttributeKey =>
    ATTRIBUTE_KEYS.includes(key as AttributeKey),
  ),
  requiredSkillValue: typeof row.required_skill_value === "number" ? row.required_skill_value.toString() : "",
});

export const mapLessonFormToPayload = (
  values: YoutubeLessonFormValues,
): YoutubeLessonInsert => ({
  skill: values.skill,
  title: values.title.trim(),
  channel: values.channel.trim(),
  focus: values.focus.trim(),
  summary: values.summary.trim(),
  url: values.url.trim(),
  difficulty: values.difficulty,
  duration_minutes: values.durationMinutes,
  attribute_keys: values.attributeKeys,
  required_skill_value: values.requiredSkillValue ? Number(values.requiredSkillValue) : null,
});

export const mapResourceRowToFormValues = (
  row: YoutubeResourceRow,
): YoutubeResourceFormValues => ({
  collectionKey: row.collection_key,
  collectionTitle: row.collection_title,
  collectionDescription: row.collection_description ?? "",
  collectionSortOrder: row.collection_sort_order,
  resourceName: row.resource_name,
  resourceFormat: row.resource_format,
  resourceFocus: row.resource_focus,
  resourceSummary: row.resource_summary,
  resourceUrl: row.resource_url,
  resourceSortOrder: row.resource_sort_order,
});

export const mapResourceFormToPayload = (
  values: YoutubeResourceFormValues,
): YoutubeResourceInsert => ({
  collection_key: values.collectionKey.trim(),
  collection_title: values.collectionTitle.trim(),
  collection_description: values.collectionDescription.trim() || null,
  collection_sort_order: values.collectionSortOrder,
  resource_name: values.resourceName.trim(),
  resource_format: values.resourceFormat.trim(),
  resource_focus: values.resourceFocus.trim(),
  resource_summary: values.resourceSummary.trim(),
  resource_url: values.resourceUrl.trim(),
  resource_sort_order: values.resourceSortOrder,
});
