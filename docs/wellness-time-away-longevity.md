# Wellness Time Away and Career Longevity

This expansion adds a server-authoritative time-away layer for holidays, retreats, career breaks, sabbaticals and long-term workload management. It builds on the existing Wellness foundation, lifestyle routines, accommodation/travel recovery, scheduler, finance ledger patterns, band commitments and progression tiers rather than creating a second travel or leave framework.

## Architecture

- `time_away_type_config` centralises durations, costs, eligible activities, restricted activities, recovery effects, career-momentum effects, cancellation policy, cooldowns, notice, band approval and employment-leave flags.
- `time_away_bookings` stores the player booking, recovery focus, budget, privacy, public communication setting, forecast and idempotency key.
- `time_away_itinerary_items` links optional recovery activities to scheduler entries; itinerary items schedule activities and never grant direct duplicate rewards.
- `time_away_companion_invitations` requires companion consent and preserves companion privacy.
- `time_away_band_approvals` records operational conflicts and approval decisions without automatically cancelling confirmed band commitments.
- `career_momentum_summaries` separates short-term buzz from permanent fame, skills and achievements.
- `career_sustainability_summaries` stores compact 30/90/365 day aggregate workload windows.
- `time_away_processing_records` is the idempotency ledger for daily recovery, travel, accommodation, payments, refunds, companions, band-retreat benefits, career-break transitions, momentum changes and return bonuses.

## Supported break types

Initial types are Rest Day, Staycation, City Break, Standard Holiday, Wellness Retreat, Creative Retreat, Fitness Retreat, Band Retreat, Career Break and Sabbatical. Rest days and staycations are available to new artists. Standard holidays and band retreats unlock for active musicians. Wellness, creative and fitness retreats plus career breaks unlock for professional artists. Sabbaticals unlock for superstars.

## Forecasting and trade-offs

Forecasts are calculated server-side by `forecast_time_away` and mirrored in the shared TypeScript balance model for UI previews. Forecasts include estimated cost, wellness changes, burnout-risk change, career-momentum impact, band/employment requirements and the permanent-fame protection flag. Players cannot submit recovery outcomes from the client.

Short breaks have little career-momentum impact. Long career breaks and sabbaticals gradually reduce momentum and fan engagement but do not erase permanent fame, skills, achievements, debts, contracts or disciplinary history. Return activity can recover momentum.

## Recovery focus and itineraries

Players choose one primary focus: complete rest, burnout recovery, sleep reset, physical recovery, mental recovery, relationship time, fitness, creative reset, social enjoyment or balanced recovery. The focus changes activity recommendations and weighting, but caps prevent extreme single-stat bonuses.

Itinerary modes are fully manual, recommended, assisted and managed retreat. Automation must respect budget, availability, scheduler conflicts, real services, package inclusion and duplicate-reward protection. Skipped activities should explain why they were skipped.

## Destination and accommodation effects

The system uses existing city, travel and accommodation data where available. Home recovery is low cost and supports routine stability. Hotels and retreat facilities can modestly improve sleep, privacy and convenience. Premium accommodation never instantly cures burnout, injuries or severe conditions.

## Band, work and company responsibilities

Bookings identify schedule, band and work conflicts before confirmation. Conflicting band commitments require approval or rescheduling according to existing role permissions; ordinary members cannot approve their own conflicting leave. Company-owner absence can be delegated or automated where existing company systems support it, but businesses are not frozen simply because an owner is away.

## Career sustainability and return readiness

Career sustainability is derived from aggregate workload and recovery windows: gigs, tour days, travel hours, recording, rehearsal, practice, rest days, holidays, condition days, burnout days, average sleep and recovery quality. Missing history receives safe defaults.

Return readiness considers wellness, burnout, fatigue, sleep, motivation, lifestyle stability, time away and the first planned activity. States are fully ready, ready with limits, gradual return recommended, more recovery recommended and not ready for demanding activity. Severe restrictions are enforced for incompatible demanding returns.

## Privacy, finance and anti-abuse

Private data includes burnout severity, therapy, detailed conditions, recovery plan details, private companions and professional support. Public announcements expose only approved summary fields.

Costs can include travel, accommodation, meals, activities, professional support, cancellation fees, lost wages, lost gig income and delegation costs. Payments and refunds use idempotency keys and are applied once.

Anti-abuse controls include cooldowns, duration limits, rolling-window diminishing returns, attendance checks, companion consent, server-calculated effects, idempotency records and capped comeback effects.

## Future hooks

Planned follow-ups can add advanced ageing, retirement and legacy careers, family commitments, seasonal tourism, player-owned resorts, destination events, sponsor-funded retreats, documentaries, comeback tours, career reinvention and veteran mentoring.
