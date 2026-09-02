import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

import type { VideoPlaylist, VideoResource } from "../types";

type YoutubeResourceRow = Tables<"education_youtube_resources"> & {
  skill_slug?: string | null;
  channel_name?: string | null;
  is_featured?: boolean | null;
};

type SkillDefinitionRow = Pick<Tables<"skill_definitions">, "slug" | "display_name">;

const PLAYLIST_QUERY_KEY = ["education", "youtube-resources"] as const;

const humanizeSkillSlug = (value: string) =>
  value
    .replace(/^instruments_/, "")
    .replace(/^genres_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const mapResourceRow = (
  row: YoutubeResourceRow,
  skillLabels: Map<string, string>,
): VideoResource => {
  const skillSlug = row.skill_slug ?? row.category ?? null;
  const skillName = skillSlug
    ? skillLabels.get(skillSlug) ?? humanizeSkillSlug(skillSlug)
    : row.category
      ? humanizeSkillSlug(row.category)
      : "General";

  return {
    id: row.id,
    name: row.title,
    format: row.category ?? "general",
    focus: row.tags?.join(", ") ?? "",
    url: row.video_url,
    summary: row.description ?? "",
    sortOrder: row.difficulty_level ?? 0,
    difficulty: row.difficulty_level ?? 1,
    durationMinutes: row.duration_minutes ?? null,
    tags: row.tags ?? [],
    skillSlug,
    skillName,
    channelName: row.channel_name ?? null,
    featured: row.is_featured ?? false,
  };
};

const buildPlaylists = (
  rows: YoutubeResourceRow[],
  skillLabels: Map<string, string>,
): VideoPlaylist[] => {
  const groups = new Map<string, VideoPlaylist>();

  for (const row of rows) {
    const resource = mapResourceRow(row, skillLabels);
    const key = resource.skillSlug ?? row.category ?? "general";
    const existing = groups.get(key);

    const playlist = existing ?? {
      key,
      title: resource.skillName,
      description: `Lessons and tutorials that improve ${resource.skillName}.`,
      sortOrder: resource.featured ? -1 : resource.difficulty,
      resources: [],
    };

    playlist.resources.push(resource);
    if (resource.featured) playlist.sortOrder = -1;
    groups.set(key, playlist);
  }

  const result = Array.from(groups.values());

  for (const playlist of result) {
    playlist.resources.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
      if ((a.durationMinutes ?? 999) !== (b.durationMinutes ?? 999)) {
        return (a.durationMinutes ?? 999) - (b.durationMinutes ?? 999);
      }
      return a.name.localeCompare(b.name);
    });
  }

  result.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });

  return result;
};

export const useEducationVideoPlaylists = (): UseQueryResult<VideoPlaylist[]> =>
  useQuery({
    queryKey: PLAYLIST_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("education_youtube_resources")
        .select("*")
        .order("is_featured", { ascending: false })
        .order("difficulty_level", { ascending: true })
        .order("title", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as YoutubeResourceRow[];
      const skillSlugs = Array.from(
        new Set(rows.map((row) => row.skill_slug).filter((slug): slug is string => Boolean(slug))),
      );

      const skillLabels = new Map<string, string>();
      if (skillSlugs.length > 0) {
        const { data: skillRows, error: skillError } = await supabase
          .from("skill_definitions")
          .select("slug, display_name")
          .in("slug", skillSlugs);

        if (skillError) throw skillError;

        for (const skill of (skillRows ?? []) as SkillDefinitionRow[]) {
          skillLabels.set(skill.slug, skill.display_name);
        }
      }

      return buildPlaylists(rows, skillLabels);
    },
    staleTime: 1000 * 60 * 5,
  });
