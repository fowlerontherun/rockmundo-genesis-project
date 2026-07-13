# Skills and Attributes Programme Final Audit

This audit consolidates the Skills & Attributes programme as of 2026-07-13. Status values are: Complete, Partial, Missing, Deprecated, Blocked. Complete is used only when an implementation has an automated validation or an existing subsystem test.

| Programme area / PR theme | Intended outcome | Status | Evidence | Remaining work |
|---|---|---|---|---|
| Canonical skill catalogue | One catalogue for active skills, display names, tiers, curves and policy metadata | Complete | `CANONICAL_SKILLS` and validation command parse every active entry | Keep generated DB seed in sync |
| Attribute catalogue | One catalogue for attribute metadata and affected systems | Complete | `FULL_ATTRIBUTE_KEYS` and `FULL_ATTRIBUTE_METADATA` are validated | Add richer localized descriptions later |
| Skill-to-attribute relationships | Explicit learning links, no active regex fallback | Complete | validation fails active skills without `CANONICAL_ATTRIBUTE_LINKS` | Legacy SQL comments remain documented |
| Prerequisites and unlock routes | Starter/university route for every skill and checked prerequisites | Complete | generated unlock routes and cycle detection | Add content-design review before new unlock sources |
| Progression curves | Shared helpers for next, cumulative and lifetime XP | Complete | `progressionBalance.ts` is the source of truth | Remove old helper references when touched |
| Practice rules | Server-authoritative limits and shared balance values | Partial | balance constants exist; validation checks ownership | Need DB harness for concurrent bookings |
| Songwriting integration | Canonical songwriting links and calculator usage | Partial | system links identify songwriting skills | Some legacy screens need endpoint-level proof |
| Recording integration | Canonical recording roles and skills | Partial | role/system links exist | Add DB-backed recording completion fixtures |
| Gig integration | Canonical live-gig performance skills | Partial | role/system links exist | Full E2E still manual/Playwright follow-up |
| Mastery | Metadata and maintenance policies exist | Partial | catalogue mastery fields and simulations | More rank-path fixtures required |
| Maintenance / sharpness | Policies and simulations exist | Complete | `skillMaintenance.ts` and simulation docs | Monitor punitive burden in production |
| Teaching and mentoring | Skill teachability policy and outcome calculator | Partial | teaching code paths are present | Need stronger idempotency harness |
| Band progression goals | Goal docs/migrations exist | Partial | band progression audit exists | Add representative journey automation |
| Achievements | Canonical achievement validation exists | Complete | `npm run test:achievements` | Add more source-event fixtures |
| Player analytics | Progression analytics migration exists | Partial | migration and dashboard hooks | Add error-rate rollups |
| Admin balancing | Balance diagnostics page and validation | Complete | `validate:balance` and diagnostics page | Schedule extended simulations |
| Migration safety | Review document and deprecation register | Complete | this PR adds final review and register | Production dry run before deploy |

## Temporary compatibility paths and legacy data

Legacy skill rows may lack catalogue references, balance versions, outcome breakdowns, contributor rows, role assignments, sharpness timestamps or achievement source events. Read paths must show explicit legacy-incomplete states, never fabricate details and never reroll completed outcomes. Write paths must capture current catalogue and balance versions.

## Reward-source matrix

| Reward source | Reward | Authority | Idempotency evidence | Ledger/event requirement | Risk |
|---|---|---|---|---|---|
| Practice | Skill XP, possible AP | server progression function | source event key | skill XP ledger | duplicate completion under concurrency |
| Lessons/education | Skill XP | server attendance function | booking/session id | skill XP ledger | stale balance version |
| Rehearsal/gig | Skill XP, band rewards, achievements | server completion | gig/rehearsal id | contribution and XP ledgers | client quality spoofing |
| Songwriting | Skill XP, achievement | server completion calculator | project id + completion id | outcome breakdown and event | legacy project without contributors |
| Recording | Skill XP, credits, analytics | server completion calculator | booking id | outcome breakdown and ledger | role mismatch |
| Teaching | payment, reputation, skill XP | server lesson completion | lesson id + teacher/student pair | teaching ledger | repeat farming |
| Band goals | AP/XP/milestone | server milestone evaluator | goal id + milestone | band reward ledger | member autonomy leakage |
| Achievements | XP/AP/cosmetic rewards | server event evaluator | achievement id + source event | achievement event ledger | duplicate source replay |

## Risks and gaps

Performance risks are repeated catalogue loading, relationship joins without indexes, analytics scans and request-per-card UI patterns. Security risks are client-authoritative rewards, cross-profile reads and admin repair utilities without explicit authorization. Observability gaps are fallback usage counts, outcome-version distribution, repair dry-run reports and progression error rates.
