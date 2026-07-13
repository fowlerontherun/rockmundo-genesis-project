# Band agreements and revenue-share protections

This system extends the existing `bands`, `band_members`, recruitment, governance, finance, songwriting, recording, release, notification, SSE and audit foundations. It does not create a second membership, song-rights or payment model: agreements store structured gameplay terms and every domain system should resolve terms through the agreement services before mutating existing domain records.

## Existing-system interaction

- Membership remains owned by `band_members`; membership agreements gate activation where a band requires contracts.
- Recruitment offers may generate draft membership agreements after conditional acceptance; full membership waits for required signatures.
- Governance proposals can approve creating or amending an agreement version, but cannot bypass affected-party acceptance.
- Songwriting and recording records remain authoritative for explicit credits, splits and master ownership. Band agreements only provide defaults.
- Finance, gig, tour, merch, sponsorship and release income should call `BandRevenueAllocationService` to resolve an active agreement and persist allocation snapshots.
- Audit and notifications record proposed, changed, signed, activated, terminated, departure, settlement and dispute events without exposing private percentages publicly.

## Precedence

Revenue and ownership conflicts are resolved centrally in this order:

1. Platform rules and mandatory protections.
2. Song-specific ownership.
3. Recording-specific ownership.
4. Release- or project-specific agreement.
5. Member-specific agreement.
6. Active band revenue agreement.
7. Fallback platform defaults.

## Revenue allocation

Revenue rules are category-specific (`gig_income`, `tour_income`, streaming, sales, royalties, merchandise, sponsorship, festival, licensing and other income). Allocations use net distributable revenue after permitted costs. Band reserve is an explicit recipient, never a hidden remainder. Historical earnings are protected because each generated revenue event stores the agreement id, agreement version, source, gross amount, costs, rules used, recipients and timestamp.

## Surviving rights

Departure, removal, termination or band disbanding must preserve songwriting ownership, recording credit, earned but unpaid revenue, historical credits, agreed future royalties, completed fixed-fee entitlement and immutable audit history. Management permissions, scheduling authority and private band operations access usually end at departure unless a still-active agreement says otherwise.
