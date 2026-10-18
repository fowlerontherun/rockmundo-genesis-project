import { supabase } from "@/integrations/supabase/client";

/**
 * PostgREST cannot execute SQL subqueries inside `.or(...)`.
 * Resolve the CURRENT character's active band memberships first, and let
 * the existing song_releases / streaming_analytics_daily RLS enforce access.
 *
 * The release table stores an auth user_id, not a profile_id. Consequently
 * account-owned solo releases are still account-scoped; band memberships are
 * explicitly limited to the selected character.
 */
export const STREAMING_QUERY_PAGE_SIZE = 500;
export const STREAMING_ANALYTICS_ID_BATCH = 100;

const isUuid = (value: string) =>
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value);

export async function getStreamingBandIds(userId: string, profileId: string): Promise<string[]> {
  if (!userId || !profileId) return [];
  const { data, error } = await supabase
    .from("band_members")
    .select("band_id")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .eq("member_status", "active");

  if (error) throw error;
  return [...new Set((data ?? []).map((member) => member.band_id).filter((id): id is string => !!id && isUuid(id)))];
}

/**
 * Paginate releases rather than silently truncating data at the Data API's
 * max-row setting. All filter values originate from UUID-typed DB columns
 * or the authenticated user id; no SQL or user-authored filter expressions.
 */
export async function getOwnedStreamingReleases(
  userId: string,
  profileId: string,
  columns = "*",
): Promise<any[]> {
  if (!userId || !profileId) return [];
  if (!isUuid(userId)) throw new Error("Invalid authenticated user identifier");
  const bands = await getStreamingBandIds(userId, profileId);
  const rows: any[] = [];

  for (let offset = 0; ; offset += STREAMING_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("song_releases")
      .select(columns)
      .eq("release_type", "streaming")
      .order("release_date", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + STREAMING_QUERY_PAGE_SIZE - 1);

    if (bands.length > 0) {
      // Comma-separated UUID literals are supported in PostgREST's in.(...).
      // SQL subqueries are not.
      query = query.or(`user_id.eq.${userId},band_id.in.(${bands.join(",")})`);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < STREAMING_QUERY_PAGE_SIZE) break;
  }

  return rows;
}

/** Fetch *every* analytics row for these releases, in bounded network pages. */
export async function getStreamingAnalyticsForReleases(
  releaseIds: string[],
  columns: string,
  perBatchLimit?: number,
): Promise<any[]> {
  if (!releaseIds.length) return [];
  const all: any[] = [];
  for (let i = 0; i < releaseIds.length; i += STREAMING_ANALYTICS_ID_BATCH) {
    const batch = releaseIds.slice(i, i + STREAMING_ANALYTICS_ID_BATCH);
    const batchRows: any[] = [];
    for (let offset = 0; ; offset += STREAMING_QUERY_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("streaming_analytics_daily")
        .select(columns)
        .in("song_release_id", batch)
        .order("analytics_date", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + STREAMING_QUERY_PAGE_SIZE - 1);
      if (error) throw error;
      batchRows.push(...(data ?? []));
      if (!data || data.length < STREAMING_QUERY_PAGE_SIZE || (perBatchLimit && batchRows.length >= perBatchLimit)) break;
    }
    all.push(...(perBatchLimit ? batchRows.slice(0, perBatchLimit) : batchRows));
  }
  return all;
}
