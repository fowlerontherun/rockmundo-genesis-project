# Wellness Accommodation and Travel Recovery

This PR extends the existing Wellness foundation rather than replacing it. The previous stack remains the source for core 0-100 wellness values, ailments, blocks, activity completion and performance modifiers. Accommodation and travel now feed bounded modifiers into that recovery model.

## Architecture

- `src/lib/wellnessRecovery.ts` is the shared server-compatible resolver for accommodation recovery, transport wellness, travel fatigue, tour-load state and read-only forecasts.
- `src/utils/tourOperations.ts` consumes the resolver when building Tour HQ summaries so tour planning shows recovery risks without mutating wellness.
- `wellness_recovery_events` is an idempotency ledger for overnight recovery, travel fatigue, rest days, jet lag and condition recovery events.
- `accommodation_recovery_profiles` and `transport_wellness_profiles` provide authoritative server-owned values. Clients may read summaries but must not submit recovery scores.

## Accommodation recovery model

Accommodation profiles include sleep, energy, fatigue, stress, strain and condition recovery modifiers plus privacy, noise, comfort, cleanliness, safety and capacity. Tiers are:

| Tier | Intended source | Effect |
| --- | --- | --- |
| none | venue floor, unbooked night, vehicle without sleep facilities | lower sleep, more fatigue/stress, slower recovery |
| basic | hostel, budget hotel, entry home | reliable baseline recovery |
| standard | normal hotel/apartment | good sleep and modest recovery |
| premium | luxury hotel, high-quality home | capped 10-20% overnight benefit |
| specialist | spa/wellness suite where supported | stronger but capped recovery; never instant cures |

Home recovery adds familiarity, stress reduction and small consistency benefits. Existing housing attributes can map into bed quality, privacy, noise, comfort, cleanliness, safety and neighbourhood stress. Upgrade hooks include better beds, soundproofing, kitchen, home gym, relaxation area and recovery room.

## Transport wellness

Vehicle tier and upgrades resolve to travel comfort, sleep capability, noise, vibration, personal space, climate control, seating quality, movement, recovery efficiency and privacy. Vans stay cheap but uncomfortable; tour buses trade cost for sleeping capability; planes are fast but can carry transfer/jet-lag stress; ferries and trains have extension hooks.

Upgrade bonuses are intentionally modest and capped. Sleeping bunks, premium mattresses, soundproofing, climate control, premium seating, private cabins and suspension improve forecasts but do not stack into perfect recovery.

## Travel fatigue and sleep during travel

Travel fatigue uses duration, distance, comfort, sleep capability, transfers, delays and time-zone delta. Effects include energy reduction, fatigue/stress increase, sleep-quality disruption, back-strain risk, condition recovery slowdown and arrival readiness. Each segment returns an idempotency key so completion jobs can apply it once.

Sleep during travel is partial. Bunks and high comfort increase sleep hours, but travel sleep normally remains below suitable accommodation recovery.

## Tour-load thresholds

Rolling tour load is derived from travel hours, distance, nights away, consecutive gigs, rest days, accommodation score, transport comfort, time-zone changes, strain and active conditions.

| State | Score |
| --- | --- |
| Comfortable | 0-24 |
| Active | 25-42 |
| Demanding | 43-62 |
| Exhausting | 63-82 |
| Unsustainable | 83-100 |

Rest days subtract workload, improve recovery forecasts and reduce jet-lag pressure. They have an opportunity cost through extra tour days and accommodation costs.

## Forecasting assumptions

Forecasts estimate energy, fatigue, stress, sleep quality, condition risk and gig readiness from current wellness, travel, accommodation and rest days. Forecasts are read-only and recalculated when itineraries change. They are labelled as estimates in the UI.

## Booking and permissions

The migration adds server-owned profile tables and a recovery-event ledger. Booking writes should continue to use existing authenticated booking, finance, band-role and availability paths. Validation must reject past dates, overlapping bookings, unavailable accommodation, insufficient funds, invalid cities and unauthorised shared band changes. Recovery applies only for occupied nights and one accommodation per character per overnight period.

## Logging

Processing jobs should log structured events for duplicate recovery prevention, missing accommodation, invalid bookings, travel fatigue processing, forecast calculation errors, tour-load threshold changes, shared-payment failures and invalid transport wellness data. Do not log unnecessary personal information.

## Future hooks

Future Wellness PRs can deepen hotel businesses, player-owned hotels, tour managers, personal chefs, wellness staff, advanced vehicle interiors, food/nutrition integration, recovery sponsorships, luxury lifestyle and seasonal/environmental travel effects.
