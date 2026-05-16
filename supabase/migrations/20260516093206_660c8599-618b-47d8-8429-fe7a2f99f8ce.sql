
alter table public.songs
  add column if not exists acquisition_source text not null default 'written';

-- Backfill from existing ownership_type so old data is consistent.
update public.songs
  set acquisition_source = 'purchased'
  where ownership_type = 'purchased'
    and acquisition_source = 'written';

create index if not exists idx_songs_acquisition_source
  on public.songs(acquisition_source);
