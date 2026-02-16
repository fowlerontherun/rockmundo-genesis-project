
# v1.0.737 -- Seed TV Shows for All Countries

## Overview

Currently there are 77 TV networks across 15+ countries but only 36 TV shows, almost all in the UK (25) and US (10), plus 1 in Japan. Countries like Australia, Brazil, Canada, France, Germany, Ireland, Italy, Netherlands, Norway, South Korea, Spain, and Sweden have networks but zero shows. Global streaming networks also have no shows.

This update will seed 150+ TV shows across all existing networks so every country has a full lineup.

---

## What Gets Added

Shows will be seeded for every network that currently has zero shows, using realistic show names and hosts appropriate to each country:

- **Australia** (4 networks): Morning shows, talk shows, music specials (e.g., "Sunrise" on Channel 7, "Rage" on ABC Australia)
- **Brazil** (2 networks): Variety and talk shows (e.g., "Fantástico" on TV Globo, "Programa do Ratinho" on SBT)
- **Canada** (2 networks): Morning shows, talk shows (e.g., "The Social" on CTV, "Q with Tom Power" on CBC)
- **France** (5 networks): Talk shows, entertainment (e.g., "Quotidien" on Canal+, "Taratata" on France 2)
- **Germany** (5 networks): Entertainment, talk shows (e.g., "Wetten, dass..?" on ZDF, "TV total" on ProSieben)
- **Ireland** (1 network): Talk show, entertainment (e.g., "The Late Late Show" on RTE)
- **Italy** (4 networks): Entertainment, variety (e.g., "Che Tempo Che Fa" on Rai Uno, "Amici" on Canale 5)
- **Japan** (2 more networks): Music shows (e.g., "Kohaku Uta Gassen" on NHK, "Hey! Hey! Hey!" on Fuji TV)
- **Netherlands** (1 network): Talk show, entertainment
- **Norway** (1 network): Talk show, entertainment
- **South Korea** (2 networks): Music shows, entertainment (e.g., "Music Bank" on KBS, "Show! Music Core" on MBC)
- **Spain** (4 networks): Entertainment, talk shows (e.g., "El Hormiguero" on Antena 3, "La Resistencia" on TVE)
- **Sweden** (2 networks): Talk shows, music specials
- **Global streaming** (5 networks): Music specials, entertainment (e.g., "Tiny Desk Concert" on Netflix UK)
- **Additional UK networks** with zero shows (e.g., ITV4, More4, Film4, Drama, etc.)

Each show includes: show_name, show_type, host_name, time_slot, viewer_reach, fame/fan/compensation boosts, min_fame_required, description, and days_of_week.

---

## Technical Details

### Valid constraints:
- `show_type`: talk_show, morning_show, late_night, music_special, variety, news, entertainment
- `time_slot`: morning, afternoon, prime_time, late_night

### Database changes:
- Single INSERT migration joining against existing `tv_networks` by ID
- ~150 new TV show rows across all networks
- Version bump to v1.0.737 in `VersionHeader.tsx`, `navigation.tsx`, and `VersionHistory.tsx`

### Files to modify:
1. **New SQL migration** -- Seed TV shows for all countries
2. **`src/components/VersionHeader.tsx`** -- Version bump
3. **`src/components/ui/navigation.tsx`** -- Version bump
4. **`src/pages/VersionHistory.tsx`** -- Add changelog entry

### Note on duplicate networks:
Some countries have duplicate network entries (e.g., two "France 2", two "ProSieben", two "NHK"). Shows will be assigned to one of each to avoid duplicates.
