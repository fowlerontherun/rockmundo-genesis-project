drop index if exists public.idx_player_events_target_release_id;
create index if not exists idx_player_events_target_release_id on public.player_events(target_release_id);
