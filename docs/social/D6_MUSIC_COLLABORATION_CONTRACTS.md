# D6 — Collaboration contracts and session musicians

## Purpose

D6 layers music-specific collaboration agreements on the generic D9 social-contract authority. It supports guest features, co-writing, production credits, session musicians, temporary tour participation, and live guests without introducing a second contract lifecycle.

## Live database authority

Database changes for D6 are applied directly to the live Supabase project. No D6 migration file is required in the repository.

Canonical D6 adapter tables:

- `music_collaboration_contracts`
- `music_collaboration_credits`

Both tables are RLS protected. Player mutations are exposed only through narrow SECURITY DEFINER RPCs.

## Supported collaboration modes

- `guest_feature`
- `co_writing`
- `production_credit`
- `session_musician`
- `tour_participation`
- `live_guest`

Each contract links to the relevant authoritative song, songwriting project, recording session, tour, or gig. Every invited profile receives explicit obligations, credit terms, royalty basis points, and any fixed fee before accepting.

## Acceptance and money

The commissioning band is accepted at creation by an authorised manager. Every invited musician must explicitly accept the offered version. The contract activates only when all profile parties have accepted.

Fixed fees are funded from the band treasury into canonical Finance-backed escrow when the offer is created. Declined or pre-activation cancelled offers refund funded escrow to the band. Royalty shares must total exactly 10,000 basis points across band plus invited musicians.

## Settlement

Settlement is replay-safe and checks the linked gameplay source at execution time. A recording contract cannot settle until the recording session is complete; equivalent checks apply to gigs, tours, songs, and songwriting projects. Escrow releases once, through the Finance journal, and the contract is then marked completed with source evidence retained in the shared social-contract event stream.

## Player surfaces

- Band agreements expose a music-collaboration workspace for authorised band managers and active members.
- Character agreements expose invitations and active/completed collaboration agreements for the current profile.
- Accept/decline/cancel/settle actions call D6 RPC boundaries; the browser never writes contract, credit, escrow, or royalty rows directly.
