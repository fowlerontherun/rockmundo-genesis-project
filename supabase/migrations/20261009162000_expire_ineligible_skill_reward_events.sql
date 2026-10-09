-- Resolve permanently ineligible daily skill-XP outcomes with a single
-- player-facing expiry message, never a fictitious skill reward.
create or replace function public.apply_random_event_outcome(p_player_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_profile record;
  v_band_id uuid;
  v_effects jsonb;
  v_applied jsonb;
  v_story text;
  v_grant jsonb;
  v_health integer;
  v_net numeric;
  v_morale_shift integer := 0;
  v_rep_shift integer := 0;
  v_band record;
begin
  select pe.id, pe.user_id, pe.profile_id, pe.choice_made, pe.status,
    pe.outcome_applied, re.id as event_id, re.awards_random_skill_xp,
    re.option_a_effects, re.option_b_effects,
    re.option_a_outcome_text, re.option_b_outcome_text
  into v_event
  from public.player_events pe
  join public.random_events re on re.id = pe.event_id
  where pe.id = p_player_event_id
  for update of pe;

  if not found then return jsonb_build_object('applied', false, 'reason', 'not_found'); end if;
  if v_event.status <> 'awaiting_outcome' or coalesce(v_event.outcome_applied, false) then
    return jsonb_build_object('applied', false, 'reason', 'already_processed');
  end if;
  if v_event.choice_made not in ('a', 'b') then
    return jsonb_build_object('applied', false, 'reason', 'missing_choice');
  end if;

  v_effects := coalesce(
    case when v_event.choice_made = 'a' then v_event.option_a_effects else v_event.option_b_effects end,
    '{}'::jsonb
  );
  v_story := case when v_event.choice_made = 'a' then v_event.option_a_outcome_text else v_event.option_b_outcome_text end;
  v_applied := v_effects;

  -- Target the actual character rather than the first profile on the account.
  select id, cash, health, energy, fame, experience
  into v_profile
  from public.profiles
  where id = v_event.profile_id and user_id = v_event.user_id
  for update;
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'profile_missing');
  end if;

  if v_event.awards_random_skill_xp then
    v_grant := public.grant_random_event_skill_xp(v_event.id);
    if v_grant is null then
      -- The character has no learned skill below its cap. End this event
      -- without granting XP or applying any other choice effects, so the
      -- account is not indefinitely blocked from future daily events.
      -- A separate notification records the resolution exactly once.
      update public.player_events
      set status = 'expired',
          outcome_applied = false,
          outcome_message = 'All your learned skills are already maxed, so no skill XP was awarded.',
          outcome_effects = '{}'::jsonb
      where id = v_event.id and status = 'awaiting_outcome';

      insert into public.player_inbox (
        user_id, category, priority, title, message, metadata,
        related_entity_type, related_entity_id, action_type, action_data
      )
      values (
        v_event.user_id, 'random_event', 'normal',
        'Daily event: No skill XP awarded',
        'All your learned skills are already maxed. This event has expired without an XP reward. You can receive future events normally.',
        jsonb_build_object('event_id', v_event.event_id, 'player_event_id', v_event.id, 'reason', 'no_eligible_skill'),
        'random_event', v_event.event_id, null, null
      );

      return jsonb_build_object('applied', false, 'reason', 'no_eligible_skill', 'expired', true);
    end if;
    v_applied := v_applied || v_grant;
  end if;

  update public.profiles
  set health = least(100, greatest(0, coalesce(health, 100) + coalesce((v_effects->>'health')::integer, 0))),
      energy = least(100, greatest(0, coalesce(energy, 100) + coalesce((v_effects->>'energy')::integer, 0))),
      cash = greatest(0, coalesce(cash, 0) + coalesce((v_effects->>'cash')::integer, 0)),
      fame = greatest(0, coalesce(fame, 0) + coalesce((v_effects->>'fame')::integer, 0)),
      experience = greatest(0, coalesce(experience, 0) + coalesce((v_effects->>'xp')::integer, 0)),
      updated_at = now()
  where id = v_profile.id
  returning health into v_health;

  select bm.band_id into v_band_id
  from public.band_members bm
  where bm.profile_id = v_profile.id
    and coalesce(bm.is_touring_member, false) = false
  order by bm.band_id
  limit 1;
  if v_band_id is not null then
    select id, total_fans, morale, reputation_score into v_band
    from public.bands where id = v_band_id for update;
    if found then
      v_net := coalesce((v_effects->>'cash')::numeric, 0)
             + coalesce((v_effects->>'fans')::numeric, 0) * 10
             + coalesce((v_effects->>'fame')::numeric, 0) * 5
             + coalesce((v_effects->>'health')::numeric, 0) * 2;
      v_morale_shift := case
        when v_net > 200 then 6 when v_net > 50 then 3 when v_net > 0 then 1
        when v_net < -200 then -8 when v_net < -50 then -4 when v_net < 0 then -2 else 0 end;
      v_rep_shift := case
        when coalesce((v_effects->>'health')::numeric, 0) <= -20 then -8
        when coalesce((v_effects->>'health')::numeric, 0) <= -10 then -4
        when coalesce((v_effects->>'fame')::numeric, 0) > 50 then 3 else 0 end;
      update public.bands
      set total_fans = greatest(0, coalesce(total_fans, 0) + coalesce((v_effects->>'fans')::integer, 0)),
          morale = least(100, greatest(0, coalesce(morale, 50) + v_morale_shift)),
          reputation_score = least(100, greatest(-100, coalesce(reputation_score, 0) + v_rep_shift))
      where id = v_band_id;
    end if;
  end if;

  update public.player_events
  set status = 'completed', outcome_applied = true,
      outcome_applied_at = now(),
      outcome_effects = v_applied,
      outcome_message = v_story
  where id = v_event.id;

  return jsonb_build_object(
    'applied', true, 'user_id', v_event.user_id, 'profile_id', v_profile.id,
    'event_id', v_event.event_id, 'effects', v_applied,
    'outcome_message', v_story, 'health_after', v_health
  );
end;
$$;

revoke all on function public.apply_random_event_outcome(uuid) from public, anon, authenticated;
grant execute on function public.apply_random_event_outcome(uuid) to service_role;
