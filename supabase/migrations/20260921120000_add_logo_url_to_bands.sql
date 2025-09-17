alter table if exists public.bands
  add column if not exists logo_url text;
