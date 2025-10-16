import { supabase } from "@/integrations/supabase/client";
import { addMinutes } from "date-fns";

export async function createBandLockout(
  bandId: string,
  lockoutDuration: number,
  reason: string = 'Post-performance cooldown'
): Promise<void> {
  const lockedUntil = addMinutes(new Date(), lockoutDuration);

  const { error } = await supabase
    .from('band_activity_lockouts')
    .insert({
      band_id: bandId,
      activity_type: 'gig_performance',
      locked_until: lockedUntil.toISOString(),
      reason
    });

  if (error) {
    console.error('Failed to create band lockout:', error);
    throw error;
  }
}

export async function checkBandLockout(bandId: string): Promise<{
  isLocked: boolean;
  lockedUntil?: Date;
  reason?: string;
}> {
  const { data } = await supabase
    .from('band_activity_lockouts')
    .select('*')
    .eq('band_id', bandId)
    .gt('locked_until', new Date().toISOString())
    .order('locked_until', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { isLocked: false };
  }

  return {
    isLocked: true,
    lockedUntil: new Date(data.locked_until),
    reason: data.reason || 'Band is currently busy'
  };
}

export async function clearExpiredLockouts(bandId: string): Promise<void> {
  await supabase
    .from('band_activity_lockouts')
    .delete()
    .eq('band_id', bandId)
    .lt('locked_until', new Date().toISOString());
}
