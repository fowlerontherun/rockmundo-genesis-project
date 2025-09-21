-- Add latitude and longitude columns to cities and backfill existing records
alter table public.cities
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

update public.cities as c
set latitude = coords.latitude,
    longitude = coords.longitude
from (
  values
    ('Neo Tokyo', 35.6762, 139.6503),
    ('Solace City', 37.7749, -122.4194),
    ('Vela Horizonte', -22.9068, -43.1729),
    ('Asterhaven', 51.5072, -0.1276)
) as coords(name, latitude, longitude)
where c.name = coords.name;

comment on column public.cities.latitude is 'Latitude coordinate for the city centre.';
comment on column public.cities.longitude is 'Longitude coordinate for the city centre.';
