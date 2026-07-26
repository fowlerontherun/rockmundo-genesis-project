# Festival performance worker operations

Deploy `festival-performance-worker` with JWT verification disabled only at the
gateway; the function itself requires `x-worker-secret` to equal the
`FESTIVAL_WORKER_SECRET` Edge Function secret. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are also required.

Invoke the function once per minute from the trusted scheduler with an HTTP POST.
Supabase Cron (`pg_cron` plus `pg_net`) is the recommended scheduler; store the
worker secret in Vault and send it as the `x-worker-secret` header. Do not put the
secret in migration SQL or source control. Concurrent invocations are safe because
job claiming uses `FOR UPDATE SKIP LOCKED`; an empty queue performs one cheap claim.

Every invocation is recorded in `festival_simulation_worker_invocations`. The
worker recovers five-minute stale leases before claiming work. Operators use
`get_festival_simulation_worker_health()` and
`get_exhausted_festival_simulation_jobs()`, then the audited
`requeue_festival_performance_simulation_job(...)` RPC when evidence supports a
retry. Alert when the last invocation is older than three minutes, any invocation
fails, exhausted count is non-zero, or the oldest queued job exceeds five minutes.
