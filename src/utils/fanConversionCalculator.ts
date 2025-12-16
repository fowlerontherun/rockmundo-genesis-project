import { supabase } from "@/integrations/supabase/client";

export interface FanConversionInput {
  gigId: string;
  bandId: string;
  venueId: string;
  actualAttendance: number;
  overallRating: number;
  performanceGrade: string;
  bandFame: number;
}

export interface FanConversionResult {
  newFansGained: number;
  casualFans: number;
  dedicatedFans: number;
  superfans: number;
  repeatAttendees: number;
  conversionRate: number;
  cityName: string;
}

// Fan conversion constants
const BASE_CONVERSION_RATE = 0.05; // 5% base conversion
const GRADE_MULTIPLIERS: Record<string, number> = {
  'S+': 2.5,
  'S': 2.0,
  'A': 1.5,
  'B': 1.2,
  'C': 1.0,
  'D': 0.6,
  'F': 0.3,
};

/**
 * Calculate fan conversions from a gig
 */
export async function calculateFanConversion(input: FanConversionInput): Promise<FanConversionResult> {
  const {
    gigId,
    bandId,
    venueId,
    actualAttendance,
    overallRating,
    performanceGrade,
    bandFame,
  } = input;

  // Get venue city info
  const { data: venue } = await supabase
    .from('venues')
    .select('city_id, location')
    .eq('id', venueId)
    .single();

  let cityId: string | null = null;
  let cityName = venue?.location || 'Unknown City';

  if (venue?.city_id) {
    cityId = venue.city_id;
    const { data: city } = await supabase
      .from('cities')
      .select('name')
      .eq('id', cityId)
      .single();
    if (city) cityName = city.name;
  }

  // Check existing city fans for repeat attendee calculation
  const { data: existingCityFans } = await supabase
    .from('band_city_fans')
    .select('total_fans, gigs_in_city')
    .eq('band_id', bandId)
    .eq('city_id', cityId)
    .maybeSingle();

  const gigsInCity = (existingCityFans?.gigs_in_city || 0) + 1;
  const existingFans = existingCityFans?.total_fans || 0;

  // Calculate repeat attendees (existing fans who came back)
  const repeatAttendeeRate = Math.min(0.8, gigsInCity * 0.1 + (bandFame / 10000) * 0.3);
  const repeatAttendees = Math.floor(Math.min(existingFans, actualAttendance * repeatAttendeeRate));

  // New potential fans are attendance minus repeat attendees
  const newPotentialFans = Math.max(0, actualAttendance - repeatAttendees);

  // Calculate conversion rate based on performance
  const gradeMultiplier = GRADE_MULTIPLIERS[performanceGrade] || 1.0;
  const ratingBonus = (overallRating / 25) * 0.1; // Up to 10% bonus
  const fameBonus = Math.min(0.05, bandFame / 50000); // Up to 5% fame bonus
  
  const conversionRate = Math.min(0.35, (BASE_CONVERSION_RATE + ratingBonus + fameBonus) * gradeMultiplier);

  // Calculate new fans gained
  const newFansGained = Math.floor(newPotentialFans * conversionRate);

  // Distribute fans into tiers based on rating
  const superfanRate = overallRating >= 22 ? 0.1 : overallRating >= 18 ? 0.05 : 0.02;
  const dedicatedRate = overallRating >= 18 ? 0.25 : overallRating >= 14 ? 0.15 : 0.1;
  const casualRate = 1 - superfanRate - dedicatedRate;

  const superfans = Math.floor(newFansGained * superfanRate);
  const dedicatedFans = Math.floor(newFansGained * dedicatedRate);
  const casualFans = newFansGained - superfans - dedicatedFans;

  // Record fan conversion
  await supabase
    .from('gig_fan_conversions')
    .upsert({
      gig_id: gigId,
      band_id: bandId,
      attendance_count: actualAttendance,
      new_fans_gained: newFansGained,
      repeat_fans: repeatAttendees,
      superfans_converted: superfans,
      conversion_rate: conversionRate * 100,
      fan_demographics: {
        city: cityName,
        casual: casualFans,
        dedicated: dedicatedFans,
        superfans: superfans,
      },
    }, { onConflict: 'gig_id' });

  // Update or create city fans record
  if (cityId) {
    const newTotalFans = existingFans + newFansGained;
    const newCasualFans = (existingCityFans as any)?.casual_fans || 0 + casualFans;
    const newDedicatedFans = (existingCityFans as any)?.dedicated_fans || 0 + dedicatedFans;
    const newSuperfans = (existingCityFans as any)?.superfans || 0 + superfans;

    await supabase
      .from('band_city_fans')
      .upsert({
        band_id: bandId,
        city_id: cityId,
        city_name: cityName,
        total_fans: newTotalFans,
        casual_fans: newCasualFans,
        dedicated_fans: newDedicatedFans,
        superfans: newSuperfans,
        last_gig_date: new Date().toISOString(),
        gigs_in_city: gigsInCity,
        avg_satisfaction: overallRating * 4,
      }, { onConflict: 'band_id,city_id' });
  }

  // Update band's total fan counts
  const { data: band } = await supabase
    .from('bands')
    .select('total_fans, casual_fans, dedicated_fans, superfans')
    .eq('id', bandId)
    .single();

  if (band) {
    await supabase
      .from('bands')
      .update({
        total_fans: (band.total_fans || 0) + newFansGained,
        casual_fans: (band.casual_fans || 0) + casualFans,
        dedicated_fans: (band.dedicated_fans || 0) + dedicatedFans,
        superfans: (band.superfans || 0) + superfans,
      })
      .eq('id', bandId);
  }

  // Update gig outcome with fan data
  await supabase
    .from('gig_outcomes')
    .update({
      fan_conversions: newFansGained,
      casual_fans_gained: casualFans,
      dedicated_fans_gained: dedicatedFans,
      superfans_gained: superfans,
      repeat_attendees: repeatAttendees,
    })
    .eq('gig_id', gigId);

  return {
    newFansGained,
    casualFans,
    dedicatedFans,
    superfans,
    repeatAttendees,
    conversionRate: conversionRate * 100,
    cityName,
  };
}
