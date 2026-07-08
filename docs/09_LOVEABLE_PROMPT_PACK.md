# Monetisation Readiness for Beta

## Purpose

Prepare monetisation safely without damaging player trust or creating pay-to-win concerns.

## Beta monetisation principle

Do not sell power.

RockMundo should monetise identity, convenience, cosmetics, and support for the game.

## What not to sell

Do not sell:

- XP boosts that affect competition
- direct fame/fans
- direct chart success
- better song quality
- better gig outcomes
- premium-only competitive advantages
- paid access to exploit-prone systems

## Safe beta monetisation options

### Founder supporter pack

Offer only if payment flow is safe.

Can include:

- founder badge
- profile theme
- cosmetic item
- name in credits/supporter wall
- future premium trial

### Premium membership placeholder

During beta, you can show intended benefits without charging:

- extra cosmetic slots
- profile themes
- advanced career stats
- extra saved outfits
- custom band page decorations
- supporter badge

### Cosmetics

Good categories:

- avatar clothing
- profile backgrounds
- band logo styles
- venue decorations
- UI themes
- collectible badges

### Convenience, not power

Potential premium convenience:

- more saved looks
- advanced statistics
- custom profile layout
- expanded archive/history
- additional character slots, if not competitive

## Payment safety checklist

Before real payments:

- immutable purchase records
- entitlement table
- admin adjustment log
- refund process
- server-side entitlement validation
- clear pricing
- terms/privacy reviewed
- test mode verified
- no client-only unlocks

## Entitlement model

Recommended table concept:

```text
user_entitlements
- id
- user_id
- entitlement_type
- source
- purchase_id
- status
- granted_at
- expires_at
- revoked_at
- metadata
```

## Founder pack idea

### RockMundo Backstage Pass

Includes:

- Founder badge
- exclusive beta profile frame
- exclusive band sticker pack
- 30 days premium after launch
- supporter credit

Avoid giving money, fans, fame, or competitive resources.

## Pricing experiments

For beta, collect interest before heavy implementation:

- “Would you support RockMundo?” button
- premium interest survey
- cosmetic preference poll
- founder pack waitlist

## Monetisation metrics

Track:

- premium page visits
- founder interest clicks
- cosmetic preview clicks
- conversion intent
- churn after seeing monetisation
- complaints about fairness

## Trust statement

Publish a clear statement:

> RockMundo will never sell chart success, fame, fans, XP, or competitive advantage. Premium features support the game through cosmetics, identity, convenience, and optional extras.

## Beta recommendation

For early closed beta, do not enable real payments unless the entitlement system is fully audited.

For open beta, consider a founder pack only after stability and trust are established.
