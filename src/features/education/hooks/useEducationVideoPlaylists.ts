import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

import type { VideoPlaylist, VideoResource } from "../types";

type YoutubeResourceRow = Tables<'education_youtube_resources'>;

const PLAYLIST_QUERY_KEY = ["education", "youtube-resources"] as const;

const mapResourceRow = (row: YoutubeResourceRow): VideoResource => ({
  id: row.id,
  name: row.title,
  format: row.category ?? "",
  focus: row.tags?.join(", ") ?? "",
  url: row.video_url,
  summary: row.description ?? "",
  sortOrder: row.difficulty_level ?? 0,
});

const buildPlaylists = (rows: YoutubeResourceRow[]): VideoPlaylist[] => {
  const groups = new Map<string, VideoPlaylist>();

  for (const row of rows) {
    const key = row.category ?? "general";
    const existing = groups.get(key);

    const playlist = existing ?? {
      key,
      title: row.category ?? "General",
      description: "",
      sortOrder: 0,
      resources: [],
    };

    playlist.resources.push(mapResourceRow(row));
    groups.set(key, playlist);
  }

  const result = Array.from(groups.values());

  for (const playlist of result) {
    playlist.resources.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });
  }

  result.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.title.localeCompare(b.title);
  });

  return result;
};

export const useEducationVideoPlaylists = (): UseQueryResult<VideoPlaylist[]> =>
  useQuery({
    queryKey: PLAYLIST_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_youtube_resources")
        .select("*")
        .order("category", { ascending: true })
        .order("difficulty_level", { ascending: true })
        .order("title", { ascending: true });

      if (error) {
        throw error;
      }

      return buildPlaylists((data ?? []) as YoutubeResourceRow[]);
    },
    staleTime: 1000 * 60 * 5,
  });
