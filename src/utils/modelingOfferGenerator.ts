import { supabase } from '@/integrations/supabase/client';

const OFFER_COOLDOWN_KEY = 'modeling_offer_cooldown';
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/** Check if cooldown has expired */
export function isOfferCooldownExpired(): boolean {
  const last = sessionStorage.getItem(OFFER_COOLDOWN_KEY);
  if (!last) return true;
  return Date.now() - parseInt(last, 10) > COOLDOWN_MS;
}

function setCooldown() {
  sessionStorage.setItem(OFFER_COOLDOWN_KEY, Date.now().toString());
}

const OFFER_REASONS = [
  (agency: string) => `${agency} spotted your look and wants you for a campaign`,
  (agency: string) => `A casting director at ${agency} thinks you're perfect for their next shoot`,
  (_: string) => `Your rising fame caught the attention of a top brand`,
  (agency: string) => `${agency} needs a fresh face for their spring collection`,
  (_: string) => `A luxury brand wants you for an exclusive editorial spread`,
  (agency: string) => `${agency} is offering a last-minute booking — interested?`,
  (_: string) => `Your social media presence impressed a major fashion house`,
];

/**
 * Generate 1-3 modeling offers for a user based on their looks/fame.
 * Returns the number of offers created.
 */
export async function generateModelingOffersForUser(
  userId: string,
  looks: number,
  fame: number,
): Promise<number> {
  // Don't generate if cooldown hasn't expired
  if (!isOfferCooldownExpired()) return 0;

  // Check existing pending offers
  const { data: pending } = await supabase
    .from('player_modeling_contracts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  if (pending && pending.length > 0) return 0;

  // Find eligible gigs
  const { data: gigs } = await supabase
    .from('modeling_gigs')
    .select('*, agency:modeling_agencies(name, tier)')
    .eq('is_available', true)
    .lte('min_looks_required', looks)
    .lte('min_fame_required', fame)
    .limit(20);

  if (!gigs || gigs.length === 0) {
    setCooldown();
    return 0;
  }

  // Shuffle and pick 1-3
  const shuffled = gigs.sort(() => Math.random() - 0.5);
  const count = Math.min(shuffled.length, Math.floor(Math.random() * 3) + 1);
  const selected = shuffled.slice(0, count);

  const offers = selected.map((gig: any) => {
    const compensation = Math.floor(
      gig.compensation_min + Math.random() * (gig.compensation_max - gig.compensation_min)
    );

    const daysToExpiry = Math.floor(Math.random() * 5) + 3; // 3-7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToExpiry);

    const agencyName = gig.agency?.name || 'An agency';
    const reason = OFFER_REASONS[Math.floor(Math.random() * OFFER_REASONS.length)](agencyName);

    return {
      user_id: userId,
      gig_id: gig.id,
      status: 'pending',
      gig_type: gig.gig_type,
      compensation,
      fame_boost: gig.fame_boost,
      expires_at: expiresAt.toISOString(),
      offer_reason: reason,
    };
  });

  const { error } = await supabase.from('player_modeling_contracts').insert(offers);

  if (error) {
    console.error('Failed to generate modeling offers:', error);
    return 0;
  }

  setCooldown();
  return offers.length;
}

/** Accept a modeling offer */
export async function acceptModelingOffer(offerId: string) {
  const { error } = await supabase
    .from('player_modeling_contracts')
    .update({ status: 'accepted' })
    .eq('id', offerId)
    .eq('status', 'pending');

  if (error) throw error;
}

/** Decline a modeling offer */
export async function declineModelingOffer(offerId: string) {
  const { error } = await supabase
    .from('player_modeling_contracts')
    .update({ status: 'declined' })
    .eq('id', offerId)
    .eq('status', 'pending');

  if (error) throw error;
}
