# Production inbox and attribute-spend repair — 15 Oct 2026

Project: `yztogmdixmchsmimtent`.

The previous scope repair was insufficient. In the 24h logs, `/rest/v1/notification_profile_states` returned 404 95 times while `player_inbox` returned 200; `notification_profile_states` and `set_notification_profile_states(uuid,uuid[],text)` were entirely absent. The required source SQL was stranded in a 2030-dated migration.

Applied `rockmundo_20261015_notification_profile_states_restore` directly in Supabase from the future-dated SQL, with schema refresh. Verified the table/function exist, RLS enabled, authenticated SELECT and EXECUTE granted, anon denied. See the audit copy in `supabase/production-repairs/20261015_notification_profile_states_restore.sql`.

The existing `spend_attribute_points_atomic` allowed 8 attributes and a 100-point cap, inconsistent with the 13 UI attributes and `ATTRIBUTE_MAX_VALUE=1000`. Applied `rockmundo_20261015_restore_attribute_spending` from `supabase/production-repairs/20261015_restore_attribute_spending.sql`. Preserved wallet row-lock, atomic debit/increment, caller ownership and authenticated-only execution. Exercised both a newly supported and original attribute in a controlled database smoke test; all test spending was explicitly rolled back.

Client changes: surface attribute-spend error payload and keep available inbox items visible when one notification source fails. App changes require merge/deploy; DB changes are already live.

Unverified: real authenticated browser journeys, UI read/archive, cross-character isolation and client spend after deploy. Previously ambiguous 31 inbox records remain unaltered; issue #4127. Do not replay arbitrary unapplied migrations or bulk push without reconciling future-dated sources and the applied production repair names. Stipend code and balances untouched.
