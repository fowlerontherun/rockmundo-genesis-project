create or replace function public.admin_get_referral_promoter_visual(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_owner uuid;
  v_profile public.profiles%rowtype;
  v_appearance jsonb;
begin
  if v_admin is null or not exists (select 1 from public.user_roles ur where ur.user_id=v_admin and ur.role::text='admin') then raise exception 'Admin access required'; end if;
  select rc.user_id into v_owner from public.referral_codes rc where rc.code=upper(trim(p_referral_code)) limit 1;
  if v_owner is null then raise exception 'Referral code not found'; end if;
  select p.* into v_profile from public.profiles p where p.user_id=v_owner and p.deleted_at is null
  order by coalesce(p.is_active,false) desc,p.last_login_at desc nulls last,p.slot_number asc nulls last,p.created_at asc limit 1;
  if v_profile.id is null then return null; end if;
  select psa.appearance into v_appearance from public.player_stage_appearances psa where psa.profile_id=v_profile.id limit 1;
  if v_appearance is null then
    select jsonb_strip_nulls(jsonb_build_object('gender',pac.gender,'skinTone',pac.skin_tone,'hairColor',pac.hair_color,'height',pac.height,'shirtColor',pac.shirt_color,'pantsColor',pac.pants_color,'shoesColor',pac.shoes_color))
    into v_appearance from public.player_avatar_config pac where pac.profile_id=v_profile.id limit 1;
  end if;
  return jsonb_build_object('profile_id',v_profile.id,'display_name',coalesce(v_profile.display_name,v_profile.username),'appearance',v_appearance);
end;
$$;
revoke all on function public.admin_get_referral_promoter_visual(text) from public,anon,authenticated;
grant execute on function public.admin_get_referral_promoter_visual(text) to authenticated;
