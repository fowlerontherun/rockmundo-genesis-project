# RockMundo London Test Festival

Purpose: deterministic development and QA fixture for validating the complete festival owner dashboard without adding production seed data.

## Seed and rerun

Run manually after a local Supabase reset:

```bash
npm run seed:festival:london
```

The seed is idempotent and owns only records marked with `fixture = london-dashboard` / `fixture_key = RM-LONDON-TEST-FESTIVAL`.

## Assign an owner

Create or sign in with a local test account, find its profile id, then run:

```sql
select assign_london_test_festival_owner('<profile uuid>');
```

This updates only the fixture festival owner and does not weaken RLS.

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
- Slots: 24 total, 15 occupied, 9 intentionally empty
- Staff: seven roles arranged
- Permits: 4 / 4 approved
- Insurance: active canonical policy with `active = true` and `policy_status = pending_payment`

## Checklist

- ✓ Festival details
- ✓ Dates and location
- ✓ Three stages configured
- ✓ Performance slots created
- ⚠ Lineup partially filled
- ⚠ Some contracts outstanding
- ✓ Tickets configured
- ✓ Staffing arranged
- ✓ Four permits approved
- ✓ Insurance active
- ✓ Budget approved
- ⚠ Operational readiness incomplete

## Why pending-payment insurance?

The canonical purchase workflow can produce a valid policy row with `active = true` and `policy_status = pending_payment`. The dashboard must recognise the `active` flag while still rejecting cancelled, expired, rejected or void policies.

## Remove/reset

Use `supabase db reset` to remove local fixture data, or rerun the seed to restore it. Do not run this seed as part of production deployment.
