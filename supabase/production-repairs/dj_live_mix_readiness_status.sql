-- Read-only, owner-scoped settlement readiness. Uses exactly the six
-- criteria in require_dj_live_mix_for_settlement() and does not pay rewards.
-- SECURITY INVOKER + existing booking/session/event RLS is intentional.
CREATE OR REPLACE FUNCTION public.dj_live_mix_readiness(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE
 v_book record;
 v_session_id uuid;
 v_count integer:=0;
 v_a boolean:=false;
 v_b boolean:=false;
 v_tempo boolean:=false;
 v_crossfade boolean:=false;
 v_first timestamptz;
 v_last timestamptz;
 v_later integer:=0;
 v_span boolean:=false;
 v_sufficient boolean:=false;
 v_due boolean:=false;
BEGIN
 IF p_booking_id IS NULL OR auth.uid() IS NULL THEN RETURN NULL; END IF;
 SELECT b.id,b.profile_id,b.user_id,b.status,b.starts_at,b.ends_at
 INTO v_book FROM public.dj_bookings b
 WHERE b.id=p_booking_id AND b.user_id=auth.uid();
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT s.id INTO v_session_id
 FROM public.dj_performance_sessions s
 WHERE s.booking_id=v_book.id AND s.user_id=auth.uid();
 IF v_session_id IS NOT NULL THEN
   SELECT count(*)::integer,
     coalesce(bool_or(deck='A') FILTER(WHERE kind='deck_play'),false),
     coalesce(bool_or(deck='B') FILTER(WHERE kind='deck_play'),false),
     coalesce(bool_or(kind='tempo'),false),
     coalesce(bool_or(kind='crossfade'),false),
     min(recorded_at),max(recorded_at),
     (count(*) FILTER(WHERE recorded_at>=v_book.starts_at
       +(v_book.ends_at-v_book.starts_at)/2))::integer
   INTO v_count,v_a,v_b,v_tempo,v_crossfade,v_first,v_last,v_later
   FROM public.dj_live_mix_events e
   WHERE e.session_id=v_session_id AND e.booking_id=v_book.id
     AND e.user_id=auth.uid();
 END IF;
 v_span:=v_first IS NOT NULL AND v_last>=v_first+interval '60 seconds';
 v_sufficient:=v_count>=6 AND v_a AND v_b AND v_tempo AND v_crossfade
   AND v_span AND v_later>=1;
 v_due:=now()>=v_book.ends_at;
 RETURN jsonb_build_object(
  'booking_id',v_book.id,
  'status',v_book.status,
  'count',v_count,
  'needs_count',greatest(0,6-v_count),
  'deck_a',v_a,
  'deck_b',v_b,
  'tempo',v_tempo,
  'crossfade',v_crossfade,
  'time_span',v_span,
  'after_midpoint',v_later>0,
  'past_end',v_due,
  'evidence_ready',v_sufficient,
  'can_settle',v_book.status='live' AND v_due AND v_sufficient
 );
END;
$$;

-- Supabase may have direct grants besides PUBLIC defaults.
REVOKE ALL ON FUNCTION public.dj_live_mix_readiness(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dj_live_mix_readiness(uuid)
 TO authenticated;

COMMENT ON FUNCTION public.dj_live_mix_readiness(uuid) IS
 'Owner-scoped read-only DJ performance checklist matching atomic settlement evidence gate; no rewards or client evidence writes.';
