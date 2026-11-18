import { supabase } from '@/integrations/supabase/client';

type SecureModelingRpc = {
  rpc(name: string, params: Record<string, string>): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};
const modelingRpc = supabase as unknown as SecureModelingRpc;

const OFFER_COOLDOWN_KEY = 'modeling_offer_cooldown';
const cooldownKey = (profileId: string) => `${OFFER_COOLDOWN_KEY}:${profileId}`;
const COOLDOWN_MS = 10 * 60 * 1000;

// UI throttle only. The database independently enforces character ownership,
// catalogue eligibility, immutable offer terms and a per-profile cooldown.
export function isOfferCooldownExpired(profileId: string): boolean {
  const last = sessionStorage.getItem(cooldownKey(profileId));
  return !last || Date.now() - Number(last) > COOLDOWN_MS;
}

/** Generate server-authoritative offers for the selected character. */
export async function generateModelingOffersForUser(profileId: string): Promise<number> {
  if (!isOfferCooldownExpired(profileId)) return 0;
  // Never choose compensation or insert modeling contracts from the browser.
  const { data, error } = await modelingRpc.rpc('generate_modeling_offers_secure', {
    p_profile_id: profileId,
  });
  if (error) throw error;
  if (typeof data !== 'number' || !Number.isInteger(data) || data < 0 || data > 3) {
    throw new Error('The modeling offers service returned an invalid response.');
  }
  sessionStorage.setItem(cooldownKey(profileId), String(Date.now()));
  return data;
}

/** Decline a pending offer without permitting direct contract mutations. */
export async function declineModelingOffer(offerId: string): Promise<void> {
  const { data, error } = await modelingRpc.rpc('decline_modeling_offer_secure', {
    p_offer_id: offerId,
  });
  if (error) throw error;
  if (data !== true) throw new Error('This offer is no longer available.');
}

export async function bookModelingOfferAtomic(input: {
  offerId: string;
  profileId: string;
  startIso: string;
  endIso: string;
  shootDate: string;
}): Promise<{ activityId: string; compensation: number }> {
  const { data, error } = await modelingRpc.rpc('book_modeling_offer_atomic', {
    p_offer_id: input.offerId,
    p_profile_id: input.profileId,
    p_start: input.startIso,
    p_end: input.endIso,
    p_shoot_date: input.shootDate,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object' || !('booked' in data) ||
      data.booked !== true || !('activity_id' in data) ||
      typeof data.activity_id !== 'string' || !('compensation_amount' in data) ||
      typeof data.compensation_amount !== 'number') {
    throw new Error('The shoot could not be booked. Please retry.');
  }
  return { activityId: data.activity_id, compensation: data.compensation_amount };
}
