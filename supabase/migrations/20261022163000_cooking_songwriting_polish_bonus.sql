-- Server-authoritative cooking food buffs on final songwriting polish.
-- Safe cutover: abort if the live resolver changed since review.
DO $verify$
BEGIN
 IF md5(pg_get_functiondef('private.rockmundo_resolve_songwriting_polish(uuid)'::regprocedure))
    <> '81074fb8d096ecdb9fd67934f69ee6d5'
 THEN RAISE EXCEPTION 'SONGWRITING_POLISH_RESOLVER_VERSION_DRIFT'; END IF;
END $verify$;

-- Store the real bonus in the immutable session outcome.
ALTER TABLE public.songwriting_polish_sessions
 ADD COLUMN IF NOT EXISTS food_bonus_percent integer NOT NULL DEFAULT 0
   CHECK (food_bonus_percent BETWEEN 0 AND 5),
 ADD COLUMN IF NOT EXISTS food_bonus_quality integer NOT NULL DEFAULT 0
   CHECK (food_bonus_quality BETWEEN 0 AND 10);

-- Private, non-mutating, receipt-backed lookup. This helper also supports
-- future recovery processing without assuming UI forecasts are real awards.
CREATE OR REPLACE FUNCTION cooking_internal.food_effect_percent_for_window(
 p_profile_id uuid,p_effect_slug text,p_started_at timestamptz,p_ended_at timestamptz
) RETURNS integer
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $lookup$
 SELECT CASE
   WHEN p_profile_id IS NULL OR p_effect_slug NOT IN (
     'recovery','practice_xp','rehearsal','songwriting_polish','focus')
     OR p_started_at IS NULL OR p_ended_at IS NULL
     OR p_ended_at<=p_started_at THEN 0
   ELSE COALESCE((
     SELECT LEAST(5,GREATEST(0,MAX(c.effect_percent)))
     FROM public.cooking_food_consumptions c
     WHERE c.profile_id=p_profile_id
       AND c.effect_slug=p_effect_slug
       AND c.effect_applied IS TRUE
       AND c.consumed_at<=p_started_at
       AND c.effect_expires_at>=p_ended_at
   ),0)
 END;
$lookup$;
REVOKE ALL ON FUNCTION cooking_internal.food_effect_percent_for_window(
 uuid,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION cooking_internal.food_effect_percent_for_window(
 uuid,text,timestamptz,timestamptz) TO service_role;

-- Quality benefits affect only successful polished songs. Do not boost
-- the deterministic success roll or existing chance; all progress remains
-- bounded by the pre-existing quality ceiling of 1000.
CREATE OR REPLACE FUNCTION private.rockmundo_resolve_songwriting_polish(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_s public.songwriting_polish_sessions%ROWTYPE;v_p public.songwriting_projects%ROWTYPE;
 v_roll integer;v_win boolean;v_gain integer:=0;v_before integer;v_after integer;
 v_food_percent integer:=0; v_food_bonus integer:=0;
BEGIN
 SELECT * INTO v_s FROM public.songwriting_polish_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'POLISH_SESSION_NOT_FOUND'; END IF;
 IF v_s.completed_at IS NOT NULL THEN
  RETURN jsonb_build_object('duplicate',true,'session_id',v_s.id,'succeeded',v_s.succeeded,
   'quality_after',v_s.quality_after,'quality_before',v_s.quality_before,
   'food_bonus_percent',v_s.food_bonus_percent,'food_bonus_quality',v_s.food_bonus_quality);
 END IF;
 IF v_s.scheduled_end>now() THEN RAISE EXCEPTION 'POLISH_SESSION_STILL_IN_PROGRESS'; END IF;
 SELECT * INTO v_p FROM public.songwriting_projects WHERE id=v_s.project_id FOR UPDATE;
 IF NOT FOUND OR v_p.song_id IS NOT NULL THEN RAISE EXCEPTION 'POLISH_PROJECT_UNAVAILABLE'; END IF;
 v_before:=least(1000,greatest(0,coalesce(v_p.writing_quality_score,v_s.quality_before,v_p.quality_score,50)));
 v_roll:=(abs(hashtext(v_s.id::text)::bigint)%100+1)::integer;
 v_win:=v_roll<=v_s.success_chance;
 IF v_win THEN
   v_gain:=(80+abs(hashtext('gain:'||v_s.id::text)::bigint)%121)::integer;
   -- Use immutable consumption receipts covering the WHOLE planned polish
   -- interval. Async completion may happen well after the buff expires.
   v_food_percent:=cooking_internal.food_effect_percent_for_window(
     v_s.profile_id,'songwriting_polish',v_s.started_at,v_s.scheduled_end);
   v_food_bonus:=least(10,round(v_gain*v_food_percent::numeric/100)::integer);
 END IF;
 v_after:=least(1000,v_before+v_gain+v_food_bonus);
 -- Reflect only the bonus actually granted under the song-quality cap.
 v_food_bonus:=greatest(0,v_after-least(1000,v_before+v_gain));
 UPDATE public.songwriting_polish_sessions SET completed_at=now(),success_roll=v_roll,
    succeeded=v_win,polish_gain=v_gain,food_bonus_percent=v_food_percent,
    food_bonus_quality=v_food_bonus,quality_before=v_before,quality_after=v_after WHERE id=v_s.id;
 UPDATE public.songwriting_projects SET polish_succeeded=v_win,polish_resolved_at=now(),
  writing_quality_score=v_after,is_locked=false,locked_until=NULL,updated_at=now(),
  completion_quality_breakdown=coalesce(completion_quality_breakdown,'{}'::jsonb)
    ||jsonb_build_object('polish_gain',v_gain,'food_bonus_percent',v_food_percent,
     'food_bonus_quality',v_food_bonus,'polish_roll',v_roll,'final_score',v_after)
 WHERE id=v_p.id;
 UPDATE public.player_scheduled_activities SET status='completed',completed_at=now(),
   metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('polish_succeeded',v_win,'quality_after',v_after)
 WHERE metadata->>'polish_session_id'=v_s.id::text AND status IN ('scheduled','in_progress');
 RETURN jsonb_build_object('session_id',v_s.id,'succeeded',v_win,'success_chance',v_s.success_chance,
   'success_roll',v_roll,'polish_gain',v_gain,'food_bonus_percent',v_food_percent,
   'food_bonus_quality',v_food_bonus,'quality_before',v_before,'quality_after',v_after);
END $function$
;
