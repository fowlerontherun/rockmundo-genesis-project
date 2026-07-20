# Finance Phase 8B.7 executable stabilisation audit

## Scope of this PR

This PR starts Phase 8B.7 by closing the most urgent security gap from PR #1246: the browser-callable generic band-expense payment path. It deliberately does **not** begin Finance Phase 8C.

## Environment diagnostics

Commands recorded in the Codex container on 2026-07-20:

```text
npm config list
npm config get registry
npm config get proxy
npm config get https-proxy
env | sort | grep -Ei '(^|_)(http|https|no)_?proxy='
node -e "const fs=require('fs'); const p='package-lock.json'; if(fs.existsSync(p)){ const lock=JSON.parse(fs.readFileSync(p,'utf8')); const urls=new Set(); for (const pkg of Object.values(lock.packages||{})) if(pkg && pkg.resolved) urls.add(pkg.resolved); console.log([...urls].slice(0,40).join('\n')); console.error('resolved URL count', urls.size); }"
```

The finance verification workflow avoids installing the Supabase CLI through npm and uses the official `supabase/setup-cli` GitHub Action instead.

## Migration result

A clean Supabase reset could not be completed inside this Codex pass because the local validation environment is not guaranteed to have Docker/Supabase services running. The new CI workflow is now the canonical executable gate and runs:

```text
npm ci
supabase db start
supabase db reset
supabase db lint
supabase test db
supabase gen types typescript --local
npm run typecheck
npm run lint
npm run test -- --run
npm run build
```

## Security stabilization performed

- The generic browser confirmation API no longer accepts a browser-supplied destination account.
- The old `resolve_and_pay_band_expense` function is dropped and replaced by `resolve_and_pay_band_expense_internal`.
- The internal resolver is explicitly revoked from `PUBLIC`, `anon`, and `authenticated`, and granted only to `service_role`.
- The authenticated generic confirmation wrapper now returns a structured `requires_feature_booking_confirmation` response instead of moving money.
- The preview RPC uses `char(3)` currency signatures and no longer calls `get_or_create_band_treasury_account`; missing treasury accounts return `band_treasury_missing`.

## Remaining Phase 8B.7 work

The following acceptance criteria remain for later, narrower PRs:

- Real rehearsal and recording booking wrapper integration.
- Atomic booking/payment commits.
- Source-aware refunds.
- Mortgage trigger and schedule-version repair.
- Full obligation idempotency and collection-policy repairs.
- Band treasury and insufficient-funds UI.
- Behavioural SQL and browser E2E coverage for every supported flow.

## Captured npm/proxy output

```text
npm config list
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
; "env" config from environment

http-proxy = "http://proxy:8080"
https-proxy = "http://proxy:8080"

; node bin location = /root/.nvm/versions/node/v20.20.2/bin/node
; node version = v20.20.2
; npm local prefix = /workspace/rockmundo-genesis-project
; npm version = 11.4.2
; cwd = /workspace/rockmundo-genesis-project
; HOME = /root

npm config get registry
https://registry.npmjs.org/

npm config get proxy
null

npm config get https-proxy
http://proxy:8080

proxy environment variables
HTTPS_PROXY=http://proxy:8080
HTTP_PROXY=http://proxy:8080
NO_PROXY=browser
YARN_HTTPS_PROXY=http://proxy:8080
YARN_HTTP_PROXY=http://proxy:8080
http_proxy=http://proxy:8080
https_proxy=http://proxy:8080
no_proxy=localhost,127.0.0.1,::1
npm_config_http_proxy=http://proxy:8080
npm_config_https_proxy=http://proxy:8080
```
