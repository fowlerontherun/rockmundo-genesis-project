-- Existing staff were not lost in the permissions cutover; repair stale derived counts.
UPDATE public.player_owned_nightclubs o
SET staff_count = (SELECT count(*) FROM public.nightclub_staff s WHERE s.owned_club_id=o.id),
 updated_at=now()
WHERE o.staff_count IS DISTINCT FROM
 (SELECT count(*) FROM public.nightclub_staff s WHERE s.owned_club_id=o.id);
-- Atomic hire/fire RPC maintains staff_count after this one-time reconciliation.
