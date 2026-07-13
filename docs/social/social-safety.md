# Social safety controls

RockMundo centralises player-to-player restrictions through `player_blocks`, `get_social_permissions`, `are_profiles_blocked`, and the player report workflow.

## Blocking behaviour

A block is directional for audit purposes but symmetric for direct interactions. If either player has an active block, friend requests, private messaging, band and activity invitations, employment offers, money transfers, item gifting, social-feed interactions, discovery appearance and friend suggestions must be rejected by server-side checks.

When a player blocks another player, pending friendship requests between the pair are cancelled and accepted friendships are removed. Unblocking removes only the active block; it does not restore friendships, recreate requests, reopen invitations or bypass future cooldowns.

The blocked player is not notified. If a restricted player attempts an action, the UI and server should use neutral wording such as `This player is unavailable.` and must not reveal which player created the block.

## Shared bands, companies and gameplay history

Blocking is not a destructive domain action. It must not delete historical messages, valid completed transactions, song or recording credits, gig history, contracts, band membership, company employment or shared bookings. Those domains keep the gameplay data needed for the world to function while suppressing optional direct social contact and private profile information.

Operational, system-generated updates that are required for a shared band, company, recording, gig or booking may still be shown without exposing private social information or opening direct messaging.

## Reporting behaviour

Reports use centrally configured categories, immutable evidence snapshots and limited reporter-facing status. A report does not automatically punish the reported player. Reporter identity, moderator notes, internal risk signals and exact disciplinary details remain hidden from normal players.

For threats or immediate real-world danger, the UI tells players to contact emergency services or local authorities because RockMundo moderation cannot provide emergency intervention.
