-- Harness assertions for Gig Preparation Phase 6 live timeline schema.
BEGIN;

SELECT plan(14);

SELECT has_table('public', 'gig_live_sessions', 'live sessions table exists');
SELECT has_table('public', 'gig_live_segments', 'live segments table exists');
SELECT has_table('public', 'gig_live_song_results', 'live song results table exists');
SELECT has_table('public', 'gig_live_incidents', 'live incidents table exists');
SELECT has_table('public', 'gig_live_decisions', 'live decisions table exists');
SELECT has_table('public', 'gig_live_setlist_changes', 'live setlist changes table exists');
SELECT col_is_unique('public', 'gig_live_sessions', ARRAY['gig_id'], 'one live session per gig');
SELECT col_is_unique('public', 'gig_live_segments', ARRAY['session_id', 'segment_index'], 'segments generate once per index');
SELECT col_is_unique('public', 'gig_live_song_results', ARRAY['segment_id'], 'song result cannot reroll per segment');
SELECT col_is_unique('public', 'gig_live_incidents', ARRAY['session_id', 'segment_id', 'incident_type'], 'incident cannot reroll per segment/type');
SELECT has_function('public', 'start_gig_live_session', ARRAY['uuid', 'jsonb', 'jsonb'], 'idempotent live session starter exists');
SELECT has_function('public', 'commit_gig_live_decision', ARRAY['uuid', 'text', 'jsonb'], 'decision commit function exists');
SELECT has_function('public', 'expire_gig_live_decisions', ARRAY['timestamp with time zone'], 'decision expiry function exists');
SELECT has_function('public', 'mark_gig_live_segment_resolved', ARRAY['uuid', 'jsonb'], 'idempotent segment resolve function exists');

SELECT * FROM finish();
ROLLBACK;
