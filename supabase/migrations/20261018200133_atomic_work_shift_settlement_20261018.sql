CREATE TABLE IF NOT EXISTS public.work_shift_settlements (
 shift_id uuid PRIMARY KEY REFERENCES public.shift_history(id) ON DELETE RESTRICT,
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 activity_id uuid NOT NULL UNIQUE,
 gross_earnings integer NOT NULL CHECK(gross_earnings>=0),
 city_tax integer NOT NULL CHECK(city_tax>=0),
 net_earnings integer NOT NULL CHECK(net_earnings>=0),
 xp_earned integer NOT NULL,
 fame_change integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_shift_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.work_shift_settlements FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.settle_work_shift_atomic(p_activity_id uuid,p_shift_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $settle$
DECLARE
 s public.shift_history%rowtype;
 a public.profile_activity_statuses%rowtype;
 p public.profiles%rowtype;
 e public.player_employment%rowtype;
 j public.jobs%rowtype;
 v_gross integer;
 v_tax integer:=0;
 v_net integer;
 v_rate numeric:=0;
 v_fame integer;
 v_base_fame integer;
 v_band_id uuid;
 v_band_name text;
 v_band_popularity numeric;
 v_is_leader boolean:=false;
 v_multiplier numeric:=1;
 v_tier_multiplier numeric:=1;
 v_morale_delta integer:=0;
 v_morale numeric;
 v_existing jsonb;
 v_now timestamptz:=clock_timestamp();
BEGIN
 -- Shift row is the serialization point for overlapping or retried workers.
 SELECT * INTO s FROM public.shift_history WHERE id=p_shift_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'work_shift_not_found'; END IF;
 IF s.status='completed' THEN
   SELECT to_jsonb(ws) INTO v_existing FROM public.work_shift_settlements ws WHERE shift_id=s.id;
   RETURN jsonb_build_object('settled',false,'already_completed',true,'receipt',v_existing);
 END IF;
 IF s.status IS DISTINCT FROM 'in_progress' THEN RAISE EXCEPTION 'work_shift_not_in_progress'; END IF;
 SELECT * INTO a FROM public.profile_activity_statuses WHERE id=p_activity_id FOR UPDATE;
 IF NOT FOUND OR a.status IS DISTINCT FROM 'active' OR a.activity_type IS DISTINCT FROM 'work_shift'
  OR a.profile_id IS DISTINCT FROM s.profile_id
  OR a.metadata->>'shift_history_id' IS DISTINCT FROM s.id::text
  OR a.ends_at IS NULL OR a.ends_at > v_now
 THEN RAISE EXCEPTION 'work_shift_activity_not_due_or_mismatched'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=s.profile_id FOR UPDATE;
 IF NOT FOUND OR p.user_id IS NULL THEN RAISE EXCEPTION 'work_shift_owner_not_found'; END IF;
 SELECT * INTO e FROM public.player_employment WHERE id=s.employment_id FOR UPDATE;
 IF NOT FOUND OR e.profile_id IS DISTINCT FROM s.profile_id OR e.job_id IS DISTINCT FROM s.job_id
 THEN RAISE EXCEPTION 'work_shift_employment_mismatch'; END IF;
 SELECT * INTO j FROM public.jobs WHERE id=s.job_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'work_shift_job_missing'; END IF;
 -- An old partially written payout must be reviewed, not awarded again.
 IF EXISTS(SELECT 1 FROM public.experience_ledger l
  WHERE l.activity_type='work_shift' AND l.metadata->>'shift_id'=s.id::text)
 OR EXISTS(SELECT 1 FROM public.city_treasury_ledger l
  WHERE l.type='employment_income_tax' AND l.reference_id=s.id)
 OR EXISTS(SELECT 1 FROM public.work_shift_settlements ws WHERE ws.shift_id=s.id)
 THEN RAISE EXCEPTION 'work_shift_existing_partial_settlement_requires_review'; END IF;
 v_gross:=greatest(0,coalesce(s.earnings,0));
 IF j.city_id IS NOT NULL AND v_gross>0 THEN
   SELECT greatest(0,least(50,coalesce(income_tax_rate,0))) INTO v_rate
    FROM public.city_laws WHERE city_id=j.city_id AND effective_until IS NULL
    ORDER BY effective_from DESC NULLS LAST LIMIT 1;
   v_tax:=round(v_gross*coalesce(v_rate,0)/100)::integer;
 END IF;
 v_net:=v_gross-v_tax;
 v_base_fame:=coalesce(j.base_fame_impact,s.fame_impact,0);
 SELECT bm.band_id,b.name,coalesce(nullif(b.popularity,0),nullif(b.fame,0),0),
        bm.role='leader'
 INTO v_band_id,v_band_name,v_band_popularity,v_is_leader
 FROM public.band_members bm JOIN public.bands b ON b.id=bm.band_id
 WHERE bm.profile_id=s.profile_id AND bm.member_status='active'
 ORDER BY bm.id LIMIT 1;
 v_fame:=v_base_fame;
 IF j.fame_penalty_tier IS NOT NULL AND j.fame_penalty_tier<>'none' AND v_base_fame<0 THEN
   v_multiplier:=CASE WHEN coalesce(v_band_popularity,0)>=100000 THEN 5
    WHEN coalesce(v_band_popularity,0)>=50000 THEN 4
    WHEN coalesce(v_band_popularity,0)>=10000 THEN 3
    WHEN coalesce(v_band_popularity,0)>=1000 THEN 2 ELSE 1 END;
   v_tier_multiplier:=CASE j.fame_penalty_tier WHEN 'severe' THEN 1.5
     WHEN 'moderate' THEN 1.25 ELSE 1 END;
   v_fame:=floor(v_base_fame*v_multiplier*v_tier_multiplier*
     CASE WHEN coalesce(v_is_leader,false) THEN 1.5 ELSE 1 END)::integer;
 END IF;
 -- City money and every profile/employment mutation run inside THIS transaction.
 IF v_tax>0 THEN
   PERFORM public.credit_city_treasury(j.city_id,v_tax,'employment_income_tax',
     format('Wage withholding (%s%%) — %s',coalesce(v_rate,0),j.title),s.id);
 END IF;
 UPDATE public.shift_history SET status='completed',clock_out_time=v_now,fame_impact=v_fame
 WHERE id=s.id;
 UPDATE public.player_employment SET shifts_completed=coalesce(shifts_completed,0)+1,
  total_earnings=coalesce(total_earnings,0)+v_net,last_shift_at=v_now WHERE id=e.id;
 UPDATE public.profiles SET cash=coalesce(cash,0)+v_net,
   health=least(100,greatest(0,coalesce(health,100)+coalesce(s.health_impact,0))),
   fame=greatest(0,coalesce(fame,0)+v_fame)
 WHERE id=p.id;
 INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,metadata)
 VALUES(p.user_id,p.id,'work_shift',coalesce(s.xp_earned,0),
   jsonb_build_object('job_id',j.id,'shift_id',s.id,'fame_change',v_fame,
    'job_title',j.title,'band_name',v_band_name,'gross_earnings',v_gross,
    'net_earnings',v_net,'city_income_tax',v_tax,'city_id',j.city_id,
    'transaction_ref',s.id::text));
 UPDATE public.player_scheduled_activities SET status='completed',completed_at=v_now
  WHERE linked_job_shift_id=s.id AND status IS DISTINCT FROM 'completed';
 DELETE FROM public.profile_activity_statuses WHERE id=a.id;
 IF v_band_id IS NOT NULL THEN
   v_morale_delta:=CASE WHEN v_fame< -5 THEN -3 WHEN v_fame<0 THEN -1
     WHEN v_gross>=500 THEN 2 WHEN v_gross>=100 THEN 1 ELSE 0 END;
   IF v_morale_delta<>0 THEN
     UPDATE public.bands SET morale=greatest(0,least(100,coalesce(morale,50)+v_morale_delta))
     WHERE id=v_band_id RETURNING morale INTO v_morale;
     INSERT INTO public.band_health_events(band_id,event_type,delta,new_value,source,description)
      VALUES(v_band_id,'morale',v_morale_delta,v_morale,'work_shift',
       CASE WHEN v_morale_delta<0 THEN format('Humiliating work shift (fame %s)',v_fame)
        ELSE format('Work shift earned $%s',v_gross) END);
   END IF;
 END IF;
 INSERT INTO public.work_shift_settlements(shift_id,profile_id,user_id,activity_id,
   gross_earnings,city_tax,net_earnings,xp_earned,fame_change)
 VALUES(s.id,p.id,p.user_id,a.id,v_gross,v_tax,v_net,coalesce(s.xp_earned,0),v_fame);
 RETURN jsonb_build_object('settled',true,'gross',v_gross,'net',v_net,
   'city_tax',v_tax,'xp',coalesce(s.xp_earned,0),'fame',v_fame);
END;
$settle$;
REVOKE ALL ON FUNCTION public.settle_work_shift_atomic(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_work_shift_atomic(uuid,uuid) TO service_role;