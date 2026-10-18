create or replace function public.check_radio_submission_week(
  p_station_id uuid,
  p_song_id uuid,
  p_anchor integer default 1,
  p_reference timestamptz default now()
)
returns table (
  week_start_date date,
  already_submitted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anchor integer := coalesce(p_anchor, 1);
  v_reference timestamptz := timezone('UTC', coalesce(p_reference, now()));
  v_week_start timestamptz;
begin
  if v_anchor < 0 or v_anchor > 6 then
    v_anchor := 1;
  end if;

  v_week_start := date_trunc('week', v_reference);

  if v_anchor <> 1 then
    v_week_start := v_week_start + (v_anchor - 1) * interval '1 day';
    if v_reference < v_week_start then
      v_week_start := v_week_start - interval '7 days';
    end if;
  end if;

  week_start_date := v_week_start::date;
  already_submitted := exists (
    select 1
    from radio_submissions rs
    where rs.station_id = p_station_id
      and rs.song_id = p_song_id
      and rs.week_submitted = week_start_date
  );

  return next;
  return;
end;
$$;
