-- Add structured profile metadata for cities to support the City page content
alter table public.cities
  add column if not exists profile_description text,
  add column if not exists featured_venues jsonb not null default '[]'::jsonb,
  add column if not exists featured_studios jsonb not null default '[]'::jsonb,
  add column if not exists transport_links jsonb not null default '[]'::jsonb;

update public.cities
  set featured_venues = coalesce(featured_venues, '[]'::jsonb),
      featured_studios = coalesce(featured_studios, '[]'::jsonb),
      transport_links = coalesce(transport_links, '[]'::jsonb)
  where featured_venues is null
     or featured_studios is null
     or transport_links is null;

-- Ensure the JSON columns always store arrays for consistent downstream parsing
alter table public.cities
  alter column featured_venues set default '[]'::jsonb,
  alter column featured_studios set default '[]'::jsonb,
  alter column transport_links set default '[]'::jsonb;

