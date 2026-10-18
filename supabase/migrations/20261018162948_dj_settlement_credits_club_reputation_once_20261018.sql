-- Applied directly to production Supabase as 20261018162948.
-- Once-only DJ club reputation from authoritative settlement ledger inserts.
-- The ledger's UNIQUE booking_id means settlement retries never run this twice.
CREATE OR REPLACE FUNCTION public.credit_verified_dj_set_club_reputation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_club_id uuid;
 v_rep public.player_club_reputation%ROWTYPE;
 v_visits integer;
 v_sets integer;
 v_spend numeric;
 v_tier text;
 v_perks jsonb;
 v_points integer;
BEGIN
 SELECT b.club_id INTO v_club_id FROM public.dj_bookings b
 WHERE b.id=NEW.booking_id AND b.profile_id=NEW.profile_id
   AND b.user_id=NEW.user_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'DJ reputation requires a verified matching booked set'
     USING ERRCODE='23503';
 END IF;

 SELECT * INTO v_rep FROM public.player_club_reputation
 WHERE profile_id=NEW.profile_id AND club_id=v_club_id FOR UPDATE;
 v_visits:=greatest(0,coalesce(v_rep.visit_count,0));
 v_sets:=greatest(0,coalesce(v_rep.dj_sets_played,0))+1;
 v_spend:=greatest(0,coalesce(v_rep.total_spend,0));
 v_tier:=CASE
   WHEN v_visits+v_sets*2>=50 THEN 'legend'
   WHEN v_visits+v_sets*2>=20 THEN 'vip'
   WHEN v_visits+v_sets*2>=5 THEN 'regular'
   ELSE 'newcomer' END;
 v_perks:=CASE v_tier
   WHEN 'legend' THEN '["Skip cover charge","50% drink discount","VIP lounge access","Priority DJ slots","Backstage access","Fame bonus +10%"]'::jsonb
   WHEN 'vip' THEN '["Skip cover charge","25% drink discount","VIP lounge access","Priority DJ slots"]'::jsonb
   WHEN 'regular' THEN '["Skip cover charge","10% drink discount"]'::jsonb
   ELSE '[]'::jsonb END;
 v_points:=least(2147483647,
   v_visits::bigint*10+v_sets::bigint*25+floor(v_spend/10))::integer;

 IF v_rep.id IS NULL THEN
   INSERT INTO public.player_club_reputation (
     profile_id,club_id,visit_count,dj_sets_played,total_spend,
     reputation_tier,reputation_points,perks_unlocked
   ) VALUES (
     NEW.profile_id,v_club_id,0,1,0,
     v_tier,v_points,v_perks
   );
 ELSE
   UPDATE public.player_club_reputation
     SET dj_sets_played=v_sets,reputation_tier=v_tier,
         reputation_points=v_points,perks_unlocked=v_perks
   WHERE id=v_rep.id;
 END IF;
 RETURN NEW;
END;
$function$

REVOKE ALL ON FUNCTION public.credit_verified_dj_set_club_reputation()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS credit_verified_dj_club_reputation
 ON public.dj_settlement_ledger;
CREATE TRIGGER credit_verified_dj_club_reputation
AFTER INSERT ON public.dj_settlement_ledger
FOR EACH ROW EXECUTE FUNCTION public.credit_verified_dj_set_club_reputation();

COMMENT ON FUNCTION public.credit_verified_dj_set_club_reputation() IS
 'Ledger-insert-only club DJ credit: one trusted booking, one count, no client self-award. Any failure rolls back the whole paid DJ settlement.';
