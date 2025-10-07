import { supabase } from "@/integrations/supabase/client";

export const BAND_FAME_THRESHOLDS = {
  garageBand: 0,
  localAct: 200,
  regionalFavorite: 1000,
  risingBand: 3000,
  touredAct: 8000,
  nationalBand: 20000,
  headliner: 50000,
  legendaryBand: 100000,
} as const;

export function getBandFameTitle(fame: number): string {
  if (fame >= BAND_FAME_THRESHOLDS.legendaryBand) return "Legendary Band";
  if (fame >= BAND_FAME_THRESHOLDS.headliner) return "Headliner";
  if (fame >= BAND_FAME_THRESHOLDS.nationalBand) return "National Band";
  if (fame >= BAND_FAME_THRESHOLDS.touredAct) return "Toured Act";
  if (fame >= BAND_FAME_THRESHOLDS.risingBand) return "Rising Band";
  if (fame >= BAND_FAME_THRESHOLDS.regionalFavorite) return "Regional Favorite";
  if (fame >= BAND_FAME_THRESHOLDS.localAct) return "Local Act";
  return "Garage Band";
}

export async function calculateBandBaseFame(bandId: string): Promise<number> {
  try {
    const { data: members } = await supabase
      .from('band_members')
      .select('user_id, vocal_role, joined_at, is_touring_member')
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
      if (member.is_touring_member || !member.user_id) continue;

      const { data: profile } = await supabase
        .from('profiles')
        .select('fame')
        .eq('user_id', member.user_id)
        .single();

      const memberFame = profile?.fame || 0;
      let weight = 1.0;

      if (member.user_id === band.leader_id) {
        weight = 1.5;
      }

      if (member.vocal_role === 'Lead Singer') {
        weight *= 1.3;
      }

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
        .select('user_id')
        .eq('band_id', bandId)
        .eq('is_touring_member', false)
        .limit(1)
        .single();

      if (members?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fame')
          .eq('user_id', members.user_id)
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

    const newCollectiveFame = (band.collective_fame_earned || 0) + fameAmount;

    await supabase
      .from('bands')
      .update({
        collective_fame_earned: newCollectiveFame,
        last_fame_calculation: new Date().toISOString(),
      })
      .eq('id', bandId);

    await supabase
      .from('band_fame_events')
      .insert({
        band_id: bandId,
        event_type: eventType,
        fame_gained: fameAmount,
        event_data: eventData,
      });

    await distributeFameToMembers(bandId, fameAmount);
    await recalculateBandFame(bandId);
  } catch (error) {
    console.error('Error awarding band fame:', error);
  }
}

async function distributeFameToMembers(bandId: string, totalFameGained: number): Promise<void> {
  try {
    const { data: members } = await supabase
      .from('band_members')
      .select('user_id, vocal_role')
      .eq('band_id', bandId)
      .eq('is_touring_member', false);

    if (!members) return;

    const { data: band } = await supabase
      .from('bands')
      .select('leader_id')
      .eq('id', bandId)
      .single();

    if (!band) return;

    for (const member of members) {
      if (!member.user_id) continue;

      let memberShare = Math.round(totalFameGained * 0.3);

      if (member.vocal_role === 'Lead Singer') {
        memberShare = Math.round(memberShare * 1.2);
      }

      if (member.user_id === band.leader_id) {
        memberShare = Math.round(memberShare * 1.15);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('fame')
        .eq('user_id', member.user_id)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({ fame: (profile.fame || 0) + memberShare })
          .eq('user_id', member.user_id);
      }
    }
  } catch (error) {
    console.error('Error distributing fame to members:', error);
  }
}

async function recalculateBandFame(bandId: string): Promise<void> {
  try {
    const totalFame = await calculateTotalBandFame(bandId);
    
    const { data: band } = await supabase
      .from('bands')
      .select('chemistry_level')
      .eq('id', bandId)
      .single();

    if (band) {
      const fameMultiplier = 0.5 + (band.chemistry_level / 100) * 1.5;
      
      await supabase
        .from('bands')
        .update({ 
          fame: totalFame,
          fame_multiplier: fameMultiplier 
        })
        .eq('id', bandId);
    }
  } catch (error) {
    console.error('Error recalculating band fame:', error);
  }
}
