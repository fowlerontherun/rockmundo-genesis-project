import { z } from "zod";

import type { Tables } from "@/lib/supabase-types";

export type YoutubeResourceRow = Tables<"education_youtube_resources"> & {
  skill_slug?: string | null;
  channel_name?: string | null;
  is_featured?: boolean | null;
};

export const youtubeResourceSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().trim().max(800).default(""),
  videoUrl: z.string().url("Enter a valid YouTube URL"),
  skillSlug: z.string().trim().min(1, "Skill is required"),
  category: z.string().trim().min(1, "Category is required").max(80),
  channelName: z.string().trim().max(120).default(""),
  difficultyLevel: z.coerce.number().int().min(1).max(3),
  durationMinutes: z.coerce.number().int().min(1).max(360),
  tagsText: z.string().trim().max(400).default(""),
  isFeatured: z.boolean().default(false),
});

export type YoutubeResourceFormValues = z.infer<typeof youtubeResourceSchema>;

export const defaultResourceFormValues: YoutubeResourceFormValues = {
  title: "",
  description: "",
  videoUrl: "",
  skillSlug: "",
  category: "",
  channelName: "",
  difficultyLevel: 1,
  durationMinutes: 15,
  tagsText: "",
  isFeatured: false,
};

export const mapResourceRowToFormValues = (
  row: YoutubeResourceRow,
): YoutubeResourceFormValues => ({
  title: row.title,
  description: row.description ?? "",
  videoUrl: row.video_url,
  skillSlug: row.skill_slug ?? "",
  category: row.category ?? "general",
  channelName: row.channel_name ?? "",
  difficultyLevel: row.difficulty_level ?? 1,
  durationMinutes: row.duration_minutes ?? 15,
  tagsText: row.tags?.join(", ") ?? "",
  isFeatured: row.is_featured ?? false,
});

export const mapResourceFormToPayload = (
  values: YoutubeResourceFormValues,
) => ({
  title: values.title.trim(),
  description: values.description.trim() || null,
  video_url: values.videoUrl.trim(),
  skill_slug: values.skillSlug.trim(),
  category: values.category.trim().toLowerCase().replace(/\s+/g, "_"),
  channel_name: values.channelName.trim() || null,
  difficulty_level: values.difficultyLevel,
  duration_minutes: values.durationMinutes,
  tags: values.tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean),
  is_featured: values.isFeatured,
  updated_at: new Date().toISOString(),
});
