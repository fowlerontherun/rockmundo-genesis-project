-- Seed data for Eurovision smoke tests
with years as (
  insert into public.eurovision_years (year, host_city, host_country, theme)
  values
    (2021, 'Rotterdam', 'Netherlands', 'Open Up'),
    (2022, 'Turin', 'Italy', 'The Sound of Beauty'),
    (2023, 'Liverpool', 'United Kingdom', 'United by Music')
  on conflict (year) do update
    set host_city = excluded.host_city,
        host_country = excluded.host_country,
        theme = excluded.theme
  returning id, year
),
entries as (
  insert into public.eurovision_entries (
    id,
    year_id,
    country,
    song_title,
    running_order,
    final_score,
    band_id,
    song_id
  )
  select
    gen_random_uuid(),
    y.id,
    e.country,
    e.song_title,
    e.running_order,
    e.final_score,
    null::uuid,
    null::uuid
  from (values
    (2021, 'Italy', 'Zitti e buoni', 24, 524),
    (2021, 'France', 'Voilà', 20, 499),
    (2021, 'Switzerland', 'Tout l''univers', 11, 432),
    (2022, 'Ukraine', 'Stefania', 12, 631),
    (2022, 'United Kingdom', 'SPACE MAN', 22, 466),
    (2022, 'Spain', 'SloMo', 10, 459),
    (2023, 'Sweden', 'Tattoo', 9, 583),
    (2023, 'Finland', 'Cha Cha Cha', 13, 526),
    (2023, 'Israel', 'Unicorn', 23, 362)
  ) as e(year, country, song_title, running_order, final_score)
  join years y on y.year = e.year
  on conflict (year_id, country) do update
    set song_title = excluded.song_title,
        running_order = excluded.running_order,
        final_score = excluded.final_score
  returning id, year_id, country
),
winners as (
  insert into public.eurovision_winners (id, year_id, entry_id, song_id)
  select
    gen_random_uuid(),
    y.id,
    e.id,
    null::uuid
  from years y
  join entries e on e.year_id = y.id
  join (
    values
      (2021, 'Italy'),
      (2022, 'Ukraine'),
      (2023, 'Sweden')
  ) as w(year, country) on w.year = y.year and w.country = e.country
  on conflict (year_id) do update
    set entry_id = excluded.entry_id,
        song_id = excluded.song_id
  returning year_id
)
insert into public.eurovision_votes (
  id,
  year_id,
  entry_id,
  from_country,
  vote_type,
  points
)
select
  gen_random_uuid(),
  y.id,
  e.id,
  v.from_country,
  v.vote_type,
  v.points
from (values
  (2021, 'Italy', 'San Marino', 'televote', 12),
  (2021, 'France', 'Germany', 'jury', 10),
  (2021, 'Switzerland', 'Austria', 'jury', 12),
  (2022, 'Ukraine', 'Poland', 'televote', 12),
  (2022, 'United Kingdom', 'Ukraine', 'jury', 12),
  (2022, 'Spain', 'North Macedonia', 'jury', 10),
  (2023, 'Sweden', 'Finland', 'jury', 10),
  (2023, 'Finland', 'Sweden', 'televote', 12),
  (2023, 'Israel', 'France', 'jury', 8)
) as v(year, country, from_country, vote_type, points)
join years y on y.year = v.year
join entries e on e.year_id = y.id and e.country = v.country
on conflict do nothing;
