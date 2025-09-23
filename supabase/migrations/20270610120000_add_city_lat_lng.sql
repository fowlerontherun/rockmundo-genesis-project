-- Add latitude and longitude columns to cities
alter table public.cities
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Backfill coordinates for existing seed cities to preserve historical data
update public.cities
set latitude = 35.6895,
    longitude = 139.6917
where name = 'Neo Tokyo'
  and (latitude is null or longitude is null);

update public.cities
set latitude = 37.7749,
    longitude = -122.4194
where name = 'Solace City'
  and (latitude is null or longitude is null);

update public.cities
set latitude = -22.9068,
    longitude = -43.1729
where name = 'Vela Horizonte'
  and (latitude is null or longitude is null);

update public.cities
set latitude = 52.4862,
    longitude = -1.8904
where name = 'Asterhaven'
  and (latitude is null or longitude is null);
