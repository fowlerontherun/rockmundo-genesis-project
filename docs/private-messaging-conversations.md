# Private Messaging Conversation Architecture

RockMundo now uses a conversation layer over the existing `direct_messages` table instead of a disconnected mail system. The existing table remains the durable message/event source used by current realtime subscriptions; new `conversations` and `conversation_participants` rows provide canonical direct threads, participant-scoped unread/archive/mute state, idempotency and future-safe conversation types.

## Lifecycle and privacy policy

- Direct conversations are keyed by `least(profile_id)::text || ':' || greatest(profile_id)::text` in `conversations.direct_pair_key`, so repeated or concurrent starts reuse the same one-to-one thread.
- `start_direct_conversation` validates an active sender profile, target existence, blocks and recipient DM preferences through the existing `can_profile_receive_dm` guard before inserting participant rows.
- `send_conversation_message` validates membership and permissions again at send time, enforces body limits, validates replies in the same conversation, stores `client_message_id` for retry idempotency, updates last-message metadata and increments recipient unread state transactionally.
- Conversation archive, mute, hidden and deleted-for-player fields live on `conversation_participants`, so one player cannot destroy the other participant's history.
- Row-level security only exposes conversations, participant metadata and attachments to participants. Attachment metadata is separate from mail-style attachments but follows the same storage-key ownership pattern and blocks unsafe filenames/MIME types.
- Notifications reuse the unified `notifications` table with a `/social/messages` action path and suppressed previews; muted conversations suppress direct-message notifications.
- Full-text search reuses PostgreSQL `to_tsvector` indexes on visible, non-deleted `direct_messages` and filters by participant membership before returning summaries.
- Read receipts are currently limited to delivery/read boundary state (`read_at`, `last_read_message_id`, `unread_count`). Exact cross-player read timestamps are not exposed in UI payloads.

## Why not extend mail directly?

Mail/inbox notifications in RockMundo are category-based game updates and action surfaces. Live private chat needs participant read markers, idempotent sends, realtime invalidation, reply validation and per-conversation archive/mute semantics. The conversation layer reuses direct-message storage, Supabase realtime, notifications, profile privacy, friendship and blocking guards without forcing email-style behavior onto live chat.
