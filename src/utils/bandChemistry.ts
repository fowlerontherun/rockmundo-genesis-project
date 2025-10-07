import { supabase } from "@/integrations/supabase/client";

export interface ChemistryEvent {
  type: string;
  change: number;
  description: string;
}

export const CHEMISTRY_EVENTS: Record<string, ChemistryEvent> = {
  GIG_PERFORMED: { type: 'gig', change: 2, description: 'Performed a gig together' },
  JAM_SESSION: { type: 'jam', change: 1, description: 'Jam session completed' },
  WEEK_TOGETHER: { type: 'time', change: 1, description: 'Another week together' },
  COMPETITION_WIN: { type: 'achievement', change: 5, description: 'Won a competition' },
  HIGH_RATED_PERFORMANCE: { type: 'achievement', change: 3, description: 'Exceptional performance' },
  MEMBER_LEFT: { type: 'conflict', change: -10, description: 'Member left the band' },
  LEADER_CHANGED: { type: 'conflict', change: -5, description: 'New leader elected' },
  FAILED_GIG: { type: 'conflict', change: -2, description: 'Poor gig performance' },
  UNPAID_TOURING: { type: 'conflict', change: -1, description: 'Unpaid touring members' },
  INACTIVITY: { type: 'conflict', change: -1, description: 'Band inactivity' },
};

export async function updateBandChemistry(
  bandId: string,
  eventType: keyof typeof CHEMISTRY_EVENTS,
  customData: Record<string, any> = {}
): Promise<number> {
  try {
    const event = CHEMISTRY_EVENTS[eventType];
    if (!event) return 0;

    const { data: band } = await supabase
      .from('bands')
      .select('chemistry_level, is_solo_artist')
      .eq('id', bandId)
      .single();

    if (!band) return 0;

    if (band.is_solo_artist) {
      return 100;
    }

    const newChemistry = Math.max(0, Math.min(100, (band.chemistry_level || 0) + event.change));

    await supabase
      .from('bands')
      .update({ 
        chemistry_level: newChemistry,
        last_chemistry_update: new Date().toISOString()
      })
      .eq('id', bandId);

    await supabase
      .from('band_chemistry_events')
      .insert({
        band_id: bandId,
        event_type: event.type,
        chemistry_change: event.change,
        event_data: { ...customData, description: event.description }
      });

    return newChemistry;
  } catch (error) {
    console.error('Error updating band chemistry:', error);
    return 0;
  }
}

export function getChemistryBenefits(chemistry: number) {
  return {
    performanceQuality: 1 + chemistry / 200,
    skillRatingBonus: 1 + chemistry / 200,
    fanGrowth: 1 + chemistry / 300,
    isHighChemistry: chemistry >= 80,
  };
}

export function getChemistryColor(chemistry: number): string {
  if (chemistry >= 81) return 'text-blue-500';
  if (chemistry >= 61) return 'text-green-500';
  if (chemistry >= 31) return 'text-yellow-500';
  return 'text-red-500';
}

export function getChemistryLabel(chemistry: number): string {
  if (chemistry >= 81) return 'Exceptional';
  if (chemistry >= 61) return 'Strong';
  if (chemistry >= 31) return 'Developing';
  return 'Poor';
}
