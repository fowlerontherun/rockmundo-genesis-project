import { supabase } from "@/integrations/supabase/client";

type BandMembership = {
  band_id: string;
  profile_id: string | null;
  user_id: string | null;
  member_status: string | null;
  is_touring_member: boolean | null;
  joined_at: string | null;
};

export function chooseActiveBandMembership(
  memberships: BandMembership[],
  activeBandIds: ReadonlySet<string>,
  profileId?: string | null,
) {
  return memberships
    .filter(
      (membership) =>
        activeBandIds.has(membership.band_id) &&
        (membership.member_status == null ||
          membership.member_status === "active") &&
        membership.is_touring_member !== true,
    )
    .sort((left, right) => {
      const leftIsProfile = left.profile_id === profileId ? 1 : 0;
      const rightIsProfile = right.profile_id === profileId ? 1 : 0;
      if (leftIsProfile !== rightIsProfile) return rightIsProfile - leftIsProfile;
      return (right.joined_at ?? "").localeCompare(left.joined_at ?? "");
    })[0] ?? null;
}

/**
 * Resolve the character's band without relying on an embedded PostgREST join.
 * Older membership rows may only have user_id and may use NULL for the active
 * and touring flags, so both identities and those legacy values are supported.
 */
export async function resolveActiveBandMembership(
  profileId?: string | null,
  userId?: string | null,
) {
  if (!profileId && !userId) return null;

  const columns =
    "band_id, profile_id, user_id, member_status, is_touring_member, joined_at";
  const requests = [];
  if (profileId) {
    requests.push(
      supabase.from("band_members").select(columns).eq("profile_id", profileId),
    );
  }
  if (userId) {
    requests.push(
      supabase.from("band_members").select(columns).eq("user_id", userId),
    );
  }

  const results = await Promise.all(requests);
  const memberships = results.flatMap((result) =>
    result.error ? [] : ((result.data ?? []) as BandMembership[]),
  );
  const uniqueBandIds = [...new Set(memberships.map((row) => row.band_id))];
  if (!uniqueBandIds.length) return null;

  const { data: bands, error } = await supabase
    .from("bands")
    .select("id")
    .in("id", uniqueBandIds)
    .eq("status", "active");
  if (error) return null;

  return chooseActiveBandMembership(
    memberships,
    new Set((bands ?? []).map((band) => band.id)),
    profileId,
  );
}
