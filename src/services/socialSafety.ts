import { supabase } from "@/integrations/supabase/client";

export const BLOCK_REASON_OPTIONS = [
  { value: "unwanted_contact", label: "Unwanted contact" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "scam_attempt", label: "Scam attempt" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "threatening_behaviour", label: "Threatening behaviour" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const REPORT_CATEGORIES = [
  { value: "harassment_bullying", label: "Harassment or bullying", priority: "normal" },
  { value: "threats_intimidation", label: "Threats or intimidation", priority: "high", emergency: true },
  { value: "hate_discriminatory_abuse", label: "Hate or discriminatory abuse", priority: "high" },
  { value: "sexual_inappropriate_content", label: "Sexual or inappropriate content", priority: "normal" },
  { value: "spam", label: "Spam", priority: "low" },
  { value: "scam_fraud", label: "Scam or fraud attempt", priority: "high" },
  { value: "impersonation", label: "Impersonation", priority: "normal" },
  { value: "cheating_exploit_abuse", label: "Cheating or exploit abuse", priority: "normal" },
  { value: "offensive_profile_content", label: "Offensive profile content", priority: "normal" },
  { value: "inappropriate_name", label: "Inappropriate character or band name", priority: "normal" },
  { value: "personal_information", label: "Real-world personal information", priority: "high" },
  { value: "ban_evasion", label: "Ban evasion", priority: "high" },
  { value: "other", label: "Other", priority: "normal" },
] as const;

export type BlockReasonCategory = (typeof BLOCK_REASON_OPTIONS)[number]["value"];
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["value"];

export interface SocialPermissions {
  can_view_profile: boolean;
  can_send_friend_request: boolean;
  can_message: boolean;
  can_invite_to_band: boolean;
  can_invite_to_activity: boolean;
  can_offer_job: boolean;
  can_send_money: boolean;
  can_send_item: boolean;
  can_report: boolean;
  is_blocked_by_viewer: boolean;
  is_interaction_restricted: boolean;
  neutral_message?: string | null;
}

export interface BlockedPlayerSummary {
  id: string;
  blockedProfileId: string;
  characterName: string;
  username?: string | null;
  avatarUrl?: string | null;
  reasonCategory?: BlockReasonCategory | null;
  createdAt: string;
}

export interface MyReportSummary {
  id: string;
  category: ReportCategory;
  contentType: string;
  status: string;
  priority: string;
  submittedAt: string;
  updatedAt: string;
  resolutionSummary?: string | null;
  reportedPlayerName?: string | null;
}

export async function getSocialPermissions(targetProfileId: string): Promise<SocialPermissions> {
  const { data, error } = await (supabase as any).rpc("get_social_permissions", { target_profile_id: targetProfileId });
  if (error) throw new Error("This player is unavailable.");
  return data as SocialPermissions;
}

export async function blockPlayer(targetProfileId: string, reasonCategory?: BlockReasonCategory | null, privateNote?: string | null) {
  const { data, error } = await (supabase as any).rpc("block_player", { target_profile_id: targetProfileId, reason_category: reasonCategory ?? null, private_note: privateNote ?? null });
  if (error) throw new Error(/self/i.test(error.message) ? "You cannot block yourself." : "We couldn't block this player. Please try again.");
  window.dispatchEvent(new CustomEvent("rockmundo:analytics", { detail: { event: "player_blocked", area: "social_safety" } }));
  return data;
}

export async function unblockPlayer(targetProfileId: string) {
  const { error } = await (supabase as any).rpc("unblock_player", { target_profile_id: targetProfileId });
  if (error) throw new Error("We couldn't unblock this player. Please try again.");
  window.dispatchEvent(new CustomEvent("rockmundo:analytics", { detail: { event: "player_unblocked", area: "social_safety" } }));
}

export async function listBlockedPlayers(search = ""): Promise<BlockedPlayerSummary[]> {
  const { data, error } = await (supabase as any).from("player_blocks").select("id, blocked_id, reason_category, created_at, blocked:profiles!player_blocks_blocked_id_fkey(id, username, display_name, avatar_url)").is("removed_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Safety settings are unavailable.");
  return ((data ?? []) as any[]).map((row) => ({ id: row.id, blockedProfileId: row.blocked_id, characterName: row.blocked?.display_name || row.blocked?.username || "Unavailable player", username: row.blocked?.username, avatarUrl: row.blocked?.avatar_url, reasonCategory: row.reason_category, createdAt: row.created_at })).filter((row) => !search || `${row.characterName} ${row.username ?? ""}`.toLowerCase().includes(search.toLowerCase()));
}

export async function submitPlayerReport(input: { targetProfileId: string; category: ReportCategory; description: string; contentType?: string; contentId?: string | null; subcategory?: string | null; blockAfterReport?: boolean; evidence?: Record<string, unknown>; }) {
  const { data, error } = await (supabase as any).rpc("submit_player_report", { target_profile_id: input.targetProfileId, category: input.category, description: input.description, content_type: input.contentType ?? "player_profile", content_id: input.contentId ?? null, subcategory: input.subcategory ?? null, evidence: input.evidence ?? {}, block_after_report: input.blockAfterReport ?? false });
  if (error) throw new Error(/wait|duplicate/i.test(error.message) ? error.message : "We couldn't submit this report. Please review the form and try again.");
  window.dispatchEvent(new CustomEvent("rockmundo:analytics", { detail: { event: input.blockAfterReport ? "block_and_report_selected" : "report_submitted", area: "social_safety", category: input.category } }));
  return data;
}

export async function listMyReports(): Promise<MyReportSummary[]> {
  const { data, error } = await (supabase as any).from("player_reports").select("id, category, content_type, status, priority, submitted_at, updated_at, resolution_summary, reported:profiles!player_reports_reported_player_id_fkey(display_name, username)").order("submitted_at", { ascending: false }).limit(100);
  if (error) throw new Error("Reports are unavailable.");
  return ((data ?? []) as any[]).map((row) => ({ id: row.id, category: row.category, contentType: row.content_type, status: row.status, priority: row.priority, submittedAt: row.submitted_at, updatedAt: row.updated_at, resolutionSummary: row.resolution_summary, reportedPlayerName: row.reported?.display_name || row.reported?.username || "Reported content" }));
}
