create or replace function public.get_festival_directory_cards()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(card order by (card->>'startsOn')::date nulls last, card->>'festivalName'),
    '[]'::jsonb
  )
  from (
    select jsonb_build_object(
      'festivalCompanyId', fc.id,
      'festivalEditionId', e.id,
      'festivalName', coalesce(nullif(e.name, ''), fc.public_name),
      'slug', fc.slug,
      'tagline', fc.tagline,
      'description', fc.description,
      'status', e.status,
      'startsOn', e.starts_on,
      'endsOn', e.ends_on,
      'cityId', e.city_id,
      'cityName', c.name,
      'expectedCapacity', e.expected_capacity,
      'confirmedArtists', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', ab.id,
            'name', coalesce(
              nullif(b.name, ''),
              nullif(p.display_name, ''),
              nullif(p.username, ''),
              'Confirmed artist'
            ),
            'billingPosition', ab.billing_position,
            'performanceDate', ab.provisional_date
          )
          order by
            case when ab.billing_position = 'headliner' then 0 else 1 end,
            ab.provisional_date nulls last,
            coalesce(b.name, p.display_name, p.username)
        )
        from public.festival_artist_programmes ap
        join public.festival_artist_bookings ab
          on ab.festival_artist_programme_id = ap.id
        left join public.bands b on b.id = ab.band_id
        left join public.profiles p on p.id = ab.artist_profile_id
        where ap.festival_edition_id = e.id
          and ab.status = 'confirmed'
      ), '[]'::jsonb)
    ) as card
    from public.festival_companies fc
    join lateral (
      select ev.*
      from public.festival_editions_v2 ev
      where ev.festival_company_id = fc.id
        and ev.starts_on is not null
        and ev.ends_on is not null
        and ev.ends_on >= current_date
        and ev.status not in ('cancelled', 'completed')
      order by ev.starts_on asc, ev.created_at desc
      limit 1
    ) e on true
    left join public.cities c on c.id = e.city_id
    where fc.status = 'active'
      and fc.setup_completed = true
  ) cards;
$$;

revoke all on function public.get_festival_directory_cards() from public;
grant execute on function public.get_festival_directory_cards() to anon, authenticated;
