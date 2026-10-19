-- Private operational capability exposed only to service_role, not player JWTs.
-- Read-only financial invariants for the staged DJ/nightclub release.
CREATE FUNCTION public.dj_finance_release_health()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $fn$
 WITH sums AS (
   SELECT f.id,f.fee,f.status,f.booking_id,f.expires_at,f.application_id,
      COALESCE(SUM(m.amount) FILTER(WHERE m.kind='fund'),0)::bigint funded,
      COALESCE(SUM(m.amount) FILTER(WHERE m.kind='payout'),0)::bigint paid,
      COALESCE(SUM(m.amount) FILTER(WHERE m.kind='refund'),0)::bigint refunded
   FROM public.nightclub_dj_funded_offers f
   LEFT JOIN public.nightclub_dj_escrow_movements m ON m.offer_id=f.id
   GROUP BY f.id
 ), violations AS (
   SELECT
      COUNT(*)::bigint total_offers,
      COALESCE(SUM(fee) FILTER(WHERE status IN('offered','accepted','booked')),0)::bigint held_cash,
      COUNT(*) FILTER(WHERE funded<>fee)::bigint missing_or_mismatched_funding,
      COUNT(*) FILTER(WHERE (status IN('offered','accepted','booked') AND (paid<>0 OR refunded<>0))
        OR (status IN('declined','cancelled','expired','missed') AND (paid<>0 OR refunded<>fee))
        OR (status='settled' AND (paid+refunded<>fee)))::bigint invalid_escrow_conservation,
      COUNT(*) FILTER(WHERE (status IN('booked','settled') AND booking_id IS NULL)
        OR (status IN('offered','accepted','declined','expired') AND booking_id IS NOT NULL))::bigint invalid_booking_link,
      COUNT(*) FILTER(WHERE status IN('offered','accepted') AND expires_at<clock_timestamp()-interval '30 minutes')::bigint stale_expired_holds,
      COUNT(*) FILTER(WHERE status IN('offered','accepted') AND EXISTS (
       SELECT 1 FROM public.nightclub_dj_residency_occurrences occ
       JOIN public.nightclub_dj_residencies res ON res.id=occ.residency_id
       WHERE occ.application_id=sums.application_id
        AND res.status='ended' AND res.ended_at<clock_timestamp()-interval '30 minutes'
      ))::bigint stale_ended_residency_holds
   FROM sums
 ), bookings AS (
  SELECT COUNT(*) FILTER(WHERE f.status='booked'
   AND b.status IN('cancelled','missed','completed'))::bigint contradictory_booked_status
  FROM public.nightclub_dj_funded_offers f
  JOIN public.dj_bookings b ON b.id=f.booking_id
 )
 SELECT jsonb_build_object(
   'checked_at',clock_timestamp(),
   'scope','dj_funded_offer_finance_only',
   'feature_flags_verified',false,
   'requires_independent_media_and_release_gate',true,
   'counts',jsonb_build_object(
    'total_offers',v.total_offers,'held_cash',v.held_cash,
    'missing_or_mismatched_funding',v.missing_or_mismatched_funding,
    'invalid_escrow_conservation',v.invalid_escrow_conservation,
    'invalid_booking_link',v.invalid_booking_link,
    'stale_expired_holds',v.stale_expired_holds,
    'stale_ended_residency_holds',v.stale_ended_residency_holds,
    'contradictory_booked_status',b.contradictory_booked_status),
   'finance_invariants_clear',
    (v.missing_or_mismatched_funding+v.invalid_escrow_conservation+
    v.invalid_booking_link+b.contradictory_booked_status)=0
 ) FROM violations v CROSS JOIN bookings b;
$fn$;
REVOKE ALL ON FUNCTION public.dj_finance_release_health() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.dj_finance_release_health() TO service_role;
COMMENT ON FUNCTION public.dj_finance_release_health() IS
 'Read-only service-role DJ escrow and booking health counters. Not a release certification or player-accessible endpoint.';