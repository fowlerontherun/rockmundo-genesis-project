import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Cross-layer contract tests intentionally examine the real Edge Function,
// database migration, event config and wardrobe migration. They fail if a
// cosmetic-only shortcut reappears or the release gate can be bypassed.
const repoRoot = path.resolve(__dirname, '../../..');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const completeGig = read('supabase/functions/complete-gig/index.ts');
const rewards = read('supabase/migrations/20261016103000_halloween_2026_gig_rewards.sql');
const hat = read('supabase/migrations/20261016080000_halloween_2026_pumpkin_hat.sql');
const notice = read('supabase/migrations/20261016090000_halloween_2026_announcement_settings.sql');

describe('Halloween 2026 cross-layer gig contract', () => {
  it('only uses the authoritative gig and server-frozen hat snapshot', () => {
    expect(completeGig).toContain('get_halloween_2026_gig_bonus');
    expect(completeGig).toContain("source: 'server_frozen_gig_outfits'");
    expect(rewards).toContain('AFTER UPDATE OF status, started_at ON public.gigs');
    expect(rewards).toContain('public.player_owned_skins pos');
    expect(rewards).toContain('pos.is_equipped IS TRUE');
    expect(rewards).toContain('public.gig_performers gp');
    expect(rewards).toContain('ON CONFLICT (gig_id, profile_id) DO NOTHING');
    // No costume can be banked before the server turns on the event.
    const capture = rewards.slice(rewards.indexOf('FUNCTION public.capture_halloween_2026_gig_outfits()'),
      rewards.indexOf('DROP TRIGGER IF EXISTS trg_capture_halloween_2026_gig_outfits'));
    expect(capture).toContain("coalesce(v_settings->>'enabled','false') <> 'true'");
    expect(capture).toContain("coalesce(v_settings->>'rewards_live','false') <> 'true'");
    expect(rewards).not.toContain('random()');
    expect(rewards).not.toContain('current_setting(\'request.jwt.claim');
  });

  it('calculates one combined clothing-and-seasonal rating before commerce and preserves an audit', () => {
    const regular = completeGig.indexOf('get_band_equipped_clothing_performance_bonus');
    const event = completeGig.indexOf('get_halloween_2026_gig_bonus');
    const cap = completeGig.indexOf('const combinedPerformancePct =');
    const commerce = completeGig.indexOf("'settle_gig_commerce'");
    const savedOutcome = completeGig.indexOf('halloween_2026: halloweenPerformanceAudit');
    expect(regular).toBeGreaterThan(0);
    expect(event).toBeGreaterThan(regular);
    expect(cap).toBeGreaterThan(event);
    expect(commerce).toBeGreaterThan(cap);
    expect(savedOutcome).toBeGreaterThan(commerce);
    expect(completeGig).toContain('Math.min(25, clothingPerformancePct + halloweenPerformancePct)');
    expect(completeGig).toContain('Math.min(25, ratingBeforeClothingBonus * (1 + combinedPerformancePct / 100))');
    expect(rewards).toContain("gp.lineup_status IN ('selected','performed')");
  });

  it('uses date-specific gates and checks actual start and completion dates', () => {
    expect(completeGig).toContain("2026-10-23T23:00:00Z");
    expect(completeGig).toContain("2026-11-02T00:00:00Z");
    expect(rewards).toContain("('2026-10-24 00:00 Europe/London')::timestamptz");
    expect(rewards).toContain("('2026-11-02 00:00 Europe/London')::timestamptz");
    expect(rewards).toContain('NEW.completed_at >= v_end');
    expect(rewards).toContain('NEW.started_at < v_start');
    expect(rewards).toContain("NEW.status <> 'completed'");
  });

  it('serializes the first XP award and stores permanent achievement exactly once', () => {
    expect(rewards).toContain('profile_id uuid PRIMARY KEY');
    expect(rewards).toContain('ON CONFLICT (profile_id) DO NOTHING');
    expect(rewards).toContain('experience=coalesce(experience,0)+500');
    expect(rewards).toContain("'halloween_gig',500");
    expect(rewards).toContain("'pumpkin-headliner-2026'");
    expect(rewards).toContain('ON CONFLICT DO NOTHING');
    expect(rewards).toContain('first_reward_awarded=true');
    expect(rewards).toContain("'halloween_2026_first_rewards'");
    expect(rewards).toContain('public.gig_song_performances sp');
  });

  it('does not expose private reward manipulation to public callers', () => {
    expect(rewards).toContain('ENABLE ROW LEVEL SECURITY');
    expect(rewards).toContain('REVOKE ALL ON public.halloween_2026_gig_outfits FROM PUBLIC, anon, authenticated');
    expect(rewards).toContain('REVOKE ALL ON public.halloween_2026_first_rewards FROM PUBLIC, anon, authenticated');
    expect(rewards).toContain('SECURITY INVOKER SET search_path =');
    expect(rewards).toContain('TO service_role');
    expect(rewards).toContain('REVOKE ALL ON FUNCTION public.get_halloween_2026_gig_bonus(uuid)');
  });

  it('gifts the hat exactly once, unequipped, permanently to existing and new profiles', () => {
    expect(hat).toContain("'headwear'");
    expect(hat).toContain("'clothing.halloween.2026.pumpkin-hat'");
    expect(hat).toContain('"headwearStyle":"pumpkin"');
    expect(hat).toContain('ON CONFLICT (profile_id, item_type, item_id) DO NOTHING');
    expect(hat).toContain('grant_halloween_2026_pumpkin_hat_on_profile');
    expect(hat).toContain("'clothing', v_hat_id, false");
    expect(hat).not.toContain('DELETE FROM public.player_owned_skins');
  });

  it('does not publish rewards until explicitly certified and enabled', () => {
    expect(notice).toContain("'enabled', false");
    expect(notice).toContain("'rewards_live', false");
    expect(completeGig).toContain("(halloweenSettings as any)?.value?.enabled === true");
    expect(completeGig).toContain("(halloweenSettings as any)?.value?.rewards_live === true");
    expect(rewards).toContain("coalesce(v_settings->>'rewards_live','false') <> 'true'");
  });
});

// Mathematical bound from the same single-multiplier rule used in complete-gig.
describe('performance stacking safety', () => {
  it.each([
    [0,0,12,12], [20,15,20,25], [10,5,24,25], [5,5,30,25],
    [0,15,20,23], [20,15,10,12.5],
  ])('regular %i%% + Halloween %i%% from %i/25 => %i/25 or less', (regular, halloween, base, expected) => {
    const effective = Math.min(25, regular + halloween);
    const finalRating = Math.min(25, base * (1 + effective / 100));
    expect(finalRating).toBeCloseTo(expected);
    expect(finalRating).toBeLessThanOrEqual(25);
  });
});
