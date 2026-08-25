-- C8 follow-up: durable, bounded hook for later learning/skill consumers.
-- This records eligibility only; it does not let the browser choose a skill or multiplier.

CREATE TABLE public.festival_attendee_reward_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_settlement_id uuid NOT NULL REFERENCES public.festival_attendee_reward_settlements(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unlock_key text NOT NULL CHECK (unlock_key IN ('festival_inspiration_boost')),
  strength integer NOT NULL CHECK (strength BETWEEN 1 AND 10),
  available_from timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attendance_id, unlock_key),
  CHECK (expires_at > available_from)
);

ALTER TABLE public.festival_attendee_reward_unlocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_attendee_reward_unlocks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.festival_attendee_reward_unlocks TO service_role;

CREATE OR REPLACE FUNCTION public._festival_c8_create_reward_unlock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF NEW.inspiration_score >= 75 AND NEW.attendance_status = 'completed' THEN
    INSERT INTO public.festival_attendee_reward_unlocks(
      reward_settlement_id, attendance_id, profile_id, unlock_key, strength, expires_at, metadata
    ) VALUES (
      NEW.id, NEW.attendance_id, NEW.profile_id, 'festival_inspiration_boost',
      least(10, greatest(1, floor((NEW.inspiration_score - 65) / 5.0)::integer)),
      NEW.settled_at + interval '72 hours',
      jsonb_build_object('source','festival-c8','inspirationScore',NEW.inspiration_score,'consumerAuthority','future-skill-learning-rpc')
    ) ON CONFLICT (attendance_id, unlock_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._festival_c8_create_reward_unlock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_c8_create_reward_unlock() TO service_role;
DROP TRIGGER IF EXISTS festival_c8_create_reward_unlock ON public.festival_attendee_reward_settlements;
CREATE TRIGGER festival_c8_create_reward_unlock
AFTER INSERT ON public.festival_attendee_reward_settlements
FOR EACH ROW EXECUTE FUNCTION public._festival_c8_create_reward_unlock();

CREATE OR REPLACE FUNCTION public.get_my_festival_reward_unlocks(p_attendance_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_profile uuid := public.current_profile_id(); v_items jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.festival_player_attendance a WHERE a.id=p_attendance_id AND a.profile_id=v_profile) THEN
    RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE='P0001';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'unlockKey',u.unlock_key,'strength',u.strength,'availableFrom',u.available_from,'expiresAt',u.expires_at,
    'consumedAt',u.consumed_at,'available',u.consumed_at IS NULL AND u.expires_at > now()
  ) ORDER BY u.created_at),'[]'::jsonb) INTO v_items
  FROM public.festival_attendee_reward_unlocks u
  WHERE u.attendance_id=p_attendance_id AND u.profile_id=v_profile;
  RETURN jsonb_build_object('attendanceId',p_attendance_id,'items',v_items,'serverNow',now());
END;
$function$;
REVOKE ALL ON FUNCTION public.get_my_festival_reward_unlocks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_reward_unlocks(uuid) TO authenticated, service_role;
