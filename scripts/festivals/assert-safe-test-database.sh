#!/usr/bin/env bash
set -euo pipefail

festival_assert_safe_test_database() {
  local db_url="${1:-${SUPABASE_DB_URL:-}}"
  local confirmed="${FESTIVAL_TEST_DATABASE_CONFIRMED:-}"
  local production_ref="yztogmdixmchsmimtent"

  if [[ "$confirmed" != "true" ]]; then
    echo "Refusing to mutate database: set FESTIVAL_TEST_DATABASE_CONFIRMED=true for an isolated local test database" >&2
    return 3
  fi
  if [[ -z "$db_url" ]]; then
    echo "Refusing to mutate database: database URL is required" >&2
    return 2
  fi

  local safe_url="${db_url%%\?*}"
  safe_url="$(printf '%s' "$safe_url" | sed -E 's#(postgres(ql)?://)([^/@]+@)?#\1[redacted]@#')"
  local host
  host="$(python3 - "$db_url" <<'PY'
import sys
from urllib.parse import urlparse
u = urlparse(sys.argv[1])
print((u.hostname or '').lower())
PY
)"

  if [[ -z "$host" ]]; then
    echo "Refusing to mutate database: database URL host could not be parsed" >&2
    return 4
  fi

  case "$db_url" in
    *"$production_ref"*) echo "Refusing to mutate database: known production Supabase project reference is not allowed" >&2; return 4 ;;
  esac
  case "$host" in
    supabase.co|*.supabase.co|pooler.supabase.com|*.pooler.supabase.com|aws-*.pooler.supabase.com|*prod*|*production*)
      echo "Refusing to mutate database: unsafe database host is not allowed" >&2
      return 4
      ;;
  esac

  case "$host" in
    localhost|127.0.0.1|::1|host.docker.internal|db|supabase_db_*)
      return 0
      ;;
  esac

  echo "Refusing to mutate database: unrecognised non-local database host ($host)" >&2
  return 4
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  festival_assert_safe_test_database "${1:-${SUPABASE_DB_URL:-}}"
fi
