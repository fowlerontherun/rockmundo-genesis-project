import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const processor = readFileSync(
  fileURLToPath(new URL('../../../supabase/functions/scene-challenges-processor/index.ts', import.meta.url)),
  'utf8',
);
const milestone = readFileSync(
  fileURLToPath(new URL('../../../supabase/migrations/20261027085000_scene_milestone_reconciliation.sql', import.meta.url)),
  'utf8',
);
const config = readFileSync(
  fileURLToPath(new URL('../../../supabase/config.toml', import.meta.url)),
  'utf8',
);

describe('City scene processor opt-in gates', () => {
  it('requires its own secret and enable flag, never trusts browser JWT alone', () => {
    expect(processor).toContain("SCENE_PROCESSOR_CRON_SECRET");
    expect(processor).toContain("SCENE_CHALLENGES_PROCESSOR_ENABLED");
    expect(processor).toContain("request.headers.get('x-cron-secret') !== cronSecret");
    expect(processor).toContain('request.method !== \'POST\'');
    expect(processor).toContain("return json({ error: 'PROCESSOR_NOT_CONFIGURED' }, 503)");
    expect(config).toContain('[functions.scene-challenges-processor]\nverify_jwt = false');
  });

  it('defaults to dry-run and avoids writes when no explicit false is given', () => {
    expect(processor).toContain('const dryRun = body.dryRun !== false;');
    const beforeMutation = processor.split("if (dryRun) {")[1]?.split("const { data: cycles")[0] ?? '';
    expect(beforeMutation).toContain('dryRun: true');
    expect(beforeMutation).not.toContain(".rpc('scene_reconcile_cycles'");
    expect(beforeMutation).not.toContain(".rpc('scene_ingest_verified_jam'");
    expect(processor).not.toContain(".rpc('scene_ingest_social_activity'");
  });

  it('records idempotent mural thresholds without issuing rewards', () => {
    expect(milestone).toContain('values (25), (50), (75), (100)');
    expect(milestone).toContain('on conflict (cycle_id, percent_threshold) do nothing');
    expect(milestone).toContain('contribution.invalidated_at is null');
    expect(milestone).toContain('security invoker');
    expect(milestone).not.toContain('cron.schedule(');
    expect(milestone).not.toMatch(/\bupdate\s+public\.profiles\b/i);
  });
});
