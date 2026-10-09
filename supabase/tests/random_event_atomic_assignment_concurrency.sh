#!/usr/bin/env bash
# Run ONLY against an isolated test database with disposable auth user, profile,
# and event fixture IDs. Never run against production player accounts.
set -euo pipefail
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to an isolated test database}"
: "${TEST_USER_ID:?Supply a disposable auth.users ID}"
: "${TEST_PROFILE_ID:?Supply the user's disposable profile ID}"
: "${TEST_EVENT_ID:?Supply a valid disposable random_events ID}"
for var in TEST_USER_ID TEST_PROFILE_ID TEST_EVENT_ID; do
  if ! [[ "${!var}" =~ ^[0-9a-fA-F-]{36}$ ]]; then echo "Invalid UUID in $var" >&2; exit 2; fi
done

# Both requests contend on the same auth.users row in the RPC.
run_assignment() {
  psql "$TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -v uid="$TEST_USER_ID" -v pid="$TEST_PROFILE_ID" -v eid="$TEST_EVENT_ID" \
    -c "select coalesce(public.assign_random_event_if_available(:'uid'::uuid, :'pid'::uuid, :'eid'::uuid)::text, 'BLOCKED');"
}
before=$(psql "$TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -v uid="$TEST_USER_ID" \
  -c "select count(*) from public.player_events where user_id=:'uid'::uuid and (status='pending_choice' or (status='awaiting_outcome' and choice_made_at >= timestamptz '2026-10-09 00:00:00+00'))")
if [[ "$before" != "0" ]]; then echo "Fixture already has active events ($before)" >&2; exit 2; fi
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
run_assignment >"$dir/a" 2>"$dir/a.err" & a=$!
run_assignment >"$dir/b" 2>"$dir/b.err" & b=$!
wait "$a" || { cat "$dir/a.err" >&2; exit 1; }
wait "$b" || { cat "$dir/b.err" >&2; exit 1; }
after=$(psql "$TEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -v uid="$TEST_USER_ID" \
  -c "select count(*) from public.player_events where user_id=:'uid'::uuid and status='pending_choice'")
created=$(grep -hEc '^[0-9a-fA-F-]{36}$' "$dir/a" "$dir/b" | awk '{s+=$1} END{print s+0}')
blocked=$(grep -hc '^BLOCKED$' "$dir/a" "$dir/b" | awk '{s+=$1} END{print s+0}')
if [[ "$after" != "1" || "$created" != "1" || "$blocked" != "1" ]]; then
  echo "FAILED after=$after created=$created blocked=$blocked" >&2
  cat "$dir/a" "$dir/b" >&2
  exit 1
fi
echo "PASS: one event assigned and competing concurrent assignment rejected"
