# City Scene XP economy audit — 27 October 2026

**Source:** read-only aggregates from the main RockMundo `experience_ledger`, previous 30 days. Values are gameplay ledger statistics and exclude zero/negative awards. **No payout configuration was enabled in this audit.**

## Existing XP award benchmarks

| Verified activity | Positive XP ledger entries | Median XP per entry |
|---|---:|---:|
| Work shift | 75 | 13 |
| YouTube learning | 44 | 15 |
| Studio recording completion | 22 | 8 |
| University attendance | 120 | 147 |
| Mentor session | 33 | 260 |
| Book reading | 14 | 112 |
| Battle of the Bands | 7 | 1,000 |

There were **317 positive-XP ledger entries**, amounting to **38,440 XP** across **17 profiles** in this period; the distribution is skewed by classes, mentoring and competitions. These figures are **not a reliable per-player daily baseline** because activity frequency and account tenure vary.

## Proposed City Scene participation payouts (NOT ENABLED)

Current policy definitions in `scene_reward_policies`:

| Entitlement | XP | Condition |
|---|---:|---|
| Daily participation | 20 | At least 1 verified personal scene point |
| Daily completion bonus | 20 | At least 1 personal point plus all city objectives completed |
| Weekly participation | 75 | At least 2 personal scene points in the week |
| Monthly participation | 250 | At least 3 personal scene points in the month |

The **theoretical 30-day ceiling** for a character eligible for every entitlement is **1,750 XP** (30 × [20 + 20] daily, 4 × 75 weekly, plus 250 monthly). This is not a typical expected result: it requires repeated eligible personal activities and the daily city-wide objective set to be completed every day. Month boundaries and eligible calendar weeks affect the exact total.

**Risk:** A 20-XP daily bonus exceeds the usual 8-XP studio recording and 13-XP work-shift awards, and can be earned from scene events that may already carry their own XP. The city-completion bonus can further compound this. Early evidence is extremely thin (3 scene contribution rows from just 1 account and 2 distinct source events). Do not treat it as proof of healthy participation.

## Required before enabling

1. Observe at least one full daily and weekly cycle under the current server-verified contribution rules and multiple distinct player accounts, including source mix and per-city availability.
2. Quantify per-account daily scene credits, days active, source XP already earned and the upper tail of payouts. Do not infer representativeness from three rows.
3. Confirm one account cannot multiply reward claims by switching between characters/cities in a cycle. Verify exact-once wallet/ledger/receipt grants after replay.
4. Test the newly deployed **time-limited operator approval gate** `20261027163000_scene_reward_activation_approval_gate.sql`: reward policy and payout enablement require privileged approval, and grants return `approval_required=true` after expiration even if flags were previously switched on.
5. Start with a **small explicit canary**, document the approved XP limits and how to suspend payouts, and monitor ledger balances and claims before wider availability. No cron payout task should be installed without a reviewed owner and alerting.

**Status at audit:** all reward policies disabled; payout switch off; no XP canary cron, no scene reward claims, receipts or XP ledger rows. Verified-action scoring cron remains healthy and active.
