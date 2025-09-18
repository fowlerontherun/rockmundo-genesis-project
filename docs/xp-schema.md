# XP Progression Schema

This document outlines the database primitives that back the upcoming XP and attribute progression systems. All tables live in the `public` schema and use `profiles.id` as the canonical foreign key for player-facing rows.

## Tables

### `player_xp_wallet`
- **Purpose:** Stores the running totals for spendable XP and derived point balances.
- **Columns:**
  - `profile_id uuid PK` – references `profiles.id` with `ON DELETE CASCADE`.
  - `xp_balance integer` – spendable XP remaining after deductions.
  - `lifetime_xp integer` – cumulative XP earned by the profile.
  - `xp_spent integer` – total XP consumed for any sink.
  - `attribute_points_earned integer` – total attribute points granted from conversions.
  - `skill_points_earned integer` – total skill points granted from conversions.
  - `last_recalculated timestamptz` – timestamp of the last wallet reconciliation.
- **Indexes:** `idx_player_xp_wallet_updated_at` (`last_recalculated DESC`).

### `xp_ledger`
- **Purpose:** Immutable audit trail of XP mutations for analytics and support.
- **Columns:**
  - `id uuid PK`.
  - `profile_id uuid` – FK to `profiles` (`ON DELETE CASCADE`).
  - `event_type text` – categorises the source (e.g. `gig_reward`, `daily_conversion`).
  - `xp_delta integer` – signed XP change for the event.
  - `balance_after integer` – wallet balance immediately after applying the entry.
  - `attribute_points_delta integer` – attribute points granted/consumed in the same action.
  - `skill_points_delta integer` – skill points granted/consumed in the same action.
  - `metadata jsonb` – optional structured context (payload IDs, modifiers, etc.).
  - `created_at timestamptz` – UTC timestamp of the event.
- **Constraints:** `xp_ledger_non_zero_change` ensures at least one of the deltas is non-zero.
- **Indexes:**
  - `idx_xp_ledger_profile_created_at` on (`profile_id`, `created_at DESC`).
  - `idx_xp_ledger_event_type` on (`event_type`).

### `player_attributes`
- **Purpose:** Canonical snapshot of a profile's attribute distribution.
- **Columns:**
  - `id uuid PK`.
  - `profile_id uuid` – FK to `profiles` (`ON DELETE CASCADE`).
  - `created_at`, `updated_at` timestamptz.
  - `attribute_points integer` – total points currently banked.
  - `attribute_points_spent integer` – lifetime points invested into attributes.
  - Eight legacy progression stats kept for backwards compatibility: `physical_endurance`, `mental_focus`, `stage_presence`, `crowd_engagement`, `social_reach`, `creativity`, `technical`, `business`, `marketing`, `composition`.
  - New growth-focused attributes: `musical_ability`, `vocal_talent`, `rhythm_sense`, `creative_insight`, `technical_mastery`, `business_acumen`, `marketing_savvy`.
- **Constraints:** `player_attributes_value_bounds` clamps all tracked attributes between 0 and 1,000.
- **Indexes:** `idx_player_attributes_profile_id` enforces a one-to-one relationship with `profiles`.

### `player_weekly_activity`
- **Purpose:** Aggregated XP and activity counters for cadence dashboards and streak systems.
- **Columns:**
  - `id uuid PK`.
  - `profile_id uuid` – FK to `profiles` (`ON DELETE CASCADE`).
  - `week_start date` – Monday-aligned week anchor.
  - `xp_earned`, `xp_spent integer`.
  - `sessions_completed`, `quests_completed`, `rehearsals_logged integer` – gameplay counters.
  - `created_at`, `updated_at` timestamptz.
- **Constraints/Indexes:**
  - Unique constraint on (`profile_id`, `week_start`).
  - Indexes on `profile_id` and `week_start DESC` for reporting queries.

### `player_daily_cats`
- **Purpose:** Daily XP rollups by gameplay category to power streaks and balancing logic.
- **Columns:**
  - `id uuid PK`.
  - `profile_id uuid` – FK to `profiles` (`ON DELETE CASCADE`).
  - `activity_date date` – UTC day bucket.
  - `category text` – constrained to `practice`, `performance`, `quest`, `social`, `other`.
  - `xp_earned`, `xp_spent integer` – per-category totals.
  - `activity_count integer` – number of contributing actions.
  - `metadata jsonb` – optional payload details (event IDs, multipliers, etc.).
  - `created_at`, `updated_at` timestamptz.
- **Constraints/Indexes:**
  - Unique constraint on (`profile_id`, `activity_date`, `category`).
  - Indexes on `profile_id` and `activity_date DESC`.

### `attribute_spend`
- **Purpose:** Lightweight ledger of attribute upgrade purchases.
- **Columns:**
  - `id uuid PK`.
  - `profile_id uuid` – FK to `profiles` (`ON DELETE CASCADE`).
  - `attribute_key text` – one of the seven modern attributes listed above.
  - `points_spent integer` – number of attribute points consumed (> 0).
  - `xp_cost integer` – XP cost charged for the spend (>= 0).
  - `metadata jsonb` – optional context (source screen, modifiers, etc.).
  - `created_at timestamptz` – UTC timestamp.
- **Indexes:** on (`profile_id`, `created_at DESC`) and on `attribute_key`.

## XP Cost Curve Reference

Keep the following constants aligned across database procedures and frontend helpers:

- **Daily conversion rates** (see `process_daily_point_conversions`):
  - `skill_rate = 150` XP → 1 skill point.
  - `attribute_rate = 400` XP → 1 attribute point.
- **Attribute training helpers** (`src/utils/attributeProgression.ts`):
  - `ATTRIBUTE_MAX_VALUE = 1000`.
  - `ATTRIBUTE_TRAINING_INCREMENT = 10` points per training session.
  - `getAttributeTrainingCost(currentValue) = ceil(120 + currentValue × 0.85)` XP.

Future services should use these tables and constants when granting rewards, spending XP, or surfacing UI summaries so player balances stay consistent end-to-end.
