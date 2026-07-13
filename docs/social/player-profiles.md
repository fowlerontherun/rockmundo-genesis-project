# Player profiles and social identity

RockMundo player profiles are a public-safe social identity layer over character records. The public route is `/players/:playerId` with the legacy `/player/:playerId` route retained for compatibility.

## Editable public fields

Players can edit the following from `/character/profile/edit`:

- biography, stored as plain text and limited to 1,000 characters
- primary instrument, secondary instruments, preferred genres, preferred roles, vocal capability and songwriting specialisms
- public status message, limited to 140 characters
- availability flags for bands, band members, session work, collaboration, gigs, employment, teaching and social activities
- profile visibility, skill visibility and granular booleans for online status, last active time, city, schedule availability, skills, career history, employment, recent activity and achievements

Client-side saves sanitise executable HTML, control characters, unsafe links and profanity-hook matches before writing. Database checks enforce text length limits, and RLS only allows owners to manage their own `player_profiles` row.

## Visibility behaviour

Server-side filtering is centralised in `get_public_profile_detail`. It uses `can_view_social_profile` and existing profile-summary visibility before returning any public data. Hidden city and hidden skills are removed from the RPC response rather than only hidden in React. Badge and activity collections are returned only when their visibility settings permit it, and profile activity must also be marked `is_public`.

## Search preparation

The `player_profiles` table indexes visibility, primary instrument, looking-for-band, session availability and employment availability. These fields are intended for future player discovery without exposing private account or moderation fields.
