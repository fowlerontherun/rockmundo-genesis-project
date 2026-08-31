# RockMundo Compendium

The player-facing wiki/bible is a standalone static microsite served from `/wiki/`.

It intentionally lives under `public/wiki` instead of the React game shell so it:

- does not appear in or inherit the normal RockMundo navigation;
- has its own typography, colour palette and wiki-style layout;
- can be linked directly from support, announcements or community posts;
- remains readable without requiring an authenticated game session.

## Files

- `index.html` — standalone shell and accessible structure.
- `wiki.css` — Compendium-only visual system.
- `wiki.js` — article catalogue, navigation, search and article rendering.

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

## Adding an article

Add an object to the `articles` array in `wiki.js` with:

- a stable `id` used by the URL hash;
- category, title, summary, level and search tags;
- one or more sections;
- optional related article IDs.

The sidebar, search index, table of contents and related-article cards are generated automatically.
