-- PR offers: varied scheduling, inbox fan-out, band-wide diary fan-out and stale-offer cleanup.

create or replace function public.prepare_generated_pr_offer_schedule()
returns trigger
language plpgsql
as $$
declare
  v_candidate_date date;
  v_candidate_time text;
  v_slots text[];
  v_attempt integer := 0;
begin
  if new.status = 'pending' and new.band_id is not null and new.time_slot is null then
    v_slots := case new.media_type
      when 'tv' then array['08:30','10:00','13:30','18:30','20:00']
      when 'radio' then array['08:00','10:00','12:00','15:00','18:00']
      when 'podcast' then array['10:00','12:00','14:00','16:00','19:00']
      when 'newspaper' then array['09:30','11:00','13:00','15:00']
      when 'magazine' then array['09:30','11:00','13:00','15:00']
      when 'youtube' then array['12:00','15:00','18:00','20:00']
      when 'website' then array['10:00','14:00','16:00','19:00']
      when 'film' then array['08:00']
      else array['10:00','13:00','16:00','19:00']
    end;

    loop
      v_attempt := v_attempt + 1;
      v_candidate_date := current_date + (1 + floor(random() * 30))::integer;
      v_candidate_time := v_slots[1 + floor(random() * array_length(v_slots, 1))::integer];
      exit when not exists (
        select 1 from public.pr_media_offers existing
        where existing.band_id = new.band_id
          and existing.status in ('pending','accepted')
          and existing.proposed_date = v_candidate_date
          and coalesce(existing.time_slot, '10:00') = v_candidate_time
      ) or v_attempt >= 20;
    end loop;

    new.proposed_date := v_candidate_date;
    new.time_slot := v_candidate_time;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prepare_generated_pr_offer_schedule on public.pr_media_offers;
create trigger trg_prepare_generated_pr_offer_schedule
before insert on public.pr_media_offers
for each row execute function public.prepare_generated_pr_offer_schedule();

create or replace function public.notify_band_of_new_pr_offer()
returns trigger
language plpgsql
as $$
declare
  v_outlet text;
  v_when text;
begin
  if new.status <> 'pending' or new.band_id is null then return new; end if;

  v_outlet := coalesce(new.show_name, new.outlet_name, upper(new.media_type) || ' media');
  v_when := to_char(new.proposed_date, 'DD Mon YYYY') || ' at ' || coalesce(new.time_slot, '10:00') || ' UTC';

  insert into public.player_inbox (
    user_id, category, priority, title, message, metadata,
    action_type, action_data, related_entity_type, related_entity_id, expires_at
  )
  select
    bm.user_id,
    'pr_media',
    'normal',
    'New PR offer: ' || v_outlet,
    'Your band has received a ' || replace(coalesce(new.offer_type, 'general_promo'), '_', ' ') ||
      ' offer from ' || v_outlet || ' for ' || v_when ||
      case when coalesce(new.compensation, 0) > 0 then '. Fee: $' || new.compensation::text else '' end || '.',
    jsonb_build_object(
      'profile_id', bm.profile_id,
      'band_id', new.band_id,
      'offer_id', new.id,
      'media_type', new.media_type,
      'proposed_date', new.proposed_date,
      'time_slot', new.time_slot,
      'compensation', new.compensation,
      'fame_boost', new.fame_boost,
      'fan_boost', new.fan_boost
    ),
    'navigate',
    jsonb_build_object('route', '/public-relations'),
    'pr_media_offer',
    new.id,
    new.expires_at
  from public.band_members bm
  where bm.band_id = new.band_id
    and bm.member_status = 'active'
    and coalesce(bm.is_touring_member, false) = false
    and bm.user_id is not null
    and bm.profile_id is not null;

  return new;
end;
$$;

drop trigger if exists trg_notify_band_of_new_pr_offer on public.pr_media_offers;
create trigger trg_notify_band_of_new_pr_offer
after insert on public.pr_media_offers
for each row execute function public.notify_band_of_new_pr_offer();

create or replace function public.normalize_and_fanout_pr_schedule()
returns trigger
language plpgsql
as $$
declare
  v_offer public.pr_media_offers%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_conflict record;
begin
  if new.activity_type not in ('pr_appearance','film_production')
     or not (coalesce(new.metadata, '{}'::jsonb) ? 'offer_id') then
    return new;
  end if;

  select * into v_offer
  from public.pr_media_offers
  where id = (new.metadata->>'offer_id')::uuid;
  if not found then return new; end if;

  v_start := ((v_offer.proposed_date::text || ' ' || coalesce(v_offer.time_slot, '10:00'))::timestamp at time zone 'UTC');
  v_end := v_start + case when v_offer.media_type = 'film' then interval '7 days' else interval '1 hour' end;

  new.scheduled_start := v_start;
  new.scheduled_end := v_end;
  new.duration_minutes := greatest(1, extract(epoch from (v_end - v_start))::integer / 60);
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'scheduled_from_pr_offer', true,
    'time_slot', coalesce(v_offer.time_slot, '10:00')
  );

  if not (coalesce(new.metadata, '{}'::jsonb) ? 'pr_band_fanout') then
    select p.display_name, psa.title into v_conflict
    from public.band_members bm
    join public.profiles p on p.id = bm.profile_id
    join public.player_scheduled_activities psa on psa.profile_id = bm.profile_id
    where bm.band_id = v_offer.band_id
      and bm.member_status = 'active'
      and coalesce(bm.is_touring_member, false) = false
      and psa.status in ('scheduled','in_progress')
      and psa.scheduled_start < v_end
      and psa.scheduled_end > v_start
    limit 1;

    if found then
      raise exception '% is already booked for "%" at the PR offer time.',
        coalesce(v_conflict.display_name, 'A band member'), coalesce(v_conflict.title, 'another activity')
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_pr_schedule on public.player_scheduled_activities;
create trigger trg_normalize_pr_schedule
before insert on public.player_scheduled_activities
for each row execute function public.normalize_and_fanout_pr_schedule();

create or replace function public.fanout_pr_schedule_to_band_members()
returns trigger
language plpgsql
as $$
declare
  v_band_id uuid;
begin
  if new.activity_type not in ('pr_appearance','film_production')
     or not (coalesce(new.metadata, '{}'::jsonb) ? 'offer_id')
     or (coalesce(new.metadata, '{}'::jsonb) ? 'pr_band_fanout') then
    return new;
  end if;

  v_band_id := nullif(new.metadata->>'band_id', '')::uuid;
  if v_band_id is null then return new; end if;

  insert into public.player_scheduled_activities (
    user_id, profile_id, activity_type, scheduled_start, scheduled_end, duration_minutes,
    status, title, description, location, metadata
  )
  select
    bm.user_id, bm.profile_id, new.activity_type, new.scheduled_start, new.scheduled_end,
    new.duration_minutes, new.status, new.title, new.description, new.location,
    coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('pr_band_fanout', true)
  from public.band_members bm
  where bm.band_id = v_band_id
    and bm.member_status = 'active'
    and coalesce(bm.is_touring_member, false) = false
    and bm.profile_id is not null
    and bm.profile_id <> new.profile_id
    and not exists (
      select 1 from public.player_scheduled_activities psa
      where psa.profile_id = bm.profile_id
        and psa.activity_type = new.activity_type
        and psa.metadata->>'offer_id' = new.metadata->>'offer_id'
        and psa.status <> 'cancelled'
    );

  return new;
end;
$$;

drop trigger if exists trg_fanout_pr_schedule_to_band_members on public.player_scheduled_activities;
create trigger trg_fanout_pr_schedule_to_band_members
after insert on public.player_scheduled_activities
for each row execute function public.fanout_pr_schedule_to_band_members();

create or replace function public.expire_stale_pr_offers()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update public.pr_media_offers
  set status = 'expired'
  where status = 'pending' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select public.expire_stale_pr_offers();

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'expire-stale-pr-offers') then
    perform cron.schedule('expire-stale-pr-offers', '15 * * * *', 'select public.expire_stale_pr_offers();');
  end if;
end $$;
