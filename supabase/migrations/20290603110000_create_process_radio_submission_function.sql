-- Create RPC to process radio submissions atomically
create or replace function public.process_radio_submission(
  p_submission_id uuid,
  p_force_failure text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission record;
  v_song record;
  v_station record;
  v_show record;
  v_playlist record;
  v_play record;
  v_band record;
  v_now timestamptz := timezone('utc', now());
  v_week_start date;
  v_listener_multiplier numeric;
  v_listeners integer;
  v_hype integer;
  v_streams integer;
  v_sales integer;
  v_is_new_playlist boolean := false;
  v_summary jsonb;
begin
  select *
    into v_submission
    from radio_submissions
   where id = p_submission_id
   for update;

  if not found then
    raise exception 'Radio submission % not found', p_submission_id using errcode = 'P0002';
  end if;

  select *
    into v_song
    from songs
   where id = v_submission.song_id
   for update;

  if not found then
    raise exception 'Song % not found for submission %', v_submission.song_id, p_submission_id using errcode = 'P0002';
  end if;

  select *
    into v_station
    from radio_stations
   where id = v_submission.station_id
   for update;

  if not found then
    raise exception 'Station % not found for submission %', v_submission.station_id, p_submission_id using errcode = 'P0002';
  end if;

  select *
    into v_show
    from radio_shows
   where station_id = v_submission.station_id
     and is_active
   order by time_slot asc
   limit 1;

  if v_show is null then
    raise exception 'Active show not found for station %', v_submission.station_id using errcode = 'P0002';
  end if;

  v_week_start := coalesce(v_submission.week_submitted, (date_trunc('week', v_now) :: date));

  if p_force_failure = 'before_accept' then
    raise exception 'Simulated failure before acceptance' using errcode = 'P0001';
  end if;

  update radio_submissions
     set status = 'accepted',
         reviewed_at = v_now,
         rejection_reason = null
   where id = p_submission_id;

  if p_force_failure = 'after_accept' then
    raise exception 'Simulated failure after acceptance' using errcode = 'P0001';
  end if;

  select *
    into v_playlist
    from radio_playlists
   where show_id = v_show.id
     and song_id = v_submission.song_id
     and week_start_date = v_week_start
   for update;

  if found then
    update radio_playlists
       set times_played = coalesce(times_played, 0) + 1,
           added_at = v_now,
           is_active = true
     where id = v_playlist.id
     returning * into v_playlist;
  else
    insert into radio_playlists (show_id, song_id, week_start_date, added_at, is_active, times_played)
    values (v_show.id, v_submission.song_id, v_week_start, v_now, true, 1)
    returning * into v_playlist;
    v_is_new_playlist := true;
  end if;

  if p_force_failure = 'after_playlist' then
    raise exception 'Simulated failure after playlist handling' using errcode = 'P0001';
  end if;

  v_listener_multiplier := 0.55 + random() * 0.35;
  v_listeners := greatest(100, round(coalesce(v_station.listener_base, 0) * v_listener_multiplier)::integer);
  v_hype := greatest(1, round(v_listeners * 0.002)::integer);
  v_streams := greatest(10, round(v_listeners * 0.6)::integer);
  v_sales := greatest(5, round(v_listeners * 0.015)::integer);

  insert into radio_plays (playlist_id, song_id, show_id, station_id, listeners, played_at, hype_gained, streams_boost, sales_boost)
  values (v_playlist.id, v_submission.song_id, v_show.id, v_submission.station_id, v_listeners, v_now, v_hype, v_streams, v_sales)
  returning * into v_play;

  if p_force_failure = 'after_play' then
    raise exception 'Simulated failure after play logging' using errcode = 'P0001';
  end if;

  update songs
     set hype = coalesce(hype, 0) + v_hype,
         total_radio_plays = coalesce(total_radio_plays, 0) + 1,
         last_radio_play = v_now,
         streams = coalesce(streams, 0) + v_streams,
         revenue = coalesce(revenue, 0) + v_sales
   where id = v_submission.song_id;

  if p_force_failure = 'after_song_update' then
    raise exception 'Simulated failure after song update' using errcode = 'P0001';
  end if;

  if v_song.band_id is not null then
    update bands
       set fame = coalesce(fame, 0) + 0.1
     where id = v_song.band_id
     returning * into v_band;

    if p_force_failure = 'after_band_update' then
      raise exception 'Simulated failure after band update' using errcode = 'P0001';
    end if;

    insert into band_fame_events (band_id, fame_gained, event_type, event_data)
    values (
      v_song.band_id,
      0.1,
      'radio_play',
      jsonb_build_object(
        'station_id', v_submission.station_id,
        'station_name', v_station.name,
        'play_id', v_play.id
      )
    );

    if p_force_failure = 'after_fame_event' then
      raise exception 'Simulated failure after fame event' using errcode = 'P0001';
    end if;

    if v_sales > 0 then
      insert into band_earnings (band_id, amount, source, description, metadata)
      values (
        v_song.band_id,
        v_sales,
        'radio_play',
        format('Radio play on %s', v_station.name),
        jsonb_build_object(
          'station_id', v_submission.station_id,
          'station_name', v_station.name,
          'song_id', v_song.id,
          'play_id', v_play.id
        )
      );

      if p_force_failure = 'after_band_earnings' then
        raise exception 'Simulated failure after band earnings' using errcode = 'P0001';
      end if;
    end if;
  end if;

  v_summary := jsonb_build_object(
    'submission_id', p_submission_id,
    'playlist_id', v_playlist.id,
    'play_id', v_play.id,
    'listeners', v_listeners,
    'hype_gain', v_hype,
    'streams_boost', v_streams,
    'sales_boost', v_sales,
    'week_start_date', v_week_start,
    'show_id', v_show.id,
    'band_id', v_song.band_id,
    'playlist_times_played', coalesce(v_playlist.times_played, 0),
    'is_new_playlist', v_is_new_playlist
  );

  return v_summary;
end;
$$;

grant execute on function public.process_radio_submission(uuid, text) to authenticated;
grant execute on function public.process_radio_submission(uuid, text) to service_role;
