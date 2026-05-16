# Film & TV career expansion

## Current state (audited)

- `film_studios`, `film_productions` (catalog) and `player_film_contracts` exist with `box_office_gross` and `sequel_eligible` fields already on the contract.
- `FilmOffersPanel` shows pending film offers from `pr_media_offers` (media_type='film'). Accept-only — no negotiation, no sequel pipeline, no post-release performance breakdown.
- `tv_shows` / `tv_networks` exist but model **talk-show appearances** (host_name, time_slot, days_of_week) used by PR. No scripted-series acting concept exists at all.
- Hard cap of 2 films/year. Fame gate 25,000.

## What we'll build

A full acting-career layer covering both **films** (with sequel chances) and **scripted TV series** (multi-season, renewable/cancellable, per-episode pay), with a shared negotiation flow and a deep performance breakdown for each production.

### v1.1.317 — Negotiation + film sequels + film performance

**Schema**
- New table `film_negotiations` (offer_id, round, last_offer_cents, player_counter_cents, status: pending/accepted/rejected/expired, expires_at). Up to 3 counter rounds.
- Extend `pr_media_offers` with `role_type` (cameo/supporting/lead), `base_pay_cents`, `negotiation_id`, `parent_film_id` (for sequels).
- Extend `player_film_contracts` with `role_type`, `total_pay_cents`, `critic_score`, `audience_score`, `opening_weekend_cents`, `merch_revenue_cents`, `streaming_views`, `awards_won`, `is_sequel`, `parent_contract_id`, `released_at`, `performance_calculated_at`.
- New table `film_performance_weekly` (contract_id, week_number, box_office_week_cents, streaming_views, merch_units, merch_revenue_cents, screens, drop_pct). 12 weeks of post-release tracking per film.

**Edge functions**
- `negotiate-acting-offer` — handles counter-offer rounds. Higher fame = better counter acceptance odds. Lowballing risks the studio walking.
- `release-film` — fires when premiere_date hits via daily tick. Rolls opening weekend (function of fame × role × studio prestige × random), schedules 12 weeks of decay using existing economic-engine logarithmic clamps.
- `roll-film-sequel` — after week 6, if box-office / critic score crosses threshold, spawns a new `pr_media_offers` row with `parent_film_id` and bumped pay (typically +40–80%).

**UI**
- `FilmOffersPanel` gets a negotiate button → `AcceptingOfferDialog` with counter input, expected acceptance probability hint, role/duration/sequel-history info.
- New `MyFilmsPage` (under Media hub): cards for in-production / released / archived films with breakdown — opening weekend, total box office, critic & audience scores, merch revenue, streaming views, awards, and a 12-week revenue line chart.
- Sequel offers tagged with a "SEQUEL" badge and a quick link to the parent's breakdown.

### v1.1.318 — Scripted TV series (separate from talk shows)

**Schema** (new, doesn't touch `tv_shows` talk-show table)
- `scripted_series` (id, title, network_id, genre, premise, target_role_type, base_pay_per_episode_cents, episodes_per_season, premiere_date, min_fame_required, prestige_level).
- `series_seasons` (series_id, season_number, status: announced/filming/airing/wrapped/cancelled, episode_count, premiere_date, finale_date, avg_viewers, total_viewers, critic_score, audience_score, renewal_decision_at).
- `player_series_contracts` (user_id, series_id, season_id, role_name, role_type, pay_per_episode_cents, episode_count, total_pay_cents, status: pending/active/wrapped/dropped, joined_at, departed_at).
- `series_episodes` (season_id, episode_number, title, airdate, viewers_live, viewers_7day, social_buzz). Generated when season enters airing.
- `series_performance_weekly` (season_id, week_number, viewers, merch_revenue_cents, streaming_views, ad_revenue_cents).
- `series_renewal_offers` (series_id, prior_season_id, new_season_number, offered_pay_per_episode_cents, episodes, expires_at, status). Linked to the existing `negotiate-acting-offer` flow.

**Edge functions**
- `seed-scripted-series` — periodically (weekly cron) seeds a small pool of new series open to casting; tier-gated by fame.
- `generate-series-offer` — when a player is eligible, drops a `pr_media_offers` row with `media_type='series'` + role + episodes + per-episode pay; negotiation reuses `negotiate-acting-offer`.
- `air-series-episodes` — daily; rolls weekly viewers per episode (function of network reach × cast fame × prior-season hype × random), populates `series_episodes` + `series_performance_weekly`.
- `resolve-season-finale` — when last episode airs, computes season totals, rolls renewal vs cancellation using viewer-trend + critic score:
  - Renewed: spawns `series_renewal_offers` to every active cast member (often with a raise scaled to prior season's avg viewers).
  - Cancelled: marks season `cancelled`, posts inbox to cast, contract ends.
- `process-series-renewals` — accepts/rejects/negotiates the offer; rejection ends the player's run on that series (others can continue).

**UI**
- Extend Media hub with a "Acting" sub-section grouping film offers, series offers, current contracts, history.
- `MySeriesPage` per active series: season list, episode airing schedule, weekly viewer chart, season-to-date totals, merch revenue, renewal countdown, cast.
- Reuse `AcceptingOfferDialog` for series offers (label says "per episode"; shows total = pay × episodes).
- Inbox entries fire for: offer received, negotiation accepted/rejected, filming starts/ends, premiere airs, weekly performance digest, renewal/cancellation decisions.

### v1.1.319 — Cross-cutting polish

- Hub: `MediaHub` adds an "Acting Career" tile with badge for new offers/decisions.
- Activity blocking: filming days and series-shooting blocks reuse the universal activity blocking pattern (no gigs, no studio sessions during filming).
- Daily Summary inbox surfaces per-day acting earnings + this week's film/series performance bullet.
- Admin tools page: `ActingAdmin` to grant offers, force renewals, seed series.
- VersionHistory + version bumps at each step.

## Out of scope

- 3D/animated film cinematics, casting minigames, audition mechanics (just probability-based offers based on fame/skill).
- Touring with the cast, romance with co-stars (existing relationship engine already covers cross-NPC dating; not adding film-specific paths now).

## Open question
Want me to also build a **basic acting skill** (with its own XP track) that improves pay-offer and renewal odds? Or leave that to a future pass and gate purely on fame for now?
