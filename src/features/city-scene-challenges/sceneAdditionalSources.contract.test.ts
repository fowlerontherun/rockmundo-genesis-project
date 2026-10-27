import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const get = (name: string) =>
  readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
const recording = get('20261027110000_scene_completed_recording.sql');
const recordingCursor = get('20261027110500_scene_recording_cursor.sql');
const gig = get('20261027111000_scene_verified_gig.sql');
const gigCursor = get('20261027111500_scene_gig_cursor.sql');
const processor = readFileSync(
  resolve(process.cwd(), 'supabase/functions/scene-challenges-processor/index.ts'),
  'utf8',
);

describe('City Scene three-source verified daily/weekly/monthly coverage', () => {
  it('replaces dormant daily templates without silently enabling scoring', () => {
    expect(gig).toContain("slug='daily-band-meeting' and enabled is false");
    expect(gig).toContain("slug='daily-afterparty' and enabled is false");
    expect(recording).toContain("slug = 'daily-release-party' and enabled is false");
    expect(recording).toContain("slug = 'weekly-scene-dinner' and enabled is false");
    expect(gig).toContain("slug='weekly-gig-support' and enabled is false");
    expect(gig).toContain("'jam:verified_collaboration'");
    expect(gig).toContain("'gig:verified_performance'");
    expect(recording).toContain("'recording:completed'");
  });

  it('never gives credit for booked studio time or an unrelated character', () => {
    expect(recording).toContain("s.status = 'completed'");
    expect(recording).toContain("v_session.completed_at < v_session.scheduled_end");
    expect(recording).toContain("v_session.xp_awards = '{}'::jsonb");
    expect(recording).toContain('p.user_id = v_session.user_id');
    expect(recording).toContain("p.deleted_at is null and p.is_active is true");
    expect(recording).toContain("source_type,source_event_id,source_completed_at,points");
    expect(recording).toContain("'scoring_enabled','false'");
    expect(recording).toContain('on conflict (objective_id,source_type,source_event_id,account_id)');
  });

  it('never counts a booked or merely selected gig performer', () => {
    expect(gig).toContain("gp.lineup_status='performed'");
    expect(gig).toContain('gp.performed_at<=v_gig.completed_at');
    expect(gig).toContain("v_gig.gig_status <> 'completed'");
    expect(gig).toContain('v_gig.cancelled_at is not null');
    expect(gig).toContain('v_gig.booked_band_id is distinct from v_gig.band_id');
    expect(gig).toContain("'scoring_enabled','false'");
    expect(gig).not.toContain('gig_audience_attendance');
    expect(gig).toContain('on conflict(objective_id,source_type,source_event_id,account_id)');
  });

  it('keeps account/day city lock and full-cycle caps consistent across all sources', () => {
    for (const text of [recording, gig]) {
      expect(text).toContain("'rockmundo:scene:acct:'");
      expect(text).toContain("'rockmundo:scene:cycle:'");
      expect(text).toContain("when 'daily' then 5 when 'weekly' then 10 else 25");
      expect(text).toContain('scene_daily_affiliations');
      expect(text).not.toMatch(/\bupdate\s+public\.player_xp_wallet\b/i);
    }
  });

  it('processes oldest-first transactions and provides read-only previews', () => {
    for (const text of [recordingCursor, gigCursor]) {
      expect(text).toContain('for update;');
      expect(text).toContain("'15 minutes'");
      expect(text).toContain("source_health_snapshot->>'scoring_enabled'");
      expect(text).toMatch(/updated_at\s*=\s*now\(\)/);
      expect(text).toContain('backlog_pending');
      expect(text).toContain('security invoker');
      expect(text).toContain('to service_role');
      expect(text).not.toContain('cron.schedule(');
    }
  });

  it('exposes both new sources only through the secret-gated processor', () => {
    for (const rpc of [
      'scene_preview_completed_recording_batch',
      'scene_process_completed_recording_batch',
      'scene_preview_verified_gig_batch',
      'scene_process_verified_gig_batch',
    ]) {
      expect(processor).toContain(`.rpc('${rpc}'`);
    }
    expect(processor).toContain('SCENE_PROCESSOR_CRON_SECRET');
    expect(processor).toContain("const dryRun = body.dryRun !== false");
    expect(processor).toContain("SCENE_CHALLENGES_PROCESSOR_ENABLED");
    expect(processor).not.toContain("scene_ingest_social_activity");
  });
});
