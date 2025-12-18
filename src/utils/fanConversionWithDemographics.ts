import { supabase } from "@/integrations/supabase/client";
import { isValidGenre } from "@/data/genres";

export interface FanConversionInput {
  gigId: string;
  bandId: string;
  venueId: string;
  actualAttendance: number;
  overallRating: number;
  performanceGrade: string;
  bandFame: number;
  bandGenre?: string;
}

export interface FanConversionResult {
  newFansGained: number;
  casualFans: number;
  dedicatedFans: number;
  superfans: number;
  repeatAttendees: number;
  conversionRate: number;
  cityName: string;
  countrySpillover: number;
  demographicBreakdown: Record<string, number>;
}

// Fan conversion constants
const BASE_CONVERSION_RATE = 0.05;
const GRADE_MULTIPLIERS: Record<string, number> = {
  'S+': 2.5, 'S': 2.0, 'A': 1.5, 'B': 1.2, 'C': 1.0, 'D': 0.6, 'F': 0.3,
};

// Spillover rates
const COUNTRY_SPILLOVER_RATE = 0.10; // 10% spillover to other cities in same country
const NEIGHBORING_COUNTRY_RATE = 0.05; // 5% to neighboring countries
const GLOBAL_SPILLOVER_RATE = 0.01; // 1% global for major events

interface AgeDemographic {
  id: string;
  name: string;
  genre_preferences: Record<string, number>;
}

/**
 * Calculate fan conversions with demographic distribution and regional spillover
 */
export async function calculateFanConversionWithDemographics(
  input: FanConversionInput
): Promise<FanConversionResult> {
  const {
    gigId, bandId, venueId, actualAttendance,
    overallRating, performanceGrade, bandFame, bandGenre,
  } = input;

  // Get venue and city info
  const { data: venue } = await supabase
    .from('venues')
    .select('city_id, location')
    .eq('id', venueId)
    .single();

  let cityId: string | null = null;
  let cityName = venue?.location || 'Unknown City';
  let country = 'Unknown';

  if (venue?.city_id) {
    cityId = venue.city_id;
    const { data: city } = await supabase
      .from('cities')
      .select('name, country')
      .eq('id', cityId)
      .single();
    if (city) {
      cityName = city.name;
      country = city.country;
    }
  }

  // Get existing city fans
  const { data: existingCityFans } = await supabase
    .from('band_city_fans')
    .select('total_fans, gigs_in_city, casual_fans, dedicated_fans, superfans')
    .eq('band_id', bandId)
    .eq('city_id', cityId)
    .maybeSingle();

  const gigsInCity = (existingCityFans?.gigs_in_city || 0) + 1;
  const existingFans = existingCityFans?.total_fans || 0;

  // Calculate repeat attendees
  const repeatAttendeeRate = Math.min(0.8, gigsInCity * 0.1 + (bandFame / 10000) * 0.3);
  const repeatAttendees = Math.floor(Math.min(existingFans, actualAttendance * repeatAttendeeRate));
  const newPotentialFans = Math.max(0, actualAttendance - repeatAttendees);

  // Calculate conversion rate
  const gradeMultiplier = GRADE_MULTIPLIERS[performanceGrade] || 1.0;
  const ratingBonus = (overallRating / 25) * 0.1;
  const fameBonus = Math.min(0.05, bandFame / 50000);
  const conversionRate = Math.min(0.35, (BASE_CONVERSION_RATE + ratingBonus + fameBonus) * gradeMultiplier);

  // Calculate new fans gained
  const newFansGained = Math.floor(newPotentialFans * conversionRate);

  // Distribute fans into tiers
  const superfanRate = overallRating >= 22 ? 0.1 : overallRating >= 18 ? 0.05 : 0.02;
  const dedicatedRate = overallRating >= 18 ? 0.25 : overallRating >= 14 ? 0.15 : 0.1;
  const casualRate = 1 - superfanRate - dedicatedRate;

  const superfans = Math.floor(newFansGained * superfanRate);
  const dedicatedFans = Math.floor(newFansGained * dedicatedRate);
  const casualFans = newFansGained - superfans - dedicatedFans;

  // Fetch age demographics
  const { data: demographics } = await supabase
    .from('age_demographics')
    .select('id, name, genre_preferences');

  const demographicBreakdown: Record<string, number> = {};
  
  if (demographics && demographics.length > 0 && bandGenre) {
    // Distribute fans across demographics based on genre preferences
    const normalizedGenre = isValidGenre(bandGenre) ? bandGenre : null;
    
    // Calculate total weight
    let totalWeight = 0;
    const weights: Record<string, number> = {};
    
    for (const demo of demographics as AgeDemographic[]) {
      const preference = normalizedGenre 
        ? (demo.genre_preferences?.[normalizedGenre] || 1.0)
        : 1.0;
      weights[demo.id] = preference;
      totalWeight += preference;
    }

    // Distribute fans proportionally
    for (const demo of demographics as AgeDemographic[]) {
      const proportion = weights[demo.id] / totalWeight;
      const demoFans = Math.floor(newFansGained * proportion);
      demographicBreakdown[demo.name] = demoFans;

      // Save demographic fans to database
      if (demoFans > 0) {
        await supabase
          .from('band_demographic_fans')
          .upsert({
            band_id: bandId,
            demographic_id: demo.id,
            city_id: cityId,
            country: country,
            fan_count: demoFans,
            engagement_rate: overallRating / 25,
          }, { onConflict: 'band_id,demographic_id,city_id' });
      }
    }
  }

  // Calculate spillover to other cities in same country
  const countrySpillover = Math.floor(newFansGained * COUNTRY_SPILLOVER_RATE);
  
  if (countrySpillover > 0 && country !== 'Unknown') {
    // Get other cities in the same country
    const { data: otherCities } = await supabase
      .from('cities')
      .select('id, name')
      .eq('country', country)
      .neq('id', cityId)
      .limit(10);

    if (otherCities && otherCities.length > 0) {
      const spilloverPerCity = Math.floor(countrySpillover / otherCities.length);
      
      for (const otherCity of otherCities) {
        if (spilloverPerCity > 0) {
          // Upsert spillover fans to other cities
          const { data: existingOtherCity } = await supabase
            .from('band_city_fans')
            .select('total_fans, casual_fans')
            .eq('band_id', bandId)
            .eq('city_id', otherCity.id)
            .maybeSingle();

          await supabase
            .from('band_city_fans')
            .upsert({
              band_id: bandId,
              city_id: otherCity.id,
              city_name: otherCity.name,
              country: country,
              total_fans: (existingOtherCity?.total_fans || 0) + spilloverPerCity,
              casual_fans: (existingOtherCity?.casual_fans || 0) + spilloverPerCity,
              dedicated_fans: 0,
              superfans: 0,
            }, { onConflict: 'band_id,city_id' });
        }
      }
    }

    // Update country-level fans
    const { data: existingCountryFans } = await supabase
      .from('band_country_fans')
      .select('*')
      .eq('band_id', bandId)
      .eq('country', country)
      .maybeSingle();

    await supabase
      .from('band_country_fans')
      .upsert({
        band_id: bandId,
        country: country,
        total_fans: (existingCountryFans?.total_fans || 0) + newFansGained + countrySpillover,
        casual_fans: (existingCountryFans?.casual_fans || 0) + casualFans + countrySpillover,
        dedicated_fans: (existingCountryFans?.dedicated_fans || 0) + dedicatedFans,
        superfans: (existingCountryFans?.superfans || 0) + superfans,
        fame: (existingCountryFans?.fame || 0) + Math.floor(bandFame * 0.01),
        last_activity_date: new Date().toISOString(),
      }, { onConflict: 'band_id,country' });
  }

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
        country: country,
        casual: casualFans,
        dedicated: dedicatedFans,
        superfans: superfans,
        spillover: countrySpillover,
        breakdown: demographicBreakdown,
      },
    }, { onConflict: 'gig_id' });

  // Update city fans record
  if (cityId) {
    await supabase
      .from('band_city_fans')
      .upsert({
        band_id: bandId,
        city_id: cityId,
        city_name: cityName,
        country: country,
        total_fans: existingFans + newFansGained,
        casual_fans: (existingCityFans?.casual_fans || 0) + casualFans,
        dedicated_fans: (existingCityFans?.dedicated_fans || 0) + dedicatedFans,
        superfans: (existingCityFans?.superfans || 0) + superfans,
        last_gig_date: new Date().toISOString(),
        gigs_in_city: gigsInCity,
        avg_satisfaction: overallRating * 4,
        city_fame: Math.floor(bandFame * 0.05),
      }, { onConflict: 'band_id,city_id' });
  }

  // Update band's total fan counts
  const { data: band } = await supabase
    .from('bands')
    .select('total_fans, casual_fans, dedicated_fans, superfans, global_fame')
    .eq('id', bandId)
    .single();

  if (band) {
    const totalWithSpillover = newFansGained + countrySpillover;
    await supabase
      .from('bands')
      .update({
        total_fans: (band.total_fans || 0) + totalWithSpillover,
        casual_fans: (band.casual_fans || 0) + casualFans + countrySpillover,
        dedicated_fans: (band.dedicated_fans || 0) + dedicatedFans,
        superfans: (band.superfans || 0) + superfans,
        global_fame: (band.global_fame || 0) + Math.floor(bandFame * 0.001),
      })
      .eq('id', bandId);
  }

  // Record fame history
  await supabase
    .from('band_fame_history')
    .insert({
      band_id: bandId,
      city_id: cityId,
      country: country,
      scope: 'city',
      fame_value: bandFame,
      fame_change: Math.floor(bandFame * 0.05),
      event_type: 'gig',
    });

  // Update gig outcome
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
    countrySpillover,
    demographicBreakdown,
  };
}
