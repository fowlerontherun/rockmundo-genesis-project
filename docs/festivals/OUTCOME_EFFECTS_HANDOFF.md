# Festival Outcome Effects Handoff

This PR prepares effect instructions for a later settlement PR.

## Pending effects only

`festival_performance_effects` stores proposed band fame, streaming uplift and festival reputation values with `application_status = application_pending`. `festival_fan_conversion_outcomes`, `festival_media_outcomes` and `festival_sponsor_outcomes` store related proposals and sentiment.

## Not applied here

This PR does not directly update band fame, player fame, fan totals, city popularity, song streams, skill XP, band chemistry, balances, sponsor payments, guarantees, deposits, bonuses, merch, ticket revenue, taxes or festival treasury.

## Settlement handoff

The next PR should validate pending effects, apply approved career effects exactly once, and settle performance contracts with ledger entries. Suggested title: `feat(festivals): apply career effects and settle performance contracts`.
