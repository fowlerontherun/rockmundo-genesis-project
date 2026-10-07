create or replace function public.bind_referral_code(p_code text, p_source text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_user_id uuid:=auth.uid(); v_referrer uuid; v_created_at timestamptz; v_existing public.referrals%rowtype;
 v_source text:=lower(trim(coalesce(p_source,'')));
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 select created_at into v_created_at from auth.users where id=v_user_id;
 if v_created_at is null then raise exception 'User not found'; end if;
 select * into v_existing from public.referrals where referred_user_id=v_user_id;
 if found then return jsonb_build_object('bound',true,'already_bound',true,'referral_id',v_existing.id); end if;
 if v_created_at<now()-interval '30 days' then raise exception 'Referral codes can only be linked to accounts less than 30 days old'; end if;
 select user_id into v_referrer from public.referral_codes where code=upper(trim(p_code));
 if v_referrer is null then raise exception 'Invalid referral code'; end if;
 if v_referrer=v_user_id then raise exception 'You cannot refer yourself'; end if;
 if v_source !~ '^[a-z0-9_]{2,40}$' then v_source:='manual_code'; end if;
 insert into public.referrals(referrer_user_id,referred_user_id,referral_code,metadata)
 values(v_referrer,v_user_id,upper(trim(p_code)),jsonb_build_object('source',v_source))
 returning * into v_existing;
 return jsonb_build_object('bound',true,'already_bound',false,'referral_id',v_existing.id);
end; $$;
revoke all on function public.bind_referral_code(text,text) from public,anon,authenticated;
grant execute on function public.bind_referral_code(text,text) to authenticated;

create or replace function public.capture_referral_from_signup()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_code text; v_referrer uuid; v_band_id uuid; v_source text;
begin
 v_code:=upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
 if v_code='' then return new; end if;
 select user_id into v_referrer from public.referral_codes where code=v_code;
 if v_referrer is null or v_referrer=new.id then return new; end if;
 v_source:=lower(trim(coalesce(new.raw_user_meta_data->>'referral_source','signup_metadata')));
 if v_source !~ '^[a-z0-9_]{2,40}$' then v_source:='signup_metadata'; end if;
 begin v_band_id:=nullif(new.raw_user_meta_data->>'referral_band_id','')::uuid; exception when invalid_text_representation then v_band_id:=null; end;
 if v_band_id is not null and not exists(
  select 1 from public.band_members bm join public.profiles p on p.id=bm.profile_id
  where bm.band_id=v_band_id and p.user_id=v_referrer and coalesce(bm.member_status,'active')='active' and coalesce(bm.is_touring_member,false)=false
 ) then v_band_id:=null; end if;
 insert into public.referrals(referrer_user_id,referred_user_id,referral_code,metadata)
 values(v_referrer,new.id,v_code,jsonb_strip_nulls(jsonb_build_object('source',v_source,'band_id',v_band_id)))
 on conflict(referred_user_id) do nothing;
 return new;
end; $$;