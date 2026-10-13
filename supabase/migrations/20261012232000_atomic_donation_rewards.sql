-- Only service-role callers can redeem a verified donation Stripe session.
CREATE TABLE IF NOT EXISTS public.donation_reward_redemptions (
 session_id text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 profile_id uuid NOT NULL,
 redeemed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.donation_reward_redemptions ENABLE ROW LEVEL SECURITY;

-- This legacy project does not currently have the Project Supporter definition.
-- Seed it once so the redemption RPC can award the promised badge.
INSERT INTO public.achievements(name, description, icon, category, rarity, requirements, rewards)
SELECT 'Project Supporter', 'Generously donated to support Rockmundo development',
       'heart', 'special', 'legendary', '{"donation":true}'::jsonb,
       '{"xp":1000,"badge":"supporter"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Project Supporter');

REVOKE ALL ON public.donation_reward_redemptions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_verified_donation_reward(p_user_id uuid, p_profile_id uuid, p_session_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_achievement uuid;
BEGIN
 IF p_session_id IS NULL OR length(p_session_id) = 0 THEN RAISE EXCEPTION 'Session required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = p_user_id) THEN
  RAISE EXCEPTION 'Profile does not belong to user';
 END IF;
 INSERT INTO public.donation_reward_redemptions(session_id,user_id,profile_id)
 VALUES (p_session_id,p_user_id,p_profile_id) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN
  IF NOT EXISTS (SELECT 1 FROM public.donation_reward_redemptions WHERE session_id=p_session_id AND user_id=p_user_id) THEN
    RAISE EXCEPTION 'Session owner mismatch';
  END IF;
  RETURN 'already_redeemed';
 END IF;
 INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,metadata)
 VALUES (p_user_id,p_profile_id,'project_donation',1000,jsonb_build_object('session_id',p_session_id));
 UPDATE public.profiles SET experience=COALESCE(experience,0)+1000 WHERE id=p_profile_id;
 SELECT id INTO v_achievement FROM public.achievements WHERE name='Project Supporter' ORDER BY created_at LIMIT 1;
 IF v_achievement IS NOT NULL THEN
  INSERT INTO public.player_achievements(user_id,achievement_id,progress,unlocked_at)
  VALUES (p_user_id,v_achievement,'{"donation":true}'::jsonb,now()) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO public.activity_feed(user_id,activity_type,message,earnings,metadata)
 VALUES(p_user_id,'donation','Made a donation to support Rockmundo!',0,jsonb_build_object('session_id',p_session_id,'xp_earned',1000));
 RETURN 'redeemed';
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_verified_donation_reward(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_verified_donation_reward(uuid,uuid,text) TO service_role;
