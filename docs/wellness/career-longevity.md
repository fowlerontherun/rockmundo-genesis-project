# Career Longevity, Retirement, Comebacks, Mentoring and Legacy

This expansion connects Wellness, career history and time-away systems so long-running characters evolve without forced decline, permanent skill loss or unavoidable retirement.

## Career-age model

The model separates biological age from career age. Career age is derived from the earliest credible career milestone: explicit career start, first band, first gig, first release or first contract. Character creation date is only a conservative fallback during migration.

Tracked concepts include active-career years, touring years, retired time, inactive time and a bounded experience score. Missing historical data defaults to neutral values so migrated characters do not receive severe penalties.

## Career stages

Server code resolves stages from active years, experience and activity volume rather than age alone:

| Stage | Role |
| --- | --- |
| Emerging | Early career, basic longevity education and fast experimentation. |
| Developing | Growing reliability, early workload insight and mentee access. |
| Established | Consistent performer, selective modes and mentor eligibility. |
| Veteran | Strong consistency, leadership and advanced workload planning. |
| Legacy | Prestige, mentoring capacity, special invitations and Hall-of-Fame hooks. |

Fame can contribute slightly to experience, but it is not the sole determinant.

## Age-related modifiers

Age effects are small, gradual and capped before offsets:

| Modifier | Cap | Offsets |
| --- | ---: | --- |
| Recovery-speed reduction | 18% | Fitness, preparation, professional support, facilities. |
| Strain-risk increase | 14% | Fitness, preparation, professional support. |
| Consecutive workload tolerance reduction | 12% | Recovery planning, accommodation and support. |

Normal ageing does not create severe injuries, reduce song quality, remove skills or reduce maximum stats.

## Veteran advantages

Veteran benefits are earned through career history and modify consistency rather than raw musical ability:

| Advantage | Cap |
| --- | ---: |
| Performance consistency | 12% |
| Mistake severity reduction | 10% |
| Rehearsal efficiency | 10% |
| Recording consistency | 9% |
| Stress resilience | 8% |
| Mentoring efficiency | 14% |

A prepared veteran can outperform an inexperienced younger character because skill, preparation, wellness and experience remain more important than age.

## Career wear and resilience

Career wear stores lightweight aggregate totals for tour load, performance load, recording load, rehearsal load, travel load, burnout exposure, condition days and recovery days. Historical totals remain for records, while active impact improves through recovery periods and better routines.

Career resilience combines fitness, wellness, sleep, burnout, recovery discipline, professional support, lifestyle stability, experience and active wear into one of five states: fragile, recovering, stable, resilient and highly resilient.

## Career modes and role transitions

Career modes include full-time performer, selective touring, studio focused, festival focused, local performer, session musician, songwriter focused, mentor and educator, semi-retired and retired. Changing modes does not silently cancel commitments. Modes affect recommendations, opportunity fit and workload expectations.

Optional transitions include performer to songwriter, producer, manager, mentor, teacher, session musician or reduced-intensity band member. Player transitions require explicit consent.

## Retirement states

Retirement is voluntary and preserves skills, awards, history, finances, relationships, property and ownership where existing rules allow it. States are active, selective, semi-retired, retired from touring, retired from performance, fully retired and returning.

Before a retirement transition, the server provides a conflict preview covering contracts, bands, tours, recordings, employment, companies, gigs, finances and public announcement options. Retirement cannot be used to escape debts or contracts.

## Farewell and announcements

Announcement modes include private, band-only, friends-only, public, farewell tour, indefinite hiatus, temporary retirement and no comment. Farewell events are normal gigs or tours with contextual presentation; venue, ticketing, travel, wellness, finance and attendance rules still apply.

## Comeback lifecycle

Comeback types include one-off appearance, festival comeback, reunion gig, new release, short tour, full return and role transition. Readiness uses wellness, conditions, skill sharpness, resilience, fame, momentum, preparation, band availability, public interest and schedule capacity.

Readiness states are ready, ready with preparation, gradual return advised, significant preparation required and not ready for demanding return. Rewards are capped, require sufficient time away and are idempotent to prevent farming.

## Mentoring architecture

Mentoring builds on relationships, education, skills, scheduling, jobs, professional services and bands. Mentors must be established or later, have relevant skill and experience, avoid severe burnout and have no schedule conflict. Mentoring focuses include technique, songwriting, performance, production, business, touring, leadership and wellness routines.

Agreements support informal, paid, band-provided, company-sponsored, time-limited and long-term arrangements. Both parties must consent. Sessions validate attendance and relevance before rewards are applied.

Anti-abuse controls include no self-mentoring, pair caps, diminishing returns, idempotent completion, no rewards for no-shows, payment validation and related-party checks where available.

## Legacy progression

Legacy is a prestige layer based on contribution and history, not wealth alone. Inputs include mentoring, band leadership, milestones, awards, reliability, comebacks, company contribution, training others and community participation.

States are recognised, respected, influential, iconic and legendary. Legacy unlocks profile recognition, historical records, mentoring capacity, special invitations, veteran events, Hall-of-Fame eligibility hooks and cosmetics rather than large performance bonuses.

## NPC lifecycle and band succession

NPCs use scheduled or batched lifecycle processing. They can progress, reduce workload, semi-retire, retire, return for special events, mentor or move into teaching and management. NPCs should not unexpectedly retire before critical player events or receive invisible bonuses beyond player-accessible rules.

Band succession hooks support reduced roles, replacements, guest performers, successor mentoring, former-member association, anniversary appearances and reunion invitations. Player-character changes always require explicit action and existing permissions.

## Privacy

Private by default: exact age where privacy rules allow it, career-wear details, condition history, burnout exposure, recovery recommendations, retirement conflicts and comeback calculations.

Public only when approved: career stage, retirement status, comeback announcements, mentoring availability, legacy state and major milestones.

## Migration and idempotency

The migration is additive. Existing ages remain unchanged. Missing history receives neutral defaults. Lifecycle events, mentoring completions, comeback rewards, retirement announcements and stage milestones use idempotency keys to prevent duplicates.

## Future expansion hooks

Future PRs can add Hall of Fame ceremonies, award ceremonies, veteran festivals, autobiographies, documentaries, legacy bands, estates/inheritance, family careers, advanced management careers, producer/label careers and memorial systems only if later approved.
