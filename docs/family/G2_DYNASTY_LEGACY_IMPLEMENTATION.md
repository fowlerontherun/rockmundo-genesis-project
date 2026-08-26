# G2 — Dynasty, family tree and legacy progression

## Purpose

G2 turns the existing family UI shell into a persistent, server-authoritative dynasty record. It extends the G1 child and co-parent lifecycle rather than introducing a second family model.

## Live database authority

All database changes for G2 were applied directly to the live RockMundo Supabase database. No migration file is included in this branch.

Canonical G2 structures:

- `family_legacy_settings`
- `family_lineage_edges`
- `family_legacy_events`
- `family_social_capital_ledger`
- `family_dynasty_milestones`
- `profiles.legacy_social_capital`

All five G2 tables have RLS enabled and ordinary authenticated clients have no direct table privileges. Player reads and privacy changes use narrow RPCs.

## Persistent lineage and history

Existing `player_children`, `profiles`, and `marriages` remain the source gameplay records. G2 derives persistent lineage edges and idempotent history events from those canonical records.

Births, weddings, and coming-of-age conversions are captured into the family legacy event ledger. Existing families were backfilled so the Hall of Records does not begin empty for established dynasties.

The Family Dashboard continues to use the existing `FamilyLegacyPanel`, now backed by `get_family_legacy()` rather than browser-calculated inheritance values.

## Inherited social capital

When an adult child is explicitly converted into a playable profile, G2 derives a bounded inherited social-capital value from authoritative parent fame, parent fans, and the recorded parent-child bonds.

The value is capped at **25** and written once to `family_social_capital_ledger` and the heir profile. It is intended as a bounded dynasty/trust signal, not an uncapped money or progression multiplier.

## Privacy and announcements

Family visibility defaults to private with all announcement toggles disabled.

Players can opt into wedding, birth, and coming-of-age announcements. A shared family event is exposed by `get_public_family_announcements()` only when every recorded owner has public announcement visibility enabled and has opted into that event type. One participant cannot publish another participant's family event unilaterally.

## Dynasty milestones

G2 records idempotent milestones for:

- first child;
- second generation;
- three generations;
- a growing family line with four recorded descendants.

Milestones are recognition/history evidence only and do not award unrestricted economic power.

## Player surface

The existing Family Dashboard now exposes:

- authoritative generation and inherited social capital;
- persistent parents/current-generation/children lineage;
- Hall of Records history;
- dynasty milestones;
- family privacy controls;
- privacy-gated public family announcements;
- loading, error, retry, and empty states.

## Security verification

Live verification confirmed:

- RLS is enabled on every G2 authority table;
- `authenticated` has no direct table privileges on the G2 authority tables;
- browser-facing G2 RPCs are executable by `authenticated` and denied to `anon`;
- internal lineage/event/milestone helpers cannot be executed by browser roles;
- all G2 `SECURITY DEFINER` functions have `search_path=pg_catalog, public`;
- announcement defaults are private/off and shared public announcements require unanimous opt-in.

Focused source-contract coverage is in `src/components/family/__tests__/g2DynastyAuthority.contract.test.ts`.
