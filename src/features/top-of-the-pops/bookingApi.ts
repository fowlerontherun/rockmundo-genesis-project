import { totpRpc } from "./rpc";

export interface TotpAdminBookingSong {
  song_id: string;
  song_title: string;
  qualifying_rank: number;
  qualifying_chart: "streaming" | "digital_sales" | "both" | string;
}

export interface TotpAdminBookingInvitation {
  invitation_id: string;
  status: string;
  song_id: string;
  qualifying_rank: number;
  response_deadline: string;
}

export interface TotpAdminBookingCandidate {
  band_id: string;
  band_name: string;
  genre: string;
  best_rank: number;
  previous_episode_performer: boolean;
  eligible: boolean;
  ineligible_reason: string | null;
  invitation: TotpAdminBookingInvitation | null;
  songs: TotpAdminBookingSong[];
}

export interface TotpAdminBookingCatalog {
  episode_id: string;
  episode_number: number;
  episode_date: string;
  episode_status: string;
  configured_snapshot_date: string | null;
  source_snapshot_date: string | null;
  provisional_snapshot: boolean;
  max_performances: number;
  booked_slots: number;
  available_slots: number;
  candidates: TotpAdminBookingCandidate[];
}

export interface TotpAdminBookingResult {
  status: "booked" | "already_booked" | string;
  invitation_id: string;
  invitation_status: string;
  band_id: string;
  band_name?: string;
  song_id: string;
  song_title?: string;
  qualifying_rank: number;
  qualifying_chart?: string;
  response_deadline?: string;
  chart_snapshot_date?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredUuid(value: string, label: string): string {
  const normalized = value?.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new Error(`Choose a valid ${label}.`);
  }
  return normalized;
}

export async function getTotpAdminBookingCatalog(episodeId: string): Promise<TotpAdminBookingCatalog> {
  const { data, error } = await totpRpc<TotpAdminBookingCatalog>("totp_admin_booking_catalog", {
    p_episode_id: requiredUuid(episodeId, "Top of the Pops episode"),
  });
  if (error) throw new Error(error.message || "Could not load the Top of the Pops booking pool.");
  if (!data) throw new Error("Top of the Pops returned no booking pool.");
  return data;
}

export async function adminBookTotpBand(
  episodeId: string,
  bandId: string,
  songId: string,
): Promise<TotpAdminBookingResult> {
  const { data, error } = await totpRpc<TotpAdminBookingResult>("totp_admin_book_band", {
    p_episode_id: requiredUuid(episodeId, "Top of the Pops episode"),
    p_band_id: requiredUuid(bandId, "band"),
    p_song_id: requiredUuid(songId, "song"),
  });
  if (error) throw new Error(error.message || "Could not book the band for Top of the Pops.");
  if (!data) throw new Error("Top of the Pops returned no booking result.");
  return data;
}
