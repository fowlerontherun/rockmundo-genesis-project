create or replace function public.get_my_referral_context()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_row record; v_band_id uuid; v_band_name text;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 select r.id,r.referrer_user_id,r.referral_code,r.bound_at,r.metadata into v_row
 from public.referrals r where r.referred_user_id=v_user_id limit 1;
 if not found then return jsonb_build_object('referred',false); end if;
 begin v_band_id:=nullif(v_row.metadata->>'band_id','')::uuid; exception when invalid_text_representation then v_band_id:=null; end;
 if v_band_id is not null then select b.name into v_band_name from public.bands b where b.id=v_band_id; end if;
 return jsonb_strip_nulls(jsonb_build_object(
  'referred',true,'referral_id',v_row.id,'bound_at',v_row.bound_at,
  'source',coalesce(nullif(v_row.metadata->>'source',''),'unknown'),
  'band',case when v_band_id is not null and v_band_name is not null then jsonb_build_object('band_id',v_band_id,'name',v_band_name) else null end
 ));
end; $$;
revoke all on function public.get_my_referral_context() from public,anon,authenticated;
grant execute on function public.get_my_referral_context() to authenticated;