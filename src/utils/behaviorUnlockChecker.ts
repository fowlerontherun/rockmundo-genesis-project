import { supabase } from "@/integrations/supabase/client";
import { STAGE_BEHAVIORS, type StageBehaviorDefinition } from "./stageBehaviors";

export interface BehaviorUnlockResult {
  newlyUnlocked: StageBehaviorDefinition[];
}

/**
 * Check if a player qualifies for any new behavior unlocks and grant them.
 * Called after gig completion.
 */
export async function checkAndGrantBehaviorUnlocks(userId: string): Promise<BehaviorUnlockResult> {
  const newlyUnlocked: StageBehaviorDefinition[] = [];

  try {
    // Fetch already unlocked behaviors
    const { data: existing } = await supabase
      .from('player_unlocked_behaviors')
      .select('behavior_key')
      .eq('user_id', userId);

    const alreadyUnlocked = new Set((existing || []).map((r: any) => r.behavior_key as string));

    // Fetch player stats needed for unlock checks
    const [profileRes, bandRes, gigCountRes] = await Promise.all([
      supabase.from('profiles').select('id, fame, level').eq('user_id', userId).single(),
      supabase.from('band_members').select('band_id').eq('user_id', userId).eq('is_touring_member', false).limit(1).single(),
      // Count completed gigs across all bands the player is in
      supabase.from('band_members').select('band_id').eq('user_id', userId).eq('is_touring_member', false),
    ]);

    const fame = (profileRes.data as any)?.fame || 0;
    const playerLevel = (profileRes.data as any)?.level || 1;

    // Count total gigs played
    let totalGigs = 0;
    if (gigCountRes.data) {
      const bandIds = gigCountRes.data.map((m: any) => m.band_id);
      if (bandIds.length > 0) {
        const { count } = await supabase
          .from('gigs')
          .select('*', { count: 'exact', head: true })
          .in('band_id', bandIds)
          .eq('status', 'completed');
        totalGigs = count || 0;
      }
    }

    // Check skill levels if needed
    let skillLevels: Record<string, number> = {};
    const profileId = profileRes.data ? (profileRes.data as any).id : null;
    if (profileId) {
      const { data: skills } = await supabase
        .from('skill_progress')
        .select('skill_slug, current_level')
        .eq('profile_id', profileId);

      if (skills) {
        for (const s of skills) {
          if (s.skill_slug && s.current_level != null) {
            skillLevels[s.skill_slug] = Math.max(skillLevels[s.skill_slug] || 0, s.current_level);
          }
        }
      }
    }

    // Check each unlockable behavior
    const unlockableBehaviors = Object.values(STAGE_BEHAVIORS).filter(b => !b.isStarter && b.unlockRequirement);

    for (const behavior of unlockableBehaviors) {
      if (alreadyUnlocked.has(behavior.key)) continue;

      const req = behavior.unlockRequirement!;
      let qualifies = false;

      switch (req.type) {
        case 'fame':
          qualifies = fame >= (req.minFame || 0);
          break;
        case 'gigs_played':
          qualifies = totalGigs >= (req.minGigs || 0);
          break;
        case 'player_level':
          qualifies = playerLevel >= (req.minLevel || 0);
          break;
        case 'skill_level':
          if (req.skillSlug) {
            qualifies = (skillLevels[req.skillSlug] || 0) >= (req.minLevel || 0);
          }
          break;
      }

      if (qualifies) {
        // Grant the unlock
        const { error } = await supabase
          .from('player_unlocked_behaviors')
          .insert({ user_id: userId, behavior_key: behavior.key });

        if (!error) {
          newlyUnlocked.push(behavior);
          console.log(`[BehaviorUnlock] Player ${userId} unlocked: ${behavior.name}`);
        }
      }
    }
  } catch (err) {
    console.error('[BehaviorUnlock] Error checking unlocks:', err);
  }

  return { newlyUnlocked };
}
