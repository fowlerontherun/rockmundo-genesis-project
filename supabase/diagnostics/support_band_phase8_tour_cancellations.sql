-- Read-only diagnostics for Support Band Marketplace Phase 8.

SELECT
  g.tour_id,
  g.id AS gig_id,
  g.scheduled_date,
  gs.id AS support_slot_id,
  gs.status AS support_status,
  hb.name AS headliner,
  sb.name AS support_band
FROM public.gigs g
JOIN public.bands hb ON hb.id = g.band_id
LEFT JOIN public.gig_support_slots gs ON gs.gig_id = g.id AND gs.status IN ('pending','accepted','completed','cancelled')
LEFT JOIN public.bands sb ON sb.id = gs.support_band_id
WHERE g.tour_id IS NOT NULL
ORDER BY g.scheduled_date DESC
LIMIT 200;

SELECT
  c.created_at,
  c.cancelled_by_role,
  c.hours_before_show,
  c.reliability_penalty,
  c.reputation_penalty,
  c.relationship_penalty,
  hb.name AS headliner,
  sb.name AS support_band
FROM public.support_band_cancellations c
JOIN public.bands hb ON hb.id = c.headliner_band_id
JOIN public.bands sb ON sb.id = c.support_band_id
ORDER BY c.created_at DESC
LIMIT 100;

SELECT
  b.name,
  r.completed_support_shows,
  r.cancelled_support_shows,
  r.reliability_score,
  r.reputation_score
FROM public.band_support_reputation r
JOIN public.bands b ON b.id = r.band_id
ORDER BY r.cancelled_support_shows DESC, r.reliability_score ASC, b.name;
