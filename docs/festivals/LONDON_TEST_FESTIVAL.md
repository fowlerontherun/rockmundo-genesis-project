# RockMundo London Test Festival

Purpose: deterministic development and QA fixture for validating the complete festival owner dashboard without adding production seed data.

## Seed and rerun

Run manually after a local Supabase reset:

```bash
npm run seed:festival:london
```

The seed contains a hard SQL guard and refuses to run unless `app.allow_test_fixtures=true` is set. The npm script sets this via `PGOPTIONS`, so use `npm run seed:festival:london` or an equivalent `PGOPTIONS="-c app.allow_test_fixtures=true" psql ...` command. Rerunning the seed is a destructive fixture reset for deterministic fixture-owned stages, slots, acts, staff, permits, insurance and ledger rows; cleanup is scoped to fixture idempotency keys and metadata.

## Assign an owner

Create or sign in with a local test account, find its profile id, then run:

```sql
-- run with the local service-role connection
select public.assign_london_test_festival_owner('<profile uuid>');
```

This updates only the deterministic fixture festival owner and does not weaken RLS. The helper is `SECURITY DEFINER`, revokes `PUBLIC`, `anon` and `authenticated`, and grants execute only to `service_role` (database owner/postgres can still manage it naturally).

## Stable URLs

The fixture uses deterministic ids:

- Brand id: `11111111-1111-4111-8111-111111111111`
- Edition id: `11111111-1111-4111-8111-111111111112`
- Public URL: `/festivals/11111111-1111-4111-8111-111111111111`
- Owner URL: `/festivals/11111111-1111-4111-8111-111111111111/manage/editions/11111111-1111-4111-8111-111111111112`

Lookup query:

```sql
select f.id as festival_id, e.id as edition_id,
       '/festivals/' || f.id as public_url,
       '/festivals/' || f.id || '/manage/editions/' || e.id as owner_url
from festivals f
join festival_editions e on e.festival_id = f.id
where f.metadata->>'fixture_key' = 'RM-LONDON-TEST-FESTIVAL';
```

## Expected dashboard values

- City/currency: London, GBP
- Capacity: 10,000
- Tickets sold target represented by fixture metadata/dashboard checks: 3,250 / 10,000
- Budget: £250,000 approved, £110,000 committed, £140,000 remaining, 44% used
- Stages: Main Stage, River Stage, New Music Stage
- Slots: 36 total: 3 days × 3 stages × 4 slots, with 21 occupied and 15 intentionally empty
- Staff: promoter, booker, safety officer, medic, one stage manager per stage and one sound engineer per stage
- Permits: canonical `public_event`, `noise`, `temporary_structures`, `fire_safety` and `amplified_music` approved
- Insurance: active canonical policy with `active = true` and `policy_status = pending_payment`

## Checklist

- ✓ Festival details
- ✓ Dates and location
- ✓ Three stages configured
- ✓ Performance slots created on all three stages
- ⚠ Lineup partially filled
- ⚠ Some contracts outstanding
- ✓ Tickets configured
- ✓ Staffing arranged, including sound engineers
- ✓ Five canonical permits approved
- ✓ Insurance active
- ✓ Budget approved
- ✓ Operational readiness complete for fixture baseline

## Why pending-payment insurance?

The canonical purchase workflow can produce a valid policy row with `active = true` and `policy_status = pending_payment`. The dashboard must recognise the `active` flag while still rejecting cancelled, expired, rejected or void policies.

## Remove/reset

Use `supabase db reset` to remove local fixture data, or rerun the seed to restore it. Do not run this seed as part of production deployment.

## Compatibility event

The fixture retains a read-only `game_events` compatibility row (`11111111-1111-4111-8111-111111111113`) only for legacy route and migration mapping coverage through `festival_legacy_mappings` and resolver functions that still understand `legacy_source = 'game_event'`. Canonical stages and slots use the festival brand id in their canonical `festival_id` field; no participant, booking, finance or state mutation should be written through the compatibility event. The future removal path is to retire legacy `game_events` identifier resolution after all festival routes and RPCs accept canonical brand or edition ids only.
