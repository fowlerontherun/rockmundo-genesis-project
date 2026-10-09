-- Event delivery belongs to the SAME transaction as outcome completion.
-- Only the false -> true outcome_applied transition emits messages or admits a patient.
-- A failed notification/admission rolls back completion and its core rewards,
-- allowing the worker to retry safely with no partial outcome.

create or replace function private.deliver_random_event_outcome()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_title text;
  v_city_id uuid;
  v_health numeric;
  v_hospital record;
  v_days integer;
  v_effects jsonb;
  v_summary text[] := array[]::text[];
  v_key text;
  v_unit text;
  v_value integer;
begin
  if coalesce(new.outcome_applied, false) = false
     or coalesce(old.outcome_applied, false) = true
     or new.status <> 'completed' then
    return new;
  end if;

  select title into strict v_title
  from public.random_events where id = new.event_id;

  v_effects := coalesce(new.outcome_effects, '{}'::jsonb);

  foreach v_key in array array['cash', 'fame', 'fans', 'health', 'energy', 'xp'] loop
    if v_effects ? v_key and jsonb_typeof(v_effects -> v_key) = 'number' then
      v_value := (v_effects ->> v_key)::integer;
      if v_value <> 0 then
        v_unit := case v_key when 'cash' then '$' when 'xp' then ' XP' else ' ' || v_key end;
        if v_key = 'cash' then
          v_summary := array_append(v_summary, case when v_value > 0 then '+' else '' end || '$' || v_value::text);
        else
          v_summary := array_append(v_summary, case when v_value > 0 then '+' else '' end || v_value::text || v_unit);
        end if;
      end if;
    end if;
  end loop;

  if v_effects ? 'skill_xp' and v_effects ? 'skill_slug'
     and jsonb_typeof(v_effects->'skill_xp') = 'number' then
    v_summary := array_append(v_summary,
      '+' || (v_effects->>'skill_xp') || ' ' ||
      replace(v_effects->>'skill_slug', '_', ' ') || ' skill XP');
  end if;

  insert into public.activity_feed (user_id, activity_type, message, metadata)
  values (
    new.user_id, 'random_event_outcome',
    'Event outcome: ' || coalesce(new.outcome_message, ''),
    jsonb_build_object('event_id', new.event_id, 'player_event_id', new.id, 'effects', v_effects)
  );

  insert into public.player_inbox (
    user_id, category, priority, title, message, metadata,
    related_entity_type, related_entity_id, action_type, action_data
  )
  values (
    new.user_id, 'random_event', 'normal',
    '📋 Event Outcome: ' || v_title,
    coalesce(new.outcome_message, '') ||
      case when array_length(v_summary, 1) > 0
        then E'\n\nEffects: ' || array_to_string(v_summary, ', ')
        else '' end,
    jsonb_build_object('event_id', new.event_id, 'player_event_id', new.id, 'effects', v_effects),
    'random_event', new.event_id, null, null
  );

  -- Hospitalization is an event transition effect as well, not a separate
  -- best-effort worker step that could be lost or repeated.
  select p.current_city_id, p.health
  into v_city_id, v_health
  from public.profiles p where p.id = new.profile_id and p.user_id = new.user_id;

  if v_health < 10 and v_city_id is not null then
    select id, name, effectiveness_rating, cost_per_day
    into v_hospital
    from public.hospitals
    where city_id = v_city_id
    order by id limit 1;

    if found then
      v_days := greatest(1, least(3,
        ceil((100 - v_hospital.effectiveness_rating) / 50.0)::integer + 1));
      insert into public.player_hospitalizations (
        user_id, hospital_id, reason, daily_cost, estimated_discharge_at
      )
      values (
        new.user_id, v_hospital.id,
        'Health emergency from event: ' || v_title,
        v_hospital.cost_per_day,
        now() + make_interval(days => v_days)
      );

      insert into public.activity_feed (user_id, activity_type, message, metadata)
      values (
        new.user_id, 'hospitalized',
        'Rushed to ' || v_hospital.name || ' for emergency treatment',
        jsonb_build_object('hospital_id', v_hospital.id, 'recovery_days', v_days,
          'player_event_id', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.deliver_random_event_outcome() from public, anon, authenticated;
drop trigger if exists trg_deliver_random_event_outcome on public.player_events;
create trigger trg_deliver_random_event_outcome
after update of outcome_applied on public.player_events
for each row
when (old.outcome_applied is distinct from new.outcome_applied)
execute function private.deliver_random_event_outcome();
