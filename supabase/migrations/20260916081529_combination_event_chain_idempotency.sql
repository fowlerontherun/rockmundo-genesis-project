create unique index if not exists uq_player_events_parent_chain
  on public.player_events(parent_player_event_id)
  where parent_player_event_id is not null;
