import { supabase } from "@/integrations/supabase/client";

export type ProfileVisibility = "public" | "friends" | "band_members" | "private";
export type SkillVisibility = "exact" | "broad" | "hidden";

export interface PlayerSocialProfile {
  profile_id: string;
  biography: string | null;
  primary_instrument: string | null;
  secondary_instruments: string[];
  preferred_genres: string[];
  preferred_roles: string[];
  vocal_capability: string | null;
  songwriting_specialisms: string[];
  status_message: string | null;
  looking_for_band: boolean;
  looking_for_members: boolean;
  available_for_session_work: boolean;
  available_for_collaboration: boolean;
  available_for_gigs: boolean;
  available_for_employment: boolean;
  available_for_teaching: boolean;
  available_for_social: boolean;
  open_to_work_status: string | null;
  open_to_band_status: string | null;
  visibility: ProfileVisibility;
  skill_visibility: SkillVisibility;
  show_online_status: boolean;
  show_last_active: boolean;
  show_city: boolean;
  show_schedule_availability: boolean;
  show_skills: boolean;
  show_career_history: boolean;
  show_employment: boolean;
  show_activity: boolean;
  show_achievements: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PlayerProfileUpdateInput extends Partial<Omit<PlayerSocialProfile, "profile_id" | "created_at" | "updated_at">> {
  profile_id: string;
}

const TAG_RE = /<[^>]*>/g;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const PROFANITY_HOOK_RE = /\b(?:fuck|shit|bitch|cunt)\b/gi;

export const BIOGRAPHY_MAX_LENGTH = 1000;
export const STATUS_MESSAGE_MAX_LENGTH = 140;
export const PROFILE_ARRAY_MAX_ITEMS = 8;
export const PROFILE_ARRAY_ITEM_MAX_LENGTH = 40;

export function sanitizeProfileText(value: string, maxLength: number) {
  return value
    .replace(TAG_RE, "")
    .replace(CONTROL_RE, "")
    .replace(URL_RE, "[link removed]")
    .replace(PROFANITY_HOOK_RE, "[moderated]")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeProfileList(values?: string[] | null) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => sanitizeProfileText(String(value), PROFILE_ARRAY_ITEM_MAX_LENGTH)).filter(Boolean))).slice(
    0,
    PROFILE_ARRAY_MAX_ITEMS,
  );
}

export function validatePlayerProfileUpdate(input: PlayerProfileUpdateInput): PlayerProfileUpdateInput {
  if (!input.profile_id) throw new Error("Profile is required before saving social identity settings.");
  const biography = input.biography == null ? input.biography : sanitizeProfileText(input.biography, BIOGRAPHY_MAX_LENGTH);
  const status_message = input.status_message == null ? input.status_message : sanitizeProfileText(input.status_message, STATUS_MESSAGE_MAX_LENGTH);
  return {
    ...input,
    biography,
    status_message,
    primary_instrument: input.primary_instrument == null ? input.primary_instrument : sanitizeProfileText(input.primary_instrument, 40),
    vocal_capability: input.vocal_capability == null ? input.vocal_capability : sanitizeProfileText(input.vocal_capability, 40),
    open_to_work_status: input.open_to_work_status == null ? input.open_to_work_status : sanitizeProfileText(input.open_to_work_status, 60),
    open_to_band_status: input.open_to_band_status == null ? input.open_to_band_status : sanitizeProfileText(input.open_to_band_status, 60),
    secondary_instruments: sanitizeProfileList(input.secondary_instruments),
    preferred_genres: sanitizeProfileList(input.preferred_genres),
    preferred_roles: sanitizeProfileList(input.preferred_roles),
    songwriting_specialisms: sanitizeProfileList(input.songwriting_specialisms),
  };
}

export async function getOwnPlayerSocialProfile(profileId: string): Promise<PlayerSocialProfile | null> {
  const { data, error } = await supabase.from("player_profiles" as any).select("*").eq("profile_id", profileId).maybeSingle();
  if (error) throw error;
  return data as unknown as PlayerSocialProfile | null;
}

export async function updatePlayerSocialProfile(input: PlayerProfileUpdateInput) {
  const cleaned = validatePlayerProfileUpdate(input);
  const { data, error } = await supabase.from("player_profiles" as any).upsert(cleaned, { onConflict: "profile_id" }).select("*").single();
  if (error) throw error;
  return data as unknown as PlayerSocialProfile;
}

export function calculateProfileCompleteness(profile: Partial<PlayerSocialProfile> | null | undefined) {
  const items = [
    { label: "Add a biography", complete: Boolean(profile?.biography?.trim()) },
    { label: "Select a primary instrument", complete: Boolean(profile?.primary_instrument) },
    { label: "Select preferred genres", complete: Boolean(profile?.preferred_genres?.length) },
    { label: "Set collaboration availability", complete: Boolean(profile?.available_for_collaboration || profile?.available_for_session_work) },
    { label: "Review privacy settings", complete: Boolean(profile?.visibility) },
  ];
  const completed = items.filter((item) => item.complete).length;
  return { items, completed, total: items.length, percent: Math.round((completed / items.length) * 100) };
}

export const __playerProfileServiceTestUtils = { sanitizeProfileText, sanitizeProfileList, validatePlayerProfileUpdate, calculateProfileCompleteness };
