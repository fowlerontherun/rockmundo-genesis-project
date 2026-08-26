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

Births, weddings, coming-of-age conversions, and dynasty milestone unlocks are captured into the family legacy event ledger. Existing families were backfilled so the Hall of Records does not begin empty for established dynasties.

`get_family_legacy()` recursively follows converted descendants with cycle protection and a bounded traversal depth. The existing Family Dashboard continues to use `FamilyLegacyPanel`, which now renders parents, the current generation, direct children, and later generations from that server projection rather than browser-calculated inheritance values.

## Inherited social capital

When an adult child is explicitly converted into a playable profile, G2 derives a bounded inherited social-capital value from authoritative parent fame, parent fans, and the recorded parent-child bonds.

The value is capped at **25** and written once to `family_social_capital_ledger` and the heir profile. It is intended as a bounded dynasty/trust signal, not an uncapped money or progression multiplier.

## Privacy and announcements

Family visibility defaults to private with all announcement toggles disabled.

Players can opt into wedding, birth, and coming-of-age announcements. A shared family event is exposed by `get_public_family_announcements()` only when every recorded owner has public announcement visibility enabled and has opted into that event type. One participant cannot publish another participant's family event unilaterally.

Family-tree visibility is enforced by `get_public_family_tree(profile_id)`. A private tree returns no lineage data; a public tree returns a sanitized recursive family projection for authenticated viewers.

## Dynasty milestones

G2 records idempotent milestones from the recursive descendant graph for:

- first child;
- second generation;
- three generations;
- a growing family line with four recorded descendants.

Milestones are persisted into dynasty history as idempotent events. They are recognition/history evidence only and do not award unrestricted economic power.

## Player surface

The existing Family Dashboard now exposes:

- authoritative generation and inherited social capital;
- persistent recursive parents/current-generation/children/later-generation lineage;
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
- family trees default private and the public-tree RPC refuses lineage data unless the owner opts in;
- announcement defaults are private/off and shared public announcements require unanimous opt-in.

Focused source-contract coverage is in `src/components/family/__tests__/g2DynastyAuthority.contract.test.ts`.
