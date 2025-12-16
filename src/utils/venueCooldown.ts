import { supabase } from "@/integrations/supabase/client";
import { addDays, differenceInDays, isAfter } from "date-fns";

const VENUE_COOLDOWN_DAYS = 14;

export interface VenueCooldownResult {
  isOnCooldown: boolean;
  lastPlayedDate: Date | null;
  cooldownEndsAt: Date | null;
  daysRemaining: number;
}

export async function checkVenueCooldown(
  bandId: string,
  venueId: string
): Promise<VenueCooldownResult> {
  // Get the most recent gig at this venue
  const { data: recentGig } = await supabase
    .from('gigs')
    .select('scheduled_date, status')
    .eq('band_id', bandId)
    .eq('venue_id', venueId)
    .in('status', ['scheduled', 'in_progress', 'completed'])
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!recentGig) {
    return {
      isOnCooldown: false,
      lastPlayedDate: null,
      cooldownEndsAt: null,
      daysRemaining: 0,
    };
  }

  const lastPlayedDate = new Date(recentGig.scheduled_date);
  const cooldownEndsAt = addDays(lastPlayedDate, VENUE_COOLDOWN_DAYS);
  const now = new Date();

  const isOnCooldown = isAfter(cooldownEndsAt, now);
  const daysRemaining = isOnCooldown ? differenceInDays(cooldownEndsAt, now) : 0;

  return {
    isOnCooldown,
    lastPlayedDate,
    cooldownEndsAt,
    daysRemaining,
  };
}

export async function getVenueCooldowns(
  bandId: string,
  venueIds: string[]
): Promise<Map<string, VenueCooldownResult>> {
  const cooldownMap = new Map<string, VenueCooldownResult>();

  if (venueIds.length === 0) return cooldownMap;

  // Get all recent gigs for these venues
  const { data: recentGigs } = await supabase
    .from('gigs')
    .select('venue_id, scheduled_date, status')
    .eq('band_id', bandId)
    .in('venue_id', venueIds)
    .in('status', ['scheduled', 'in_progress', 'completed'])
    .order('scheduled_date', { ascending: false });

  // Group by venue and get most recent for each
  const latestByVenue = new Map<string, Date>();
  for (const gig of recentGigs || []) {
    const gigDate = new Date(gig.scheduled_date);
    const existing = latestByVenue.get(gig.venue_id);
    if (!existing || gigDate > existing) {
      latestByVenue.set(gig.venue_id, gigDate);
    }
  }

  const now = new Date();

  for (const venueId of venueIds) {
    const lastPlayedDate = latestByVenue.get(venueId) || null;
    
    if (!lastPlayedDate) {
      cooldownMap.set(venueId, {
        isOnCooldown: false,
        lastPlayedDate: null,
        cooldownEndsAt: null,
        daysRemaining: 0,
      });
      continue;
    }

    const cooldownEndsAt = addDays(lastPlayedDate, VENUE_COOLDOWN_DAYS);
    const isOnCooldown = isAfter(cooldownEndsAt, now);
    const daysRemaining = isOnCooldown ? differenceInDays(cooldownEndsAt, now) : 0;

    cooldownMap.set(venueId, {
      isOnCooldown,
      lastPlayedDate,
      cooldownEndsAt,
      daysRemaining,
    });
  }

  return cooldownMap;
}

export function getNextAvailableDateAfterCooldown(cooldownEndsAt: Date | null): Date {
  if (!cooldownEndsAt) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);
    return tomorrow;
  }

  const nextDate = new Date(cooldownEndsAt);
  nextDate.setHours(20, 0, 0, 0);
  return nextDate;
}

export const VENUE_COOLDOWN_DAYS_EXPORT = VENUE_COOLDOWN_DAYS;
