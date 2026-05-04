-- Repair current tour travel state and add idempotency safeguards.

-- Active non-touring band members should travel with their band's transport by default.
UPDATE public.band_members
SET travels_with_band = true
WHERE member_status = 'active'
  AND COALESCE(is_touring_member, false) = false
  AND user_id IS NOT NULL
  AND profile_id IS NOT NULL
  AND COALESCE(travels_with_band, false) = false;

-- Remove duplicate tour travel rows before adding uniqueness.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, tour_leg_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.player_travel_history
  WHERE tour_leg_id IS NOT NULL
    AND profile_id IS NOT NULL
)
DELETE FROM public.player_travel_history p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_travel_history_profile_tour_leg_unique
  ON public.player_travel_history(profile_id, tour_leg_id)
  WHERE tour_leg_id IS NOT NULL AND profile_id IS NOT NULL;

-- Backfill missing travel history for active/scheduled tour legs.
INSERT INTO public.player_travel_history (
  user_id,
  profile_id,
  from_city_id,
  to_city_id,
  transport_type,
  cost_paid,
  travel_duration_hours,
  departure_time,
  scheduled_departure_time,
  arrival_time,
  status,
  tour_leg_id
)
SELECT
  bm.user_id,
  bm.profile_id,
  ttl.from_city_id,
  ttl.to_city_id,
  COALESCE(ttl.travel_mode, 'tour_bus'),
  0,
  GREATEST(1, COALESCE(ttl.travel_duration_hours, CEIL(EXTRACT(EPOCH FROM (ttl.arrival_date - ttl.departure_date)) / 3600.0)::integer, 1)),
  ttl.departure_date,
  ttl.departure_date,
  ttl.arrival_date,
  CASE
    WHEN ttl.arrival_date <= now() THEN 'completed'
    WHEN ttl.departure_date <= now() THEN 'in_progress'
    ELSE 'scheduled'
  END,
  ttl.id
FROM public.tour_travel_legs ttl
JOIN public.tours t ON t.id = ttl.tour_id
JOIN public.band_members bm ON bm.band_id = t.band_id
WHERE t.status IN ('active', 'scheduled', 'booked')
  AND ttl.from_city_id IS NOT NULL
  AND ttl.to_city_id IS NOT NULL
  AND ttl.departure_date IS NOT NULL
  AND ttl.arrival_date IS NOT NULL
  AND bm.member_status = 'active'
  AND COALESCE(bm.is_touring_member, false) = false
  AND bm.user_id IS NOT NULL
  AND bm.profile_id IS NOT NULL
  AND COALESCE(bm.travels_with_band, true) = true
ON CONFLICT DO NOTHING;

-- Start due scheduled travel and complete overdue travel.
UPDATE public.player_travel_history
SET status = 'in_progress',
    departure_time = COALESCE(scheduled_departure_time, departure_time)
WHERE status = 'scheduled'
  AND COALESCE(scheduled_departure_time, departure_time) <= now()
  AND arrival_time > now();

UPDATE public.player_travel_history
SET status = 'completed'
WHERE status IN ('scheduled', 'in_progress')
  AND arrival_time <= now();

-- Sync profiles to their most relevant active/completed travel row.
WITH active_travel AS (
  SELECT DISTINCT ON (profile_id)
    profile_id,
    arrival_time
  FROM public.player_travel_history
  WHERE status = 'in_progress'
    AND profile_id IS NOT NULL
  ORDER BY profile_id, arrival_time DESC
)
UPDATE public.profiles p
SET is_traveling = true,
    travel_arrives_at = a.arrival_time
FROM active_travel a
WHERE p.id = a.profile_id;

WITH latest_completed AS (
  SELECT DISTINCT ON (profile_id)
    profile_id,
    to_city_id,
    arrival_time
  FROM public.player_travel_history
  WHERE status = 'completed'
    AND profile_id IS NOT NULL
    AND to_city_id IS NOT NULL
  ORDER BY profile_id, arrival_time DESC
)
UPDATE public.profiles p
SET current_city_id = lc.to_city_id,
    is_traveling = false,
    travel_arrives_at = NULL
FROM latest_completed lc
WHERE p.id = lc.profile_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.player_travel_history active
    WHERE active.profile_id = p.id
      AND active.status = 'in_progress'
  );

-- Remove duplicate travel calendar blocks for the same travel record.
WITH ranked_activities AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, metadata->>'travel_history_id'
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.player_scheduled_activities
  WHERE activity_type = 'travel'
    AND metadata ? 'travel_history_id'
)
DELETE FROM public.player_scheduled_activities psa
USING ranked_activities r
WHERE psa.id = r.id
  AND r.rn > 1;

-- Create missing calendar blocks for repaired tour travel rows.
INSERT INTO public.player_scheduled_activities (
  user_id,
  profile_id,
  activity_type,
  status,
  scheduled_start,
  scheduled_end,
  title,
  description,
  location,
  metadata
)
SELECT
  pth.user_id,
  pth.profile_id,
  'travel',
  pth.status,
  pth.departure_time,
  pth.arrival_time,
  'Tour Travel: ' || COALESCE(fc.name, 'Unknown') || ' → ' || COALESCE(tc.name, 'Unknown'),
  COALESCE(pth.transport_type, 'tour_bus') || ' journey (' || GREATEST(1, pth.travel_duration_hours)::text || 'h) — Tour transport',
  COALESCE(tc.name, 'Unknown'),
  jsonb_build_object(
    'travel_history_id', pth.id,
    'tour_leg_id', pth.tour_leg_id,
    'from_city_id', pth.from_city_id,
    'to_city_id', pth.to_city_id,
    'transport_type', pth.transport_type
  )
FROM public.player_travel_history pth
LEFT JOIN public.cities fc ON fc.id = pth.from_city_id
LEFT JOIN public.cities tc ON tc.id = pth.to_city_id
WHERE pth.tour_leg_id IS NOT NULL
  AND pth.profile_id IS NOT NULL
  AND pth.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.player_scheduled_activities psa
    WHERE psa.activity_type = 'travel'
      AND psa.profile_id = pth.profile_id
      AND psa.metadata->>'travel_history_id' = pth.id::text
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_scheduled_activities_travel_history_unique
  ON public.player_scheduled_activities(profile_id, ((metadata->>'travel_history_id')))
  WHERE activity_type = 'travel' AND metadata ? 'travel_history_id';

-- Dedupe gig-result inbox rows and prevent repeat outcome messages per recipient/gig.
WITH ranked_inbox AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, related_entity_type, related_entity_id, category
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.player_inbox
  WHERE category = 'gig_result'
    AND related_entity_type = 'gig'
    AND related_entity_id IS NOT NULL
)
DELETE FROM public.player_inbox pi
USING ranked_inbox r
WHERE pi.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_inbox_unique_gig_result
  ON public.player_inbox(user_id, related_entity_type, related_entity_id, category)
  WHERE category = 'gig_result'
    AND related_entity_type = 'gig'
    AND related_entity_id IS NOT NULL;