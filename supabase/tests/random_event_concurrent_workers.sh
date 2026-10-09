#!/usr/bin/env bash
# Exercise two independent workers against one existing test player_event.
# TEST DATABASE ONLY: the target event is completed permanently.
# Requires an awaiting_outcome event with a valid player profile and selected choice.
set -euo pipefail
: "${TEST_SUPABASE_DB_URL:?Set TEST_SUPABASE_DB_URL to a non-production database}"
: "${TEST_PLAYER_EVENT_ID:?Set TEST_PLAYER_EVENT_ID to an awaiting_outcome test event UUID}"
case "$TEST_PLAYER_EVENT_ID" in
  ????????-????-????-????-????????????) ;;
  *) echo "TEST_PLAYER_EVENT_ID must be a UUID" >&2; exit 2;;
esac

fixture="$(psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v event_id="$TEST_PLAYER_EVENT_ID" -At <<'SQL'
select case when count(*) = 1 then 'READY' else 'INVALID_FIXTURE' end
from public.player_events
where id = :'event_id'::uuid and status = 'awaiting_outcome'
  and choice_made in ('a','b') and profile_id is not null;
SQL
)"
if [[ "$fixture" != "READY" ]]; then echo "Invalid awaiting_outcome fixture" >&2; exit 3; fi

tmp1="$(mktemp)"
tmp2="$(mktemp)"
trap 'rm -f "$tmp1" "$tmp2"' EXIT

# Separate DB sessions, started without waiting for one another.
psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -At -c "select public.apply_random_event_outcome('$TEST_PLAYER_EVENT_ID'::uuid)" > "$tmp1" 2>&1 &
p1=$!
psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -At -c "select public.apply_random_event_outcome('$TEST_PLAYER_EVENT_ID'::uuid)" > "$tmp2" 2>&1 &
p2=$!
wait "$p1"
wait "$p2"
cat "$tmp1"
cat "$tmp2"

psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$check\$
DECLARE
  v_event uuid := '$TEST_PLAYER_EVENT_ID'::uuid;
  v_completed integer;
  v_inbox integer;
  v_activity integer;
  v_grants integer;
BEGIN
  SELECT count(*) INTO v_completed FROM public.player_events
  WHERE id = v_event AND status = 'completed' AND outcome_applied;
  SELECT count(*) INTO v_inbox FROM public.player_inbox
  WHERE category = 'random_event' AND metadata->>'player_event_id' = v_event::text;
  SELECT count(*) INTO v_activity FROM public.activity_feed
  WHERE activity_type = 'random_event_outcome' AND metadata->>'player_event_id' = v_event::text;
  SELECT count(*) INTO v_grants FROM public.random_event_skill_xp_grants WHERE player_event_id = v_event;
  IF v_completed <> 1 OR v_inbox <> 1 OR v_activity <> 1 OR v_grants > 1 THEN
    RAISE EXCEPTION 'Concurrent processing mismatch: completed %, inbox %, activity %, skill grants %',
      v_completed, v_inbox, v_activity, v_grants;
  END IF;
  RAISE NOTICE 'PASS: one completed event, one inbox, one activity, no duplicate skill grant';
END
\$check\$;
SQL
