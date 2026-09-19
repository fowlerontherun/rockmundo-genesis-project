import { supabase } from "@/integrations/supabase/client";
import { totpRpc } from "./rpc";

export type TotpYoutubeState = "draft" | "uploading" | "scheduled" | "published" | "failed";
export type TotpYoutubePrivacy = "private" | "unlisted" | "public";

export interface TotpYoutubePublication {
  id: string;
  episode_id: string;
  manifest_checksum: string | null;
  state: TotpYoutubeState;
  title: string;
  description: string;
  tags: string[];
  privacy_status: TotpYoutubePrivacy;
  publish_at: string | null;
  source_url: string | null;
  video_id: string | null;
  watch_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function normalise(row: unknown): TotpYoutubePublication {
  const item = (row ?? {}) as Partial<TotpYoutubePublication>;
  return {
    id: String(item.id ?? ""),
    episode_id: String(item.episode_id ?? ""),
    manifest_checksum: item.manifest_checksum ?? null,
    state: (item.state ?? "draft") as TotpYoutubeState,
    title: String(item.title ?? ""),
    description: String(item.description ?? ""),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    privacy_status: (item.privacy_status ?? "private") as TotpYoutubePrivacy,
    publish_at: item.publish_at ?? null,
    source_url: item.source_url ?? null,
    video_id: item.video_id ?? null,
    watch_url: item.watch_url ?? null,
    error_message: item.error_message ?? null,
    created_at: String(item.created_at ?? ""),
    updated_at: String(item.updated_at ?? ""),
  };
}

export async function getTotpYoutubePublications(episodeId?: string | null, limit = 10): Promise<TotpYoutubePublication[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_admin_youtube_publications", {
    p_episode_id: episodeId ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message || "Could not load the planned YouTube uploads.");
  return (Array.isArray(data) ? data : []).map(normalise);
}

export interface SaveTotpYoutubePublicationInput {
  id?: string | null;
  episodeId: string;
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: TotpYoutubePrivacy;
  publishAt?: string | null;
  sourceUrl?: string | null;
  manifestChecksum?: string | null;
}

export async function saveTotpYoutubePublication(
  input: SaveTotpYoutubePublicationInput,
): Promise<TotpYoutubePublication> {
  const { data, error } = await totpRpc<unknown>("totp_admin_save_youtube_publication", {
    p_episode_id: input.episodeId,
    p_title: input.title,
    p_description: input.description ?? "",
    p_tags: input.tags ?? [],
    p_privacy_status: input.privacyStatus ?? "private",
    p_publish_at: input.publishAt ?? null,
    p_source_url: input.sourceUrl ?? null,
    p_manifest_checksum: input.manifestChecksum ?? null,
    p_id: input.id ?? null,
  });
  if (error) throw new Error(error.message || "Could not save the YouTube upload details.");
  return normalise(Array.isArray(data) ? data[0] : data);
}

export async function deleteTotpYoutubePublication(id: string): Promise<void> {
  const { error } = await totpRpc<boolean>("totp_admin_delete_youtube_publication", { p_id: id });
  if (error) throw new Error(error.message || "Could not remove the planned upload.");
}

export interface TotpYoutubePublishResult {
  publication: TotpYoutubePublication;
  videoId: string | null;
  watchUrl: string | null;
  scheduled: boolean;
  processingStatus?: string | null;
}

/** Sends the approved finished master to YouTube. A publish time schedules normal video publication. */
export async function publishTotpEpisodeToYoutube(publicationId: string): Promise<TotpYoutubePublishResult> {
  const { data, error } = await supabase.functions.invoke("totp-youtube-publish", {
    body: { publicationId },
  });
  if (error) {
    let detail = error.message;
    const context = (error as { context?: { text?: () => Promise<string> } }).context;
    if (context?.text) {
      const text = await context.text().catch(() => "");
      if (text) {
        try {
          detail = (JSON.parse(text) as { error?: string }).error ?? text;
        } catch {
          detail = text;
        }
      }
    }
    throw new Error(detail || "The upload to YouTube failed.");
  }
  const payload = (data ?? {}) as {
    publication?: unknown;
    videoId?: string | null;
    watchUrl?: string | null;
    scheduled?: boolean;
    processingStatus?: string | null;
  };
  return {
    publication: normalise(payload.publication),
    videoId: payload.videoId ?? null,
    watchUrl: payload.watchUrl ?? null,
    scheduled: Boolean(payload.scheduled),
    processingStatus: payload.processingStatus ?? null,
  };
}

export function totpYoutubeStateLabel(state: TotpYoutubeState): string {
  switch (state) {
    case "uploading":
      return "Uploading";
    case "scheduled":
      return "Publication scheduled";
    case "published":
      return "Published on YouTube";
    case "failed":
      return "Upload failed";
    default:
      return "Draft";
  }
}

/** Suggested title and description for an episode, so the admin starts from a broadcast-ready listing. */
export function suggestTotpYoutubeListing(params: {
  episodeNumber: number | null | undefined;
  episodeDate: string | null | undefined;
  presenterName?: string | null;
  acts?: { artist: string; song: string }[];
}): { title: string; description: string; tags: string[] } {
  const number = params.episodeNumber ?? 0;
  const dateLabel = params.episodeDate
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date(params.episodeDate))
    : "";
  const title = `Top of the Pops — Episode ${number}${dateLabel ? ` (${dateLabel})` : ""}`;
  const lines = [
    `Episode ${number} of Top of the Pops${dateLabel ? `, broadcast ${dateLabel}` : ""}.`,
    params.presenterName ? `Presented by ${params.presenterName}.` : null,
    (params.acts ?? []).length ? "\nRunning order:" : null,
    ...(params.acts ?? []).map((act, index) => `${index + 1}. ${act.artist} — ${act.song}`),
  ].filter(Boolean) as string[];
  return {
    title: title.slice(0, 100),
    description: lines.join("\n").slice(0, 5000),
    tags: ["Top of the Pops", "Rockmundo", "music chart show"],
  };
}
