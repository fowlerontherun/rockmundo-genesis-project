# RockMundo October 8–15 migration reconciliation — pass 9

Production Supabase: yztogmdixmchsmimtent. GitHub migration tracker: #4072. Date: 2026-10-15.

## Newly applied directly, exact Git-reviewed SQL

- **20261015203638 rockmundo_20261015_direct_message_recipient_consent_live_compat**.
- Source in PR #4159: supabase/production-repairs/20261015_direct_message_recipient_consent_live_compat.sql; verified Git blob **73c78cfc78a0d1b18c94f2885f771e50fe5a5218**.
- This is the independent recipient-consent component of **20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql**. The entire original migration **must not be replayed**: it overwrites current friendship functions and references nonexistent friendship_settings.
- Existing profile DM permission enum already includes everyone, friends, none, friends_and_band and existing_conversations; all required DM/friendship/conversation/band tables exist. The new guard requires authenticated active sender identity, valid recipient, no social block, and enforces recipient preference for direct messages. Both legacy and idempotent direct RPCs insert into the common direct_messages table and are protected by a BEFORE INSERT/identity-update trigger. Group conversations remain permitted only for current active participants.
- The can_profile_receive_dm helper is executable by authenticated/service_role but **not anon**; the trigger function itself is not directly executable by authenticated/anon. Existing block and rate-limit triggers remain enabled.
- After apply, confirmed the trigger and both function ACLs, 3 historical message rows unchanged, and 0 privacy overrides. **No messages, friendship rows, notifications, wallet or cash entries updated.**
- Rolled-back, read-only privilege-context test: an active sender from an accepted friendship was correctly allowed; a valid active nonfriend was correctly denied. The first attempted test against an inactive/deceased historical sender was denied as intended. No test message was inserted.

## Remaining part of that historical social migration

- Live send_friend_request(uuid,uuid) exists and checks 24-hour recipient decline using social_relationship_audit, but not cancel/removal cooldowns and not friend-request preferences. The rate-limit trigger is present. Live get_connection_state(uuid,uuid) exists but returns not_connected for declined/removed relationships and has no cooldown state. The original SQL assumes friendship_settings, which is **absent**.
- Production friendships: 122 (14 accepted, 108 pending). Audit: 94 sent, 11 accepted. No recorded decline/cancel/removal audit rows; do not retrospectively change friend connections. Design a separate dependency-safe cooldown and UI-status enhancement using existing social_relationship_audit, preserving already deployed functions and permissions. Test before applying.

## The previous and remaining October SQL disposition

- **Already installed/superseded**: Oct 9 quest payout processor (20261015171019 canonical, service-only, reward definitions disabled), Oct 12 legacy skill-books (20261015175350 canonical, no inventory/payout), crafting, AP-to-SXP, video rewards, atomic streaming, lottery, opt-in social discovery, band recruitment/governance, game notifications, Oct 15 recording claim and unique-take, underworld direct-write and gifting repairs. Do not replay original filenames.
- **Partially reconciled but still absent**: Oct 12/13 underworld purchase, consume and paid-only arrest functions. The original SQL is malformed around timed effect validation, credits obsolete profiles.experience, and would arrest on gift rows. 53 catalog products include multi-key timed boosts and anomalous negative-duration products. The safe gifting and direct Data API write restrictions remain installed; those do not restore buying/using items.
- **Still blocked**: career achievements canonical foundation, retirement/recovery, client-priced business and subsidiary purchases, sponsorship and weekly payroll. The live earnings SUM trigger can undo spending; only financial-ledger/PITR rehearsal can authorize a cutover.
- **Quest guard retained**: 23 pending claims/9,200 XP; 4 definitions disabled; zero quest payouts.

## How to continue

Next: stage-implement the underworld payment, inventory effects, canonical XP and paid-only arrest as one transactionally verified change; separately reconcile the friendship cancel/removal cooldown against existing audit tables. Keep payroll/treasury changes isolated until validated backups and balance parity are demonstrated. No bulk supabase db push.