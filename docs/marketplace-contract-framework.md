# Marketplace and Contract Framework

RockMundo's MMO economy uses a shared marketplace and contract framework so gameplay systems can trade, hire, commission and collaborate without each feature inventing bespoke transaction logic.

## Architecture

The framework separates these concepts:

- **Marketplace listings** describe availability or intent: instruments for sale, venue hire, session work, teaching, artwork commissions, studio time and future non-physical services.
- **Contract offers** are proposed agreements between two entities. They may originate from a listing or be direct offers.
- **Negotiations** are contract revisions. Every counter offer increments the revision and records a negotiation history event.
- **Accepted contracts** are commitments that have passed permission, availability and funds checks.
- **Completed, cancelled and expired contracts** are terminal operational states that can later be archived as historical contracts.
- **Historical contracts** preserve the audit trail for reputation, disputes and analytics.

The pure TypeScript service in `src/utils/marketplaceFramework.ts` is intentionally storage-agnostic. Database tables, Supabase RPCs or server actions can call the same validation and transition helpers.

## Entity model

All owners and counterparties use a generic entity reference:

```ts
{ type: "player" | "band" | "company" | "venue" | "festival" | "studio" | "organisation" | "npc" | string, id: string }
```

This supports Player, Band, Company, Venue, Festival, Studio, Organisation, NPC and future entity types without schema redesign.

## Listing lifecycle

Supported listing states are:

1. `draft`
2. `published`
3. `hidden`
4. `paused`
5. `accepted`
6. `completed`
7. `cancelled`
8. `expired`

Allowed transitions are encoded in `listingTransitions`. Invalid transitions throw `MarketplaceTransitionError` and every valid transition writes a `MarketplaceHistoryEvent`.

## Contract architecture

Contract templates define reusable defaults for categories such as session musician, producer, songwriter, transport hire, venue hire, teaching, artwork, security or tour management.

Supported payment and agreement shapes include:

- Fixed price
- Salary
- Revenue share
- Royalty percentage
- Commission
- Time-based employment
- One-off agreement
- Ongoing agreement
- Recurring payment

Contract states are `offer`, `negotiating`, `accepted`, `completed`, `cancelled`, `expired` and `historical`.

## Permission model

The server must never trust client ownership. Actors carry server-derived roles for specific entities. Examples:

- Band leaders can create band listings when granted `listing:create`.
- Company managers can negotiate company service contracts when granted `contract:negotiate`.
- Festival organisers and venue managers can publish listings only for their authorised entities.
- Delegates can receive narrow permissions without becoming owners.

All creation and transition helpers call permission checks before changing state.

## Security checks

Server-side callers should validate:

- Ownership and delegated permissions.
- Listing availability windows and capacity.
- Existing commitments before acceptance.
- Funds for payment-bearing terms.
- State transition legality.

The framework includes permission, availability, funds and transition guards. Future persistence adapters should execute these checks in trusted server contexts and mirror critical constraints in database RLS or RPC functions.

## Negotiation support

`reviseContractOffer` replaces terms, increments `revision`, records a negotiation audit event and moves the contract to `negotiating`. This supports future counter offers, price negotiation, duration negotiation, payment negotiation and multiple revisions.

## Notifications and social integration

The framework emits integration events rather than sending messages directly:

- `messages` for direct contract offers.
- `notifications` for listing state changes.
- `activity_feed` for accepted contracts.
- `social_hub` is reserved for future public collaboration updates.

Existing messaging, notification, activity feed and social hub systems should consume these events instead of duplicating communication logic.

## Reputation hooks

The framework exposes reputation hook events for:

- Successful contracts
- Cancelled contracts
- Late delivery
- Failed work
- Reliability
- Professionalism
- Player reviews

This PR records success and cancellation hooks. Later review and dispute systems can consume the same event shape.

## Extension points

Future gameplay features should add domain-specific metadata while reusing core listings, templates, terms, permission checks, negotiation revisions, notifications and audit history. Examples include instrument sales, clothing, cosmetics, song rights, publishing rights, merchandise, studio bookings, recruitment, transport hire, festival bookings, equipment rental, lessons, designers, photographers, journalists, agencies, security, tour managers and crew.
