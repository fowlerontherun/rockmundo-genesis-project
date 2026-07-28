#!/usr/bin/env bash
set -euo pipefail

npm run test:festivals:active-callers
npm run test:festivals:routes
npm run test:festivals:safety-guard

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo 'SUPABASE_DB_URL is required; certification never silently skips database fixtures.' >&2
  exit 2
fi
npm run test:festivals:full-lifecycle
npm run test:festivals:recovery
