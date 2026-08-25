-- Support Band Marketplace Phase 7: Gig Viewer diagnostics
-- Read-only checks after migration/function deployment.

-- Completed supported gigs that should be eligible for a replay.
SELECT
  g.id AS gig_id,
  g.completed_at,
  g.result_ready_at,
  gs.support_band_id,
  b.name AS support_band_name,
  gs.status AS support_slot_status,
  r.id AS replay_id,
  r.generation_status,
  r.event_count,
  r.duration_ms
FROM public.gigs g
JOIN public.gig_support_slots gs
  ON gs.gig_id = g.id
 AND gs.status IN ('accepted','completed')
JOIN public.bands b ON b.id = gs.support_band_id
LEFT JOIN public.gig_viewer_replays r
  ON r.gig_id = g.id
WHERE g.status = 'completed'
ORDER BY g.completed_at DESC
LIMIT 50;

-- For generated replays, confirm the support sequence and changeover were persisted.
SELECT
  r.gig_id,
  event->>'messageKey' AS message_key,
  event->>'phase' AS phase,
  event->>'eventType' AS event_type,
  event->'messageParams'->>'band' AS support_band,
  event->'messageParams'->>'billing' AS billing,
  (event->>'sequence')::integer AS sequence,
  (event->>'scheduledOffsetMs')::bigint AS scheduled_offset_ms
FROM public.gig_viewer_replays r
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.event_payload->'events','[]'::jsonb)) event
WHERE event->>'messageKey' IN (
  'gig.viewer.support_performer_entered',
  'gig.viewer.support_band_entrance',
  'gig.viewer.support_set_started',
  'gig.viewer.support_set_performance',
  'gig.viewer.support_band_exit',
  'gig.viewer.support_changeover'
)
ORDER BY r.generated_at DESC, sequence
LIMIT 200;

-- Supported completed gigs with ready replays but no support sequence indicate a deployment/version issue.
SELECT r.gig_id, r.id AS replay_id, r.generated_at, r.event_count, r.checksum
FROM public.gig_viewer_replays r
JOIN public.gig_support_slots gs ON gs.gig_id=r.gig_id AND gs.status IN ('accepted','completed')
JOIN public.gigs g ON g.id=r.gig_id AND g.status='completed'
WHERE r.generation_status='ready'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(r.event_payload->'events','[]'::jsonb)) event
    WHERE event->>'messageKey'='gig.viewer.support_changeover'
  )
ORDER BY r.generated_at DESC;
