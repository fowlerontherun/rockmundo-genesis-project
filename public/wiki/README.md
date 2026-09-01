# RockMundo Compendium

The player-facing wiki/bible is a standalone static microsite served from `/wiki/`.

It intentionally lives under `public/wiki` instead of the React game shell so it:

- does not appear in or inherit the normal RockMundo navigation;
- has its own typography, colour palette and wiki-style layout;
- can be linked directly from support, announcements or community posts;
- remains readable without requiring an authenticated game session.

## Files

- `index.html` — standalone shell, templates and accessible structure.
- `wiki.css` — Compendium-only visual system.
- `wiki.js` — short reference article catalogue, navigation, search and article rendering.
- `wiki-enhancements.css` — visual polish and responsive Compendium navigation.
- `wiki-directory.css` — goal/directory/deep-dive presentation.
- `wiki-directory.js` — goal directory integration, long-form search results, deep-dive links and specialist-guide integration.
- `guide.css` — styling shared by long-form editorial guides.
- `guides/*.html` — deeper walkthroughs for the main player journeys and systems.

## Starter guides

The first long-form guide set is:

1. `guides/getting-started.html` — establishing a character, schedule, skills, money and first goals.
2. `guides/song-to-release.html` — songwriting through development, recording, release, promotion and audience response.
3. `guides/first-gig.html` — booking, setlists, rehearsals, member readiness, stage preparation and show day.
4. `guides/bands-and-rehearsals.html` — recruitment, roles, repertoire, chemistry, agreements and group preparation.
5. `guides/releases-and-streaming.html` — release types, formats, streaming, sales, promotion and charts.
6. `guides/cities-and-travel.html` — cities, physical opportunities, travel, touring and schedule planning.

## Deep-dive guides

The second guide set explains larger systems in more depth:

1. `guides/skills-and-xp.html` — skill planning, XP, education, learning and specialisation.
2. `guides/recording-studios.html` — studio choice, performer readiness, role coverage, producers/engineers and payment source.
3. `guides/festivals.html` — festival identity, stages, lineup, tickets, sponsorship, operations and performer preparation.
4. `guides/tours.html` — routing, band travel, schedules, show preparation, economics and cancellation.
5. `guides/finances-and-banking.html` — personal, band and company money, accounts, transfers, payment sources and cashflow.
6. `guides/careers-and-jobs.html` — employment, education, specialist careers, offers and balancing work with music.
7. `guides/businesses.html` — company types, staffing, capacity, finance, growth and links to the wider music economy.

## Practical guides

The practical guide set covers systems players are likely to revisit regularly once the basic career loop is established:

1. `guides/early-performances.html` — busking, open mics, Battle of the Bands and choosing an early live route.
2. `guides/wellness-and-lifestyle.html` — condition, fatigue, recovery, schedule pressure and unexpected setbacks.
3. `guides/gear-and-stage-equipment.html` — personal gear, band production, loadouts, crew and touring logistics.
4. `guides/promotion-and-media.html` — self-promotion, PR, social activity, media offers and campaign timing.
5. `guides/merchandise.html` — production cost, stock, gig sales, margin, demand and tour planning.
6. `guides/charts-and-world-pulse.html` — combined/format/country charts, time periods, World Pulse and reading trends.
7. `guides/covers-rights-and-royalties.html` — repertoire covers, recording permission, co-writing splits and royalties.
8. `guides/education-and-teaching.html` — practice, lessons, formal education, mentors, teaching and band learning.

## Mechanics explainers

These guides explain important outcome systems in player language while deliberately stopping short of exploitable formulas:

1. `guides/what-affects-a-gig.html` — member execution, ensemble tightness, setlist/song performance, production, stage performance and audience response.
2. `guides/fame-and-fans.html` — fame, fans, local popularity, momentum, expectations and regional audience growth.
3. `guides/understanding-song-quality.html` — songwriting completion, potential, quality dimensions, consistency, polish, originality and the distinction between song and recording quality.

## Specialist guides

The specialist set covers deeper career, commercial and character-life systems that sit around the core music loop:

1. `guides/record-labels.html` — label rosters, artist contracts, advances, royalty terms, specialist staff and label management.
2. `guides/producer-career.html` — production skills, recording sessions, staff-producer work and building a production career.
3. `guides/sponsorships.html` — sponsorship types, offers, displayed benefits, brand fit and active contracts.
4. `guides/achievements-and-awards.html` — achievement progress, rarity/categories, awards, nominations, trophies and legacy.
5. `guides/relationships-and-social.html` — friendship, romance, rivalry, mentorship, interactions, privacy and shared history.
6. `guides/housing-and-property.html` — rentals, property ownership, recovery, wellness, creativity, housing market and personal finances.

There are now **30 long-form Compendium guides** across the starter, deep-dive, practical, mechanics and specialist sets.

The Compendium home page also provides a goal-based directory. `wiki-directory.js` adds the specialist group into that directory, makes the pages available to long-form search, adds a Specialist guides section to desktop/mobile browsing, and connects appropriate short reference articles to the relevant specialist deep dive.

## Editorial rule

The Compendium should help a player understand a system without turning hidden mechanics into an exploit guide.

Good content includes:

- player-facing rules, requirements and restrictions;
- visible costs and consequences;
- broad factors that improve or reduce an outcome;
- useful in-world strategy and preparation advice;
- explanations of how systems connect.

Do not publish:

- exact hidden coefficients or scoring weights;
- anti-abuse thresholds;
- complete random-event probability tables;
- NPC catch-up internals;
- a mathematically optimal grind loop derived from implementation details.

When balance changes, prefer updating the explanation of the mechanic rather than publishing values that will quickly become stale.

Implementation code can contain exact balance values. Those values are not automatically suitable for the Compendium. For example, housing currently has concrete tier values and relationship pages derive internal compatibility/stage scores; the player guide describes their direction and visible consequences rather than copying those equations into public documentation.

## Visuals and screenshots

Long-form guides can contain two types of visual:

### Game illustrations

Existing artwork under `public/hub-tiles` may be reused where it helps explain a system. It must be captioned as a **Game illustration** so players do not mistake stylised art for a screenshot of the live interface.

The current guide sets use artwork for systems such as skills, education, wellness, songwriting, rehearsal, recording, gigs, venues, stage equipment, releases, streaming, charts, cities, travel, festivals, sponsorships, touring, finances, employment, companies, labels, producers, achievements, relationships, housing, personal vehicles, social media, merchandise and World Pulse.

### Interface screenshots

Real interface screenshots should be added when representative production captures are available. A screenshot should:

- show the current player-facing UI rather than an admin, test or obsolete screen;
- avoid exposing private player data, tokens, internal IDs or developer tooling;
- be cropped around the feature being explained;
- include a useful caption describing what the player is looking at;
- be replaced when a major UI redesign makes it misleading;
- never be described as proof of an exact hidden formula.

Do not manufacture fake screenshots from concept art. Until a suitable capture exists, use clearly labelled game artwork or no image.

## Adding a reference article

Add an object to the `articles` array in `wiki.js` with:

- a stable `id` used by the URL hash;
- category, title, summary, level and search tags;
- one or more sections;
- optional related article IDs.

The sidebar, short-article search index, table of contents and related-article cards are generated automatically.

## Adding a long-form guide

Create an HTML page under `guides/` that loads both `../wiki.css` and `../guide.css`. Keep the standard Compendium header, breadcrumb, guide navigation, article structure and mechanics-disclosure language so the site feels consistent.

Long-form guides should answer a player journey or explain how a larger system fits together rather than duplicate the encyclopaedia. For example, “How do I prepare my first gig?” is a guide; “What is a setlist?” is better suited to a reference article.

Add discoverable long-form pages to the goal/directory system. Long-form search reads the guide directory rather than maintaining a separate duplicate search catalogue. If a short reference article has a genuinely useful longer counterpart, add a selective deep-dive mapping rather than attaching a generic guide to every article.

Mechanics explainers should describe the layers/factors a player can reasonably understand while explicitly avoiding implementation coefficients, random bounds, anti-abuse thresholds and deterministic optimisation advice.
