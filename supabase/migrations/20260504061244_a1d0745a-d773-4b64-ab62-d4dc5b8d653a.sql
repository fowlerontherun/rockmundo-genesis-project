-- Backfill inbox and gig status for outcomes that completed before notification/final status writes.

UPDATE public.gigs g
SET status = 'completed',
    completed_at = COALESCE(g.completed_at, go.completed_at, now())
FROM public.gig_outcomes go
WHERE go.gig_id = g.id
  AND go.completed_at IS NOT NULL
  AND g.status <> 'completed';

INSERT INTO public.player_inbox (
  user_id,
  category,
  priority,
  title,
  message,
  metadata,
  action_type,
  action_data,
  related_entity_type,
  related_entity_id
)
SELECT DISTINCT
  bm.user_id,
  'gig_result'::public.inbox_category,
  CASE WHEN COALESCE(go.overall_rating, 0) >= 20 THEN 'high'::public.inbox_priority ELSE 'normal'::public.inbox_priority END,
  CASE WHEN COALESCE(go.overall_rating, 0) >= 16 THEN '🎸 Great Show at ' || COALESCE(v.name, 'Unknown Venue') ELSE 'Gig Complete: ' || COALESCE(v.name, 'Unknown Venue') END,
  'Performance Rating: ' || ROUND(COALESCE(go.overall_rating, 0)::numeric, 1)::text || '/25' || E'\n' ||
  'Net Profit: $' || COALESCE(go.net_profit, 0)::text || E'\n' ||
  'New Fans: ' || COALESCE(go.new_followers, 0)::text || E'\n' ||
  'Attendance: ' || COALESCE(go.actual_attendance, 0)::text,
  jsonb_build_object(
    'gig_id', g.id,
    'band_id', g.band_id,
    'rating', go.overall_rating,
    'profit', go.net_profit,
    'fans', go.new_followers,
    'attendance', go.actual_attendance,
    'backfilled', true
  ),
  'navigate',
  jsonb_build_object('route', '/gigs'),
  'gig',
  g.id
FROM public.gig_outcomes go
JOIN public.gigs g ON g.id = go.gig_id
LEFT JOIN public.venues v ON v.id = g.venue_id
JOIN public.band_members bm ON bm.band_id = g.band_id
WHERE go.completed_at IS NOT NULL
  AND bm.user_id IS NOT NULL
  AND bm.member_status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public.player_inbox pi
    WHERE pi.user_id = bm.user_id
      AND pi.category = 'gig_result'
      AND pi.related_entity_type = 'gig'
      AND pi.related_entity_id = g.id
  )
ON CONFLICT DO NOTHING;