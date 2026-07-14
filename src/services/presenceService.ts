import { supabase } from "@/integrations/supabase/client";

export type PlayerPresenceState = "online" | "idle" | "busy" | "travelling" | "recording" | "rehearsing" | "performing" | "working" | "offline" | "recently_online";

export interface PresencePlayer {
  id: string;
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  cityName?: string | null;
  presence: PlayerPresenceState;
  activity?: string | null;
  activityDetail?: string | null;
  lastSeenAt?: string | null;
  availableForCollaboration?: boolean;
}

export interface PresenceDirectory {
  friends: PresencePlayer[];
  city: PresencePlayer[];
  recentlyActive: PresencePlayer[];
  collaborating: PresencePlayer[];
  counts: Record<Exclude<PlayerPresenceState, "offline">, number>;
}

type StatusRow = { profile_id: string; activity_type: string; status: string; started_at?: string | null; updated_at?: string | null; ends_at?: string | null; metadata?: any };
type ProfileRow = { id: string; user_id?: string | null; username?: string | null; display_name?: string | null; avatar_url?: string | null; city_name?: string | null; current_city_id?: string | null; updated_at?: string | null; looking_for_band?: boolean | null; available_for_collaboration?: boolean | null };

export const PRESENCE_LABELS: Record<PlayerPresenceState, string> = {
  online: "Online",
  idle: "Idle",
  busy: "Busy",
  travelling: "Travelling",
  recording: "Recording",
  rehearsing: "Rehearsing",
  performing: "Performing",
  working: "Working",
  offline: "Offline",
  recently_online: "Recently Online",
};

const RECENT_MINUTES = 60 * 24;

export function normalizePresenceState(activityType?: string | null, status?: string | null, isRealtimeOnline = false, lastSeenAt?: string | null): PlayerPresenceState {
  const raw = `${activityType ?? ""} ${status ?? ""}`.toLowerCase();
  if (raw.includes("travel")) return "travelling";
  if (raw.includes("record")) return "recording";
  if (raw.includes("rehears") || raw.includes("practice")) return "rehearsing";
  if (raw.includes("gig") || raw.includes("perform") || raw.includes("concert")) return "performing";
  if (raw.includes("work") || raw.includes("job") || raw.includes("company")) return "working";
  if (raw.includes("busy")) return "busy";
  if (raw.includes("idle") || raw.includes("away")) return "idle";
  if (isRealtimeOnline) return "online";
  if (lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < RECENT_MINUTES * 60_000) return "recently_online";
  return "offline";
}

export function describeActivity(row?: StatusRow | null): string | null {
  if (!row) return null;
  const raw = `${row.activity_type} ${row.status}`.toLowerCase();
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  if (raw.includes("travel")) return meta.destination_city_name ? `Travelling to ${meta.destination_city_name}` : "Travelling";
  if (raw.includes("record")) return meta.song_title ? `Recording “${meta.song_title}”` : "Recording new music";
  if (raw.includes("rehears") || raw.includes("practice")) return meta.skill_name ? `Practising ${meta.skill_name}` : "Rehearsing";
  if (raw.includes("gig") || raw.includes("perform")) return meta.venue_name ? `Playing a gig at ${meta.venue_name}` : "Performing a gig";
  if (raw.includes("company")) return "Working at a company";
  if (raw.includes("band_recruitment")) return "Looking for members";
  return row.status ? row.status.replace(/_/g, " ") : row.activity_type.replace(/_/g, " ");
}

export function mergePresenceProfiles(profiles: ProfileRow[], statuses: StatusRow[], onlineUserIds: Set<string>): PresencePlayer[] {
  const statusByProfile = new Map(statuses.map((status) => [status.profile_id, status]));
  return profiles.map((profile) => {
    const status = statusByProfile.get(profile.id);
    const lastSeenAt = status?.updated_at ?? status?.started_at ?? profile.updated_at ?? null;
    return {
      id: profile.id,
      userId: profile.user_id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      cityName: profile.city_name,
      presence: normalizePresenceState(status?.activity_type, status?.status, !!profile.user_id && onlineUserIds.has(profile.user_id), lastSeenAt),
      activity: describeActivity(status),
      activityDetail: status?.activity_type ?? null,
      lastSeenAt,
      availableForCollaboration: Boolean(profile.available_for_collaboration ?? profile.looking_for_band),
    };
  });
}

export async function fetchPresenceDirectory(viewerProfileId?: string | null, cityId?: string | null, onlineUserIds: Set<string> = new Set()): Promise<PresenceDirectory> {
  const friendIds = new Set<string>();
  if (viewerProfileId) {
    const { data } = await supabase.from("friendships").select("requestor_id, addressee_id, status").or(`requestor_id.eq.${viewerProfileId},addressee_id.eq.${viewerProfileId}`).eq("status", "accepted");
    (data ?? []).forEach((row: any) => friendIds.add(row.requestor_id === viewerProfileId ? row.addressee_id : row.requestor_id));
  }

  const profileIds = Array.from(friendIds);
  let profilesQuery = (supabase as any).from("profiles").select("id,user_id,username,display_name,avatar_url,city_name,current_city_id,updated_at,looking_for_band").limit(36);
  if (cityId) profilesQuery = profilesQuery.eq("current_city_id", cityId);
  const [cityProfiles, friendProfiles, statusesResult] = await Promise.all([
    profilesQuery,
    profileIds.length ? (supabase as any).from("profiles").select("id,user_id,username,display_name,avatar_url,city_name,current_city_id,updated_at,looking_for_band").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("profile_activity_statuses").select("profile_id,activity_type,status,started_at,updated_at,ends_at,metadata").is("completed_at", null).order("updated_at", { ascending: false }).limit(120),
  ]);
  if (cityProfiles.error) throw cityProfiles.error;
  if ((friendProfiles as any).error) throw (friendProfiles as any).error;
  if (statusesResult.error) throw statusesResult.error;
  const statuses = (statusesResult.data ?? []) as StatusRow[];
  const map = new Map<string, ProfileRow>();
  [...((cityProfiles.data ?? []) as unknown as ProfileRow[]), ...(((friendProfiles as any).data ?? []) as unknown as ProfileRow[])].forEach((p) => map.set(p.id, p));
  const players = mergePresenceProfiles(Array.from(map.values()), statuses, onlineUserIds).filter((p) => p.id !== viewerProfileId);
  const activeRank = (p: PresencePlayer) => p.presence === "offline" ? 2 : p.presence === "recently_online" ? 1 : 0;
  const sorted = [...players].sort((a, b) => activeRank(a) - activeRank(b));
  const counts = { online: 0, idle: 0, busy: 0, travelling: 0, recording: 0, rehearsing: 0, performing: 0, working: 0, recently_online: 0 };
  sorted.forEach((p) => { if (p.presence !== "offline") counts[p.presence] += 1; });
  return { friends: sorted.filter((p) => friendIds.has(p.id)).slice(0, 12), city: sorted.filter((p) => p.presence !== "offline").slice(0, 18), recentlyActive: sorted.filter((p) => p.presence === "recently_online" || p.presence === "offline").slice(0, 8), collaborating: sorted.filter((p) => p.availableForCollaboration).slice(0, 8), counts };
}
