-- Notify the referrer once when a recruit genuinely qualifies.
-- Qualification remains idempotent and uses the existing anti-farm conditions.
create or replace function public.refresh_referral_qualification()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
  v_row record;
  v_referrer_profile_id uuid;
  v_recruit_name text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  for v_row in
    update public.referrals r
    set signup_qualified_at = now()
    where r.referrer_user_id = v_user_id
      and r.signup_qualified_at is null
      and exists (
        select 1 from auth.users au
        where au.id = r.referred_user_id
          and au.email_confirmed_at is not null
          and au.created_at <= now() - interval '24 hours'
      )
      and exists (
        select 1 from public.profiles p
        where p.user_id = r.referred_user_id
          and coalesce(p.is_active, true)
          and (
            coalesce(p.total_hours_played, 0) >= 1
            or coalesce(p.experience, 0) >= 100
            or coalesce(p.level, 1) >= 2
          )
      )
    returning r.id, r.referred_user_id, r.metadata
  loop
    v_count := v_count + 1;

    select p.id into v_referrer_profile_id
    from public.profiles p
    where p.user_id = v_user_id and coalesce(p.is_active, true)
    order by p.last_active_at desc nulls last, p.created_at asc
    limit 1;

    select coalesce(p.display_name, p.username, p.name, 'A player') into v_recruit_name
    from public.profiles p
    where p.user_id = v_row.referred_user_id and coalesce(p.is_active, true)
    order by p.created_at asc
    limit 1;

    if not exists (
      select 1 from public.player_inbox pi
      where pi.user_id = v_user_id
        and pi.metadata->>'referral_id' = v_row.id::text
        and pi.metadata->>'event' = 'referral_qualified'
    ) then
      insert into public.player_inbox(
        user_id, profile_id, category, priority, title, message, metadata,
        action_type, action_data, related_entity_type, related_entity_id
      ) values (
        v_user_id, v_referrer_profile_id, 'social'::public.inbox_category, 'normal'::public.inbox_priority,
        'Your referral qualified',
        coalesce(v_recruit_name, 'A player') || ' has become an active RockMundo player. Your referral reward is ready to claim.',
        jsonb_build_object('event','referral_qualified','referral_id',v_row.id,'referred_user_id',v_row.referred_user_id),
        'navigate', jsonb_build_object('route','/social/referrals'),
        'referral', v_row.id
      );
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.refresh_referral_qualification() from public, anon;
grant execute on function public.refresh_referral_qualification() to authenticated;
