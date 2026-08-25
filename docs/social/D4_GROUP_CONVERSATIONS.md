# D4 — Group conversations and communication consolidation

## Status

Implemented as the next D4 slice on 2026-08-25. Database changes were applied directly to the live RockMundo Supabase project, not added as a new migration file.

The existing `conversations`, `conversation_participants` and `direct_messages` authority remains canonical. D4 extends that model rather than creating a second chat or mail subsystem.

## Delivered

- `group` conversations can be bound to authoritative game contexts.
- Current automatic context adapters cover bands, companies, tours and festival editions.
- `ensure_my_context_conversations()` materialises/synchronises the groups that the active character is genuinely entitled to see.
- Membership is derived from the underlying band membership, company employment/ownership, tour bands and festival attendance/ownership records.
- Removed members are marked with `left_at`; they retain read-only history but cannot send new messages.
- Authoritative groups cannot be manually left while the underlying game relationship remains active. The player must leave the band/company/tour/festival relationship instead; archive/mute remains participant-scoped.
- Blocking does not silently destroy shared group membership. Group message reads filter blocked senders for the viewing player.
- Direct messages remain one-to-one and preserve their existing block semantics.
- Group and direct messages both use `send_conversation_message`, existing realtime delivery and the existing mobile conversation route.
- Group conversation IDs are namespaced as `group-<uuid>` in the client route layer so they cannot be confused with profile IDs.
- Unread message counts now include direct and group threads.
- `conversation_context_attachments` supports reusable game-object references for contracts, gigs, offers, deadlines, bands, companies, tours, festivals, events and releases.
- The earlier unified Inbox remains the single game-notification surface. D4 does not create duplicate bell/inbox notifications for every group message.

## Server authority

The live database now exposes:

- `ensure_context_conversation(text, uuid)`
- `ensure_my_context_conversations()`
- `_sync_authoritative_conversation_members(uuid)` (internal/service authority)
- `list_social_conversations_v2(boolean, text, integer, timestamptz)`
- `get_conversation_messages_v2(uuid, integer, timestamptz)`
- the existing `send_conversation_message(uuid, text, text, uuid)`, upgraded for groups
- `attach_conversation_context(uuid, text, uuid, text, text, timestamptz, jsonb)`
- `leave_group_conversation(uuid)`

The live schema also adds context metadata to `conversations`, role/source/lifecycle metadata to `conversation_participants`, nullable `recipient_profile_id` for group rows in `direct_messages`, and RLS-protected `conversation_context_attachments`.

## Behaviour boundaries

Band, company, tour and festival groups are fully backed by existing authoritative relationships. Labels, generic events and communities are deliberately not guessed across unrelated legacy schemas; additional authority adapters should be added only when their canonical membership source is confirmed. The conversation primitives already accept those context/attachment categories, but automatic membership remains fail-closed until then.

This keeps D4 honest: the reusable communication foundation is implemented and live, while unsupported context types cannot accidentally grant access.

## Verification

The implementation adds focused source-contract coverage in `src/features/direct-messages/__tests__/groupConversations.test.ts`. Production object verification was also run directly against Supabase after applying the schema/functions.
