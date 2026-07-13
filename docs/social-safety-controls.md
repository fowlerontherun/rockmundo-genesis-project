# Social safety controls

Player blocks are symmetric interaction restrictions even though only one player creates the block. Direct player-to-player actions should call the central social permission RPC/service before creating invitations, messages, transfers, gifts, teaching offers, employment offers or feed interactions.

Blocking removes accepted friendships, cancels pending friend requests, disables pending social notification actions and excludes the pair from server-side discovery/profile queries. The blocked player is not notified and receives neutral unavailable responses.

Blocking does **not** delete historical messages, completed transactions, song/recording/gig credits, band membership, company employment, shared bookings or contracts. Shared gameplay entities should preserve operational records and allow only system-generated updates required for the entity to function while suppressing optional private social context.

Reports are separate from blocks. Reports create immutable evidence snapshots for moderation review, apply duplicate/rate-limit controls, and never disclose reporter identity to the reported player.
