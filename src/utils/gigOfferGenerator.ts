import { supabase } from '@/integrations/supabase/client';

/**
 * AI Gig Offer Generator
 * Creates realistic booking offers based on band stats, promoter availability, and venue schedules
 */

interface OfferCriteria {
  minFame?: number;
  maxFame?: number;
  genreMatch?: string[];
  qualityTier?: string;
}

/**
 * Generate gig offers for a specific band
 */
export async function generateGigOffersForBand(bandId: string, count: number = 3): Promise<void> {
  const { data: band } = await supabase
    .from('bands')
    .select('fame, genre')
    .eq('id', bandId)
    .single();

  if (!band) return;

  // Determine slot type based on fame
  let slotType = 'support';
  if (band.fame > 5000) slotType = 'headline';
  else if (band.fame > 2000) slotType = 'support';
  else if (band.fame > 500) slotType = 'opening';
  else slotType = 'kids';

  // Find appropriate promoters
  const { data: promoters } = await supabase
    .from('promoters')
    .select('*')
    .eq('active', true)
    .limit(10);

  if (!promoters || promoters.length === 0) return;

  // Find available venues
  const { data: venues } = await supabase
    .from('venues')
    .select('*')
    .limit(20);

  if (!venues || venues.length === 0) return;

  const offers = [];

  for (let i = 0; i < count; i++) {
    const promoter = promoters[Math.floor(Math.random() * promoters.length)];
    const venue = venues[Math.floor(Math.random() * venues.length)];

    // Generate offer date (1-14 days from now)
    const daysAhead = Math.floor(Math.random() * 14) + 1;
    const offeredDate = new Date();
    offeredDate.setDate(offeredDate.getDate() + daysAhead);

    // Calculate base payout based on fame and venue
    const fameMultiplier = 1 + (band.fame / 10000);
    const venueMultiplier = venue.economy_factor || 1.0;
    const basePayout = Math.floor(500 * fameMultiplier * venueMultiplier);

    // Ticket price based on slot
    const ticketPrice = {
      kids: 10,
      opening: 15,
      support: 20,
      headline: 30,
    }[slotType] || 20;

    // Offer expires in 3-7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Math.floor(Math.random() * 4) + 3);

    // Generate offer reason
    const reasons = [
      `${promoter.name} thinks your sound fits ${venue.name} perfectly`,
      `We need a ${slotType} act for our ${offeredDate.toLocaleDateString()} show`,
      `Your recent performance caught our attention`,
      `Perfect opportunity to build your fanbase in ${venue.name}'s area`,
      `Last-minute opening - interested in filling the ${slotType} slot?`,
    ];

    offers.push({
      band_id: bandId,
      venue_id: venue.id,
      promoter_id: promoter.id,
      offered_date: offeredDate.toISOString(),
      slot_type: slotType,
      base_payout: basePayout,
      ticket_price: ticketPrice,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
      offer_reason: reasons[Math.floor(Math.random() * reasons.length)],
      metadata: {
        venue_name: venue.name,
        promoter_name: promoter.name,
        generated_at: new Date().toISOString(),
      },
    });
  }

  if (offers.length > 0) {
    await supabase.from('gig_offers').insert(offers);
  }
}

/**
 * Accept a gig offer and create actual gig
 */
export async function acceptGigOffer(offerId: string): Promise<{ gigId: string | null; error: string | null }> {
  const { data: offer } = await supabase
    .from('gig_offers')
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer) return { gigId: null, error: 'Offer not found' };
  if (offer.status !== 'pending') return { gigId: null, error: 'Offer is no longer available' };
  if (new Date(offer.expires_at) < new Date()) return { gigId: null, error: 'Offer has expired' };

  // Check for conflicts
  const { data: conflicts } = await supabase
    .from('gigs')
    .select('id')
    .eq('band_id', offer.band_id)
    .eq('scheduled_date', offer.offered_date)
    .neq('status', 'cancelled');

  if (conflicts && conflicts.length > 0) {
    return { gigId: null, error: 'Band already has a gig scheduled at this time' };
  }

  // Create gig
  const { data: gig, error: gigError } = await supabase
    .from('gigs')
    .insert({
      band_id: offer.band_id,
      venue_id: offer.venue_id,
      promoter_id: offer.promoter_id,
      scheduled_date: offer.offered_date,
      slot_type: offer.slot_type,
      ticket_price: offer.ticket_price,
      status: 'scheduled',
    })
    .select()
    .single();

  if (gigError || !gig) {
    return { gigId: null, error: gigError?.message || 'Failed to create gig' };
  }

  // Update offer status
  await supabase
    .from('gig_offers')
    .update({ status: 'accepted' })
    .eq('id', offerId);

  return { gigId: gig.id, error: null };
}

/**
 * Reject a gig offer
 */
export async function rejectGigOffer(offerId: string): Promise<void> {
  await supabase
    .from('gig_offers')
    .update({ status: 'rejected' })
    .eq('id', offerId);
}

/**
 * Detect scheduling conflicts
 */
export async function detectGigConflicts(bandId: string): Promise<any[]> {
  const { data: gigs } = await supabase
    .from('gigs')
    .select('*')
    .eq('band_id', bandId)
    .in('status', ['scheduled', 'in_progress'])
    .order('scheduled_date');

  if (!gigs || gigs.length < 2) return [];

  const conflicts = [];

  for (let i = 0; i < gigs.length - 1; i++) {
    for (let j = i + 1; j < gigs.length; j++) {
      const date1 = new Date(gigs[i].scheduled_date);
      const date2 = new Date(gigs[j].scheduled_date);
      const hoursDiff = Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60);

      if (hoursDiff < 6) { // Less than 6 hours apart
        conflicts.push({
          conflict_type: 'double_booking',
          gig_id_1: gigs[i].id,
          gig_id_2: gigs[j].id,
          band_id: bandId,
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  if (conflicts.length > 0) {
    await supabase.from('band_conflicts').insert(conflicts);
  }

  return conflicts;
}
