import { supabase } from "@/integrations/supabase/client";

// Long-tail progression: 40 fame steps. Early scene progress is visible, while
// national/global jumps require orders of magnitude more sustained success.
export const BAND_FAME_THRESHOLDS = {
  unknown: 0,
  firstNotice: 25,
  bedroomBuzz: 60,
  garageBand: 120,
  openMicRegular: 220,
  sceneNewcomer: 350,
  localCuriosity: 550,
  localAct: 800,
  localRegular: 1150,
  localFavorite: 1600,
  cityBuzz: 2300,
  cityAct: 3200,
  cityFavorite: 4500,
  regionalNewcomer: 6200,
  regionalAct: 8500,
  regionalFavorite: 12000,
  regionalHeadliner: 17000,
  breakingArtist: 24000,
  nationalNewcomer: 34000,
  nationalAct: 48000,
  nationalFavorite: 68000,
  establishedArtist: 95000,
  majorArtist: 135000,
  nationalHeadliner: 190000,
  arenaNewcomer: 270000,
  arenaAct: 380000,
  festivalHeadliner: 540000,
  nationalIcon: 760000,
  internationalNewcomer: 1050000,
  internationalStar: 1450000,
  internationalHeadliner: 2000000,
  globalStar: 2800000,
  globalSuperstar: 3900000,
  globalHeadliner: 5500000,
  icon: 7800000,
  globalIcon: 11000000,
  generationalStar: 15500000,
  livingLegend: 22000000,
  legendaryBand: 32000000,
  immortal: 50000000,
} as const;

export const BAND_FAN_THRESHOLDS = {
  noFollowing: 0,
  friendsAndFamily: 10,
  firstFollowers: 25,
  tinyFollowing: 50,
  sceneFollowers: 100,
  smallFollowing: 175,
  growingFollowing: 300,
  localFollowing: 500,
  loyalLocalFans: 800,
  strongLocalFollowing: 1250,
  cityFanbase: 2000,
  strongCityFanbase: 3200,
  regionalSeeds: 5000,
  regionalFollowing: 8000,
  regionalFanbase: 12500,
  strongRegionalFanbase: 20000,
  breakoutFollowing: 32000,
  nationalSeeds: 50000,
  nationalFollowing: 80000,
  nationalFanbase: 125000,
  strongNationalFanbase: 200000,
  establishedFanbase: 320000,
  majorFanbase: 500000,
  devotedNationalFanbase: 800000,
  millionClub: 1000000,
  arenaFanbase: 1600000,
  massFollowing: 2500000,
  hugeFollowing: 4000000,
  internationalFollowing: 6500000,
  internationalFanbase: 10000000,
  globalFollowing: 16000000,
  globalFanbase: 25000000,
  hugeGlobalFanbase: 40000000,
  superstarFanbase: 65000000,
  iconFanbase: 100000000,
  globalIconFanbase: 160000000,
  generationalFanbase: 250000000,
  legendaryFanbase: 400000000,
  historicFanbase: 650000000,
  billionFanReach: 1000000000,
} as const;

const FAME_TITLES: Record<keyof typeof BAND_FAME_THRESHOLDS, string> = {
  unknown: "Unknown",
  firstNotice: "First Notice",
  bedroomBuzz: "Bedroom Buzz",
  garageBand: "Garage Band",
  openMicRegular: "Open Mic Regular",
  sceneNewcomer: "Scene Newcomer",
  localCuriosity: "Local Curiosity",
  localAct: "Local Act",
  localRegular: "Local Regular",
  localFavorite: "Local Favorite",
  cityBuzz: "City Buzz",
  cityAct: "City Act",
  cityFavorite: "City Favorite",
  regionalNewcomer: "Regional Newcomer",
  regionalAct: "Regional Act",
  regionalFavorite: "Regional Favorite",
  regionalHeadliner: "Regional Headliner",
  breakingArtist: "Breaking Artist",
  nationalNewcomer: "National Newcomer",
  nationalAct: "National Act",
  nationalFavorite: "National Favorite",
  establishedArtist: "Established Artist",
  majorArtist: "Major Artist",
  nationalHeadliner: "National Headliner",
  arenaNewcomer: "Arena Newcomer",
  arenaAct: "Arena Act",
  festivalHeadliner: "Festival Headliner",
  nationalIcon: "National Icon",
  internationalNewcomer: "International Newcomer",
  internationalStar: "International Star",
  internationalHeadliner: "International Headliner",
  globalStar: "Global Star",
  globalSuperstar: "Global Superstar",
  globalHeadliner: "Global Headliner",
  icon: "Icon",
  globalIcon: "Global Icon",
  generationalStar: "Generational Star",
  livingLegend: "Living Legend",
  legendaryBand: "Legendary Band",
  immortal: "Immortal",
};

const FAN_TITLES: Record<keyof typeof BAND_FAN_THRESHOLDS, string> = {
  noFollowing: "No Following",
  friendsAndFamily: "Friends & Family",
  firstFollowers: "First Followers",
  tinyFollowing: "Tiny Following",
  sceneFollowers: "Scene Followers",
  smallFollowing: "Small Following",
  growingFollowing: "Growing Following",
  localFollowing: "Local Following",
  loyalLocalFans: "Loyal Local Fans",
  strongLocalFollowing: "Strong Local Following",
  cityFanbase: "City Fanbase",
  strongCityFanbase: "Strong City Fanbase",
  regionalSeeds: "Regional Seeds",
  regionalFollowing: "Regional Following",
  regionalFanbase: "Regional Fanbase",
  strongRegionalFanbase: "Strong Regional Fanbase",
  breakoutFollowing: "Breakout Following",
  nationalSeeds: "National Seeds",
  nationalFollowing: "National Following",
  nationalFanbase: "National Fanbase",
  strongNationalFanbase: "Strong National Fanbase",
  establishedFanbase: "Established Fanbase",
  majorFanbase: "Major Fanbase",
  devotedNationalFanbase: "Devoted National Fanbase",
  millionClub: "Million Club",
  arenaFanbase: "Arena Fanbase",
  massFollowing: "Mass Following",
  hugeFollowing: "Huge Following",
  internationalFollowing: "International Following",
  internationalFanbase: "International Fanbase",
  globalFollowing: "Global Following",
  globalFanbase: "Global Fanbase",
  hugeGlobalFanbase: "Huge Global Fanbase",
  superstarFanbase: "Superstar Fanbase",
  iconFanbase: "Icon Fanbase",
  globalIconFanbase: "Global Icon Fanbase",
  generationalFanbase: "Generational Fanbase",
  legendaryFanbase: "Legendary Fanbase",
  historicFanbase: "Historic Fanbase",
  billionFanReach: "Billion-Fan Reach",
};

function getTierTitle<T extends Record<string, number>>(value: number, thresholds: T, labels: Record<keyof T, string>): string {
  const tiers = (Object.entries(thresholds) as [keyof T, number][]).sort((a, b) => a[1] - b[1]);
  let current = tiers[0][0];
  for (const [key, threshold] of tiers) {
    if (value >= threshold) current = key;
    else break;
  }
  return labels[current];
}

export function getBandFameTitle(fame: number): string {
  return getTierTitle(Math.max(0, fame || 0), BAND_FAME_THRESHOLDS, FAME_TITLES);
}

export function getBandFanTitle(fans: number): string {
  return getTierTitle(Math.max(0, fans || 0), BAND_FAN_THRESHOLDS, FAN_TITLES);
}

export function getNextBandFanTier(fans: number) {
  const tiers = (Object.entries(BAND_FAN_THRESHOLDS) as [keyof typeof BAND_FAN_THRESHOLDS, number][]).sort((a, b) => a[1] - b[1]);
  const next = tiers.find(([, threshold]) => threshold > fans);
  return next ? { key: next[0], threshold: next[1], title: FAN_TITLES[next[0]] } : null;
}

export async function calculateBandBaseFame(bandId: string): Promise<number> {
  try {
    const { data: members } = await supabase
      .from('band_members')
      .select('user_id, profile_id, vocal_role, joined_at, is_touring_member')
      .eq('band_id', bandId);

    if (!members || members.length === 0) return 0;

    const { data: band } = await supabase
      .from('bands')
      .select('leader_id')
      .eq('id', bandId)
      .single();

    if (!band) return 0;

    let totalWeightedFame = 0;
    let totalWeight = 0;

    for (const member of members) {
      if (member.is_touring_member || !member.profile_id) continue;

      const { data: profile } = await supabase
        .from('profiles')
        .select('fame')
        .eq('id', member.profile_id)
        .single();

      const memberFame = profile?.fame || 0;
      let weight = 1.0;

      if (member.user_id === band.leader_id) weight = 1.5;
      if (member.vocal_role === 'Lead Singer') weight *= 1.3;

      const joinedDate = new Date(member.joined_at);
      const daysInBand = Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24));
      const tenureBonus = Math.min(1.2, 1 + (daysInBand / 365) * 0.2);
      weight *= tenureBonus;

      totalWeightedFame += memberFame * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(totalWeightedFame / totalWeight) : 0;
  } catch (error) {
    console.error('Error calculating band base fame:', error);
    return 0;
  }
}

export async function calculateTotalBandFame(bandId: string): Promise<number> {
  try {
    const { data: band } = await supabase
      .from('bands')
      .select('collective_fame_earned, chemistry_level, is_solo_artist')
      .eq('id', bandId)
      .single();

    if (!band) return 0;

    if (band.is_solo_artist) {
      const { data: members } = await supabase
        .from('band_members')
        .select('user_id, profile_id')
        .eq('band_id', bandId)
        .eq('is_touring_member', false)
        .limit(1)
        .single();

      if (members?.profile_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fame')
          .eq('id', members.profile_id)
          .single();

        return Math.round((profile?.fame || 0) * 1.2);
      }
      return 0;
    }

    const baseFame = await calculateBandBaseFame(bandId);
    const collectiveFame = band.collective_fame_earned || 0;
    const chemistryMultiplier = 0.5 + (band.chemistry_level / 100) * 1.5;

    return Math.round((baseFame + collectiveFame) * chemistryMultiplier);
  } catch (error) {
    console.error('Error calculating total band fame:', error);
    return 0;
  }
}

export async function awardBandFame(
  bandId: string,
  fameAmount: number,
  eventType: string,
  eventData: Record<string, any> = {}
): Promise<void> {
  try {
    const { data: band } = await supabase
      .from('bands')
      .select('collective_fame_earned')
      .eq('id', bandId)
      .single();

    if (!band) return;

    // Fame gains become progressively harder as collective fame rises. This keeps
    // high-level jumps meaningful without making early-game progression glacial.
    const current = band.collective_fame_earned || 0;
    const diminishingFactor = 1 / (1 + Math.log10(1 + current) / 5);
    const effectiveGain = Math.max(1, Math.round(fameAmount * diminishingFactor));
    const newCollectiveFame = current + effectiveGain;

    await supabase
      .from('bands')
      .update({ collective_fame_earned: newCollectiveFame, last_fame_calculation: new Date().toISOString() })
      .eq('id', bandId);

    await supabase
      .from('band_fame_events')
      .insert({ band_id: bandId, event_type: eventType, fame_gained: effectiveGain, event_data: { ...eventData, raw_fame_gain: fameAmount, progression_factor: diminishingFactor } });

    await distributeFameToMembers(bandId, effectiveGain);
    await recalculateBandFame(bandId);
  } catch (error) {
    console.error('Error awarding band fame:', error);
  }
}

async function distributeFameToMembers(bandId: string, totalFameGained: number): Promise<void> {
  try {
    const { data: members } = await supabase
      .from('band_members')
      .select('user_id, profile_id, vocal_role')
      .eq('band_id', bandId)
      .eq('is_touring_member', false);

    if (!members) return;

    const { data: band } = await supabase.from('bands').select('leader_id').eq('id', bandId).single();
    if (!band) return;

    for (const member of members) {
      let profileId: string | null = member.profile_id ?? null;
      if (!profileId && member.user_id) {
        const { data: activeProfile } = await supabase
          .from('profiles').select('id').eq('user_id', member.user_id).eq('is_active', true).is('died_at', null).maybeSingle();
        profileId = activeProfile?.id ?? null;
      }
      if (!profileId) continue;

      let memberShare = Math.round(totalFameGained * 0.3);
      if (member.vocal_role === 'Lead Singer') memberShare = Math.round(memberShare * 1.2);
      if (member.user_id && member.user_id === band.leader_id) memberShare = Math.round(memberShare * 1.15);

      const { data: profile } = await supabase.from('profiles').select('fame, fans').eq('id', profileId).maybeSingle();
      if (profile) {
        await supabase.from('profiles').update({ fame: (profile.fame || 0) + memberShare, fans: (profile.fans || 0) + Math.round(memberShare * 0.5) }).eq('id', profileId);
      }
    }
  } catch (error) {
    console.error('Error distributing fame to members:', error);
  }
}

async function recalculateBandFame(bandId: string): Promise<void> {
  try {
    const totalFame = await calculateTotalBandFame(bandId);
    const { data: band } = await supabase.from('bands').select('chemistry_level').eq('id', bandId).single();
    if (band) {
      const fameMultiplier = 0.5 + (band.chemistry_level / 100) * 1.5;
      await supabase.from('bands').update({ fame: totalFame, fame_multiplier: fameMultiplier }).eq('id', bandId);
    }
  } catch (error) {
    console.error('Error recalculating band fame:', error);
  }
}
