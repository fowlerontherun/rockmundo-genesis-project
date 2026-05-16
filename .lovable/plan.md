# Fame & Fans Attribution Debug Panel

A new admin-only page that, for any character on any given day, shows the exact list of events that contributed to their fame and fans totals, with the XP, cash, and gig grade context attached to each event.

## Goal

Today fame and fans move because of many systems (gigs, festivals, releases, music videos, awards, sponsorships, social drama, DikCok, modeling, fan conversions, decay, etc.) but there is no single place to see "why did this character gain 42 fame and 1,210 fans on May 14?". This panel makes that auditable for admins / QA.

## Scope

In scope:
- Admin-only React page under the existing admin hub.
- Read-only aggregation over existing event tables — no schema changes to gameplay tables.
- One new lightweight `fame_fans_attribution_daily` materialized rollup + a SECURITY DEFINER RPC that returns per-event detail rows for a (character, date) pair.
- Per-character view: pick a character, pick a date (default: today, game-time), see two stacked breakdowns (Fame, Fans), each as an itemized list and a totals strip.
- Per-event detail row includes: timestamp, source system, event type, fame delta, fans delta, XP delta (if any), cash delta (if any), gig grade (if gig/festival), linked entity (gig id, release id, etc.) with deep link.
- CSV export of the day's rows.
- Filters: source system multi-select, "only positive", "only negative/decay".

Out of scope (can follow up):
- Editing or reversing events.
- Band-wide aggregation page (we surface band events for bands the character is in, but the primary axis is the character).
- Backfilling historical data that was never logged in the first place — we use what the existing tables already store.

## Data sources (already in DB)

Fame contributors:
- `band_fame_events` (event_type, fame_gained, event_data, band_id) — primary fame ledger.
- `band_fame_history` (city/country/global scopes, fame_change, event_type).
- `reputation_events`, `award_red_carpet_events`, `eurovision_events`, `major_event_performances`, `festival_performance_history`, `social_drama_events`, `nightclub_events`, `fashion_events` — secondary fame triggers; joined via their own `created_at`/event_type/metadata.

Fans contributors:
- `gig_fan_conversions` (new_fans_gained, repeat_fans, superfans_converted, attendance, conversion_rate).
- `band_city_fans` / `band_country_fans` / `band_demographic_fans` — diffed day-over-day to derive net change per scope.
- `fan_interactions`, `fan_campaigns`, `dikcok_fan_missions`, `dikcok_fan_tips`.

XP / cash context per event:
- `experience_ledger` (xp_amount, skill_slug, activity_type, metadata) joined by `metadata->>source_id` / time window.
- `profile_daily_xp_grants` for daily XP caps context.
- Cash from `transactions` (existing) joined by metadata link or time-correlated.

Gig grade:
- `player_gig_xp` + gig result tables already store letter grade / score; surface alongside any fame/fans row whose event_data references that `gig_id`.

Character ↔ band linkage:
- Use existing `band_members` to map `profile_id` → `band_id[]` so we pull band-scoped events for bands the character belongs to.

## Backend

1. SQL migration adds:
   - `public.get_fame_fans_attribution(p_profile_id uuid, p_day date)` SECURITY DEFINER, returns `setof` rows: `occurred_at, axis ('fame'|'fans'), source_system, event_type, delta, xp_delta, cash_delta, gig_grade, entity_kind, entity_id, scope, notes jsonb`.
   - Internally `UNION ALL` over the tables above, filtered to the character's profile_id and bands, bounded by `[p_day, p_day + 1 day)` in game time.
   - Grants execute to `authenticated`; the function itself checks `has_role(auth.uid(),'admin')` and raises if not.
   - Optional `fame_fans_attribution_daily` matview keyed by (profile_id, day, axis, source_system) for the summary strip; refreshed by an existing daily cron piggyback (no new cron).

2. No edits to existing event-writing code. If a contributor isn't currently writing a discoverable row, it shows up as "untracked" in a diagnostics footer so we can fix it later.

## Frontend

New route `src/pages/admin/FameFansAttribution.tsx`, linked from the admin hub tile grid (admin-only, gated by `useUserRole`).

Layout:
```text
[ Character picker ]  [ Date picker ]  [ Source filter ]  [ Export CSV ]

Totals strip:
  Fame  +123  (gigs +80, releases +30, awards +13, decay -0)
  Fans  +1,210 (gig conv +900, social +210, decay -100)

Tabs: Fame | Fans
  Table columns: Time · Source · Event · Δ · XP · Cash · Gig grade · Entity (link)
  Sticky footer: row count, sum delta, "unattributed delta" diff vs stored daily total.
```

Components:
- `FameFansAttributionPanel.tsx` — main page.
- `AttributionTotalsStrip.tsx` — chips per source.
- `AttributionTable.tsx` — virtualised list, deep-link entity column.
- `useFameFansAttribution(profileId, day)` hook over the RPC.

Reuses existing admin chrome and design tokens. High-density mobile rows (per project memory).

## Verification

- Pick a character that just did a gig: confirm a `gig` row appears with the right grade, fame delta matches `band_fame_events.fame_gained`, fans delta matches `gig_fan_conversions.new_fans_gained`.
- Pick a character with a recent music video release: confirm release and MV-impact rows appear.
- Day with no activity returns empty tables and zero totals (no error).
- Non-admin user hitting `/admin/fame-fans` is redirected.

## Versioning

Bump banner to `1.1.317` and add a `feature` entry to the Version History page describing the new admin attribution panel.
