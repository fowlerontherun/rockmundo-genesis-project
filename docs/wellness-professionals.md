# Wellness Professionals, Support Staff and Care Plans

## Previous Wellness expansion context

The Wellness foundation already centralised character vitals, activity balance, ailments, travel recovery and server-owned activity completion. Food, hydration, accommodation and travel recovery added bounded preparation and recovery hooks for gigs, studio work and touring. This PR adds the next layer: qualified professionals who can sell services, work as company staff and create advisory care plans without replacing the existing schedule, finance, employment or wellness systems.

## Professional-role architecture

`src/lib/wellnessProfessionals.ts` is the shared server/client configuration source for initial roles, service definitions, balance caps and deterministic validation helpers. API handlers and edge functions should import or mirror this module rather than duplicating role logic in UI code.

Initial roles:

| Role | Focus | Remote | Contracts | Compatible employers |
| --- | --- | --- | --- | --- |
| Personal Trainer | Fitness, stage stamina, fatigue management, injury prevention | No | Yes | Gyms, wellness centres, tour companies, management companies, bands |
| Physiotherapist | Fictional performance-care for strain, rehab plans and return-to-performance readiness | No | Yes | Clinics, wellness centres, tour companies, large venues, bands |
| Therapist | Game-focused stress, motivation, burnout and band-pressure support | Yes | Yes | Clinics, wellness centres, management companies, hotels, bands |
| Nutritionist | Meal plans, hydration, tour catering and recovery food | Yes | Yes | Wellness centres, hotels, tour companies, management companies, bands |
| Vocal Coach | Vocal readiness, warm-ups, strain prevention and singing consistency | Yes | Yes | Recording studios, tour companies, management companies, venues, bands |
| Massage Therapist | Short-term fatigue and compatible muscular strain recovery | No | No | Wellness centres, hotels, venues, tour companies |
| Wellness Coach | Early-career generalist routines, sleep, stress and recovery planning | Yes | Yes | Wellness centres, gyms, hotels, management companies, bands |

All role text is fictional and game-focused. The system must not claim to diagnose or substitute for real-world healthcare.

## Qualification matrix

Players do not manually claim qualifications. `deriveQualificationTier` derives a tier from role minimum skills, relevant-skill average, completed services, professional reputation and reliability. NPC providers may receive server-assigned tiers during seeding.

| Tier | Skill average | Completed services | Reputation | Reliability |
| --- | ---: | ---: | ---: | ---: |
| Trainee | 15 | 0 | 0 | 50 |
| Qualified | 35 | 8 | 20 | 70 |
| Experienced | 55 | 35 | 45 | 78 |
| Expert | 72 | 100 | 70 | 86 |
| Elite | 88 | 250 | 90 | 94 |

Restricted services such as therapy, physiotherapy treatment and vocal coaching require at least Qualified. Price bounds are configured per role and validated server-side.

## NPC versus real-player comparison

NPC providers provide baseline coverage in every supported city, predictable prices and standardised quality. They should fill gaps in low-population cities and should not dominate top-end outcomes by default.

Real-player providers can exceed NPC quality only through skill, qualification, reliability, attendance, preparation, reputation and completed legitimate work. The real-player advantage cap is intentionally modest: normally no more than 10-20% better than a comparable standard NPC at the same tier. Low-skilled or unreliable player providers perform similarly to NPC baselines or worse.

## Service and outcome table

| Service | Primary roles | Duration | Effects | Important caps |
| --- | --- | ---: | --- | --- |
| Personal Training Session | Trainer, Wellness Coach | 60m | Fitness, stage stamina, stress reduction, small immediate fatigue | Cannot erase physical risk; fatigue can rise |
| Physiotherapy Assessment | Physiotherapist | 45m | Assessment quality, recovery-plan quality, lower worsening risk | Qualified minimum |
| Physiotherapy Treatment | Physiotherapist | 60m | Compatible strain and physical recovery | Severe conditions capped per appointment |
| Therapy Session | Therapist | 60m | Stress, motivation, burnout risk, happiness | Fictional coping support only |
| Nutrition Consultation | Nutritionist, Wellness Coach | 45m | Meal-plan effectiveness, nutrition, hydration support | Plan adherence gives modest gains |
| Vocal Coaching Session | Vocal Coach | 45m | Vocal readiness, vocal strain prevention, technique support | Qualified minimum |
| Massage Session | Massage Therapist | 60m | Fatigue, compatible muscular strain, short-term recovery | Does not replace injury treatment |
| Wellness Review | Generalists and specialists | 45m | Risk review, recommendations and advisory care plan | Advisory, not direct stat setting |

`calculateServiceOutcome` considers provider kind, role, qualification, skill average, provider wellness, fatigue, reliability, compatibility, duration, location quality, plan adherence, familiarity and bounded randomness. Outcomes are capped and severe conditions cannot be instantly cured.

## Appointment lifecycle

1. Client searches provider listings or NPC availability.
2. Server validates service, role, qualification, price bounds and progression unlocks.
3. Scheduler checks both client and provider availability, including travel, gigs, rehearsals, recording, work and existing appointments.
4. Finance system reserves or charges payment with gross price, fees, provider/company revenue and refund liabilities.
5. Appointment is booked with provider, client, service, date, duration, location/remote status, cost, cancellation terms and attendance requirements.
6. Scheduled completion confirms attendance, valid location or remote session and payment state.
7. Outcomes, professional XP, service history, relationship familiarity and reliability changes are applied once.
8. Reviews unlock only for attended completed appointments.

Cancellation states are early cancellation, late cancellation, client no-show, provider no-show, completed, partially completed, refunded and disputed. Refund rates are configured and must use existing transaction ledgers.

## Contract model

Support contracts are optional recurring care arrangements. They define provider, client or band, service package, frequency, duration, price, included appointments, cancellation terms, renewal rules, missed-appointment rules and expected support effects. Contract cycles must create appointments once and payments once. Contracts improve consistency and planning but never guarantee perfect outcomes.

Band contracts require band permissions and band finance authority. Benefits apply only to attending members and must avoid duplicate individual and group rewards.

## Company employment and job advertising flow

Compatible businesses can employ NPC or real-player wellness staff where the company type supports the role. Employers should extend existing job listings with role, required qualification, minimum skills, location, weekly hours or appointment capacity, salary or revenue share, duration, responsibilities, required availability, remote eligibility, benefits and deadline.

Real-player employees improve service availability, business quality, customer outcomes, reputation, capacity, tour support and staff/band support only when skilled, scheduled, active, paid, available and performing relevant work. NPC staff provide reliable baseline capacity with lower top-end contribution.

## Weekly company cost and revenue impact

Wellness staff must flow through the existing weekly finance model:

- Weekly salary and commissions are staff costs.
- Completed appointments create appointment revenue.
- Facility, equipment and training costs remain company operating costs where supported.
- Missed capacity and inactive staff reduce utilisation.
- Quality and reputation contribution comes from real completed work, not merely occupying a staff slot.

Financial updates must be auditable and idempotent. No client or provider may submit arbitrary balance changes.

## Professional XP and reputation rules

Professional XP depends on service duration, difficulty, outcome quality, eligible payment, attendance and feedback. Refunded appointments grant no XP. Daily and weekly caps prevent grinding. Repeated low-value sessions between the same pair use diminishing returns after the configured threshold.

Professional reputation is separate from fame where possible. It considers completed appointments, reliability, ratings, outcome consistency, qualification, contract completion, cancellations, disputes and verified experience. Suggested states are New, Developing, Trusted, Respected, Leading and Elite.

## Reviews

Reviews require one completed, attended appointment. Cancelled, refunded-only or no-show appointments cannot be reviewed. Duplicate reviews are rejected through a unique appointment constraint. Aggregates should be weighted so simple manipulation has limited impact, and review moderation flags should be visible to admin tools.

## Anti-abuse protections

Required controls:

- Same-character self-booking prohibition.
- Related-party and circular-payment fraud flags.
- Diminishing XP for repeated provider/client pairs.
- Daily and weekly XP caps.
- Minimum service duration and eligible payment checks.
- No XP from refunded services.
- Attendance verification before completion, XP and reviews.
- Server-computed outcomes only.
- Price bounds and qualification validation.
- One review per completed appointment.
- Bounded familiarity bonuses.
- Audit logs for booking failures, conflicts, no-shows, refunds, XP, fraud flags and moderation flags.

Legitimate long-term client relationships should remain possible; diminishing returns are preferred over total prohibition when risk is moderate.

## Database and migration plan

A production migration should extend existing jobs, company staff, finance, schedule and wellness structures where possible. The recommended table set is:

- `wellness_provider_profiles` for role, qualification snapshot, XP, reliability and reputation.
- `wellness_provider_listings` for services, prices, cities, remote eligibility and pause state.
- `wellness_appointments` for scheduler-linked one-off sessions and lifecycle state.
- `wellness_support_contracts` for recurring client, band or tour support.
- `wellness_care_plans` and `wellness_plan_adherence` for advisory recommendations and lightweight adherence.
- `wellness_professional_reviews` for one review per completed appointment.
- `wellness_professional_audit_events` for fraud, disputes, no-shows and idempotency evidence.
- Add wellness role metadata to existing `jobs` and `company_employees` rather than creating a separate employment framework.

Migrations must be non-destructive. Existing staff, jobs and wellness activities remain valid. NPC provider defaults should seed safely and missing provider data should degrade to NPC baseline availability.

## Gig, tour and care-plan integration

Gig preparation can surface active care plans, upcoming appointments, provider recommendations, warm-up plans and recovery appointments. Suggested actions should book normal services such as vocal coaching, massage, physiotherapy, nutrition review, trainer warm-up or therapist support through normal scheduling and payment rules.

Tour support can include travelling physiotherapists, trainers, vocal coaches, nutrition consultants, wellness coaches and on-call local providers. Capacity must consider tour length, number of performers, travel, accommodation, transport and provider schedule. One professional cannot serve unlimited simultaneous tours.

Care plans are advisory and may recommend rest, exercises, meals, hydration, strain limits, pre-gig routines and tour recovery. Plans must not directly set wellness values. Adherence modestly improves plan effectiveness.

## API and security notes

All writes require authentication. Only qualified players may advertise restricted services. Players cannot book themselves. Clients cannot submit outcomes. Providers cannot mark arbitrary services successful. Completion uses scheduler evidence. Band and company actions require existing permissions. Private wellness information remains private. Admin actions require RBAC.

## Balance caps and production limits

- Real-player advantage cap: 18% in shared balance.
- Familiarity cap: 6%.
- Severe condition max recovery per appointment: 12 points.
- Daily professional XP cap: 90.
- Weekly professional XP cap: 320.
- Repeated-pair XP diminishing starts after three completed sessions per week.
- One appointment never removes a severe condition.
- Long-term plans improve consistency rather than granting large instant bonuses.

## Future expansion hooks

Future PRs can add medical clinics, advanced certifications, group classes, player-owned wellness companies, insurance, sponsorships, branded fitness programmes, advanced tour medical support, emergency treatment and long-term coaching careers. Emergency medicine, surgery, prescriptions, severe mental-health crisis simulation, addiction treatment, unlicensed medical claims and unlimited passive staff bonuses remain out of scope.
