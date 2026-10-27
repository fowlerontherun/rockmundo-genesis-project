import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const load = (name: string) =>
  readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
const batch = load('20261027100000_scene_jam_batch_cursor.sql');
const preview = load('20261027100500_scene_batch_preview.sql');
const processor = readFileSync(
  resolve(process.cwd(), 'supabase/functions/scene-challenges-processor/index.ts'),
  'utf8',
);

describe('City Scene jam processor cursor and dry-run contracts', () => {
  it('locks the cursor so concurrent processors cannot skip older events', () => {
    expect(batch).toContain('for update;');
    expect(batch).toContain('on conflict (source_key) do nothing');
    expect(batch).toContain('order by f.applied_at, f.session_id');
    expect(batch).toContain('limit p_limit');
    expect(batch).toContain('private.ingest_scene_verified_jam(v_event.session_id)');
    expect(batch).toContain('last_applied_at = v_cursor.last_applied_at');
    expect(batch).toContain('processed_events = processed_events + v_count');
    expect(batch).toContain("'15 minutes'");
    expect(batch).not.toContain('cron.schedule(');
  });

  it('rolls event scoring and cursor advances into a single database transaction', () => {
    expect(batch).toContain('create or replace function private.process_scene_verified_jam_batch');
    expect(batch).toContain('security definer');
    expect(batch).toContain('security invoker');
    expect(batch).toContain('grant execute on function public.scene_process_verified_jam_batch(integer)');
    expect(batch).toContain('to service_role;');
    expect(batch).toContain('revoke all on function public.scene_process_verified_jam_batch(integer)');
  });

  it('reports preview without advancing cursor or writing contributions', () => {
    expect(preview).toContain('create or replace function private.preview_scene_verified_jam_batch');
    expect(preview).toContain('stable');
    expect(preview).toContain('order by f.applied_at, f.session_id');
    expect(preview).toContain("'15 minutes'");
    expect(preview).not.toMatch(/\binsert\s+into\b/i);
    expect(preview).not.toMatch(/\bupdate\s+public\.scene_processor_cursors\b/i);
    expect(processor).toContain(".rpc('scene_preview_verified_jam_batch'");
    expect(processor).toContain(".rpc('scene_process_verified_jam_batch'");
    expect(processor).not.toContain(".rpc('scene_ingest_verified_jam'");
  });
});
