

## Radio Genres Expansion & Streaming Platform Restrictions Removal

### Problem

1. **Radio stations have inconsistent genres**: Many genres from `MUSIC_GENRES` are missing or use inconsistent casing/formatting (e.g., `hip_hop` vs `Hip Hop` vs `hip-hop`, `r_and_b` vs `R&B` vs `r&b`). Key genres like `Punk Rock`, `Blues`, `Jazz`, `Boom Bap`, `Trap`, `Drill`, `Conscious Rap`, `Gangsta Rap`, `Cloud Rap`, `Mumble Rap`, `Phonk`, `Emo Rap`, `Jazz Rap`, `Grime`, `Crunk`, `Hyperpop`, `Metalcore/Djent`, `Modern Rock` have little or no radio coverage.

2. **Streaming platforms block songs by quality**: Apple Music requires 500+, Amazon Music 300+, Deezer 400+, and Tidal 1200+ quality score. This prevents players from distributing songs freely.

### Plan

#### 1. Normalize existing radio station genres (SQL data update)
Update all radio stations to use the exact genre names from `MUSIC_GENRES`:
- `hip_hop` / `hip-hop` / `hip hop` → `Hip Hop`
- `r_and_b` / `r&b` → `R&B`
- `pop` → `Pop`, `rock` → `Rock`, `country` → `Country`, etc.
- `electronic` / `dance` → `EDM` + `Electronica`
- `indie` → `Indie/Bedroom Pop`
- `metal` → `Heavy Metal`
- `punk` → `Punk Rock`
- `jazz` → `Jazz`
- `blues` → `Blues`
- `folk` → `Country` (closest match)
- `soul` / `funk` → `R&B` + `Alt R&B/Neo-Soul`
- `trap` → `Trap`
- `grime` → `Grime`
- `world` → `World Music`
- `latin` / `reggaeton` / `salsa` → `Latin`
- `reggae` / `dancehall` → `Reggae`
- `afrobeat` / `afrobeats` → `Afrobeats/Amapiano`

#### 2. Add missing genres to existing stations (SQL data update)
Expand `accepted_genres` arrays on existing stations to include more genres from the skill list, particularly underrepresented ones:
- Add `Boom Bap`, `Conscious Rap`, `Gangsta Rap`, `Trap`, `Drill`, `Cloud Rap`, `Emo Rap`, `Jazz Rap`, `Phonk`, `Mumble Rap`, `Crunk` to Hip Hop-accepting stations
- Add `Punk Rock`, `Modern Rock`, `Metalcore/Djent` to Rock/Metal stations
- Add `Hyperpop`, `K-Pop/J-Pop` to Pop/EDM stations
- Add `Synthwave`, `Lo-Fi Hip Hop` to electronic stations
- Add `Flamenco`, `African Music` to World Music stations

#### 3. Remove streaming platform quality restrictions (SQL data update)
Set `min_quality_requirement = 0` on all streaming platforms so any song can be distributed anywhere.

#### 4. Remove client-side quality check (code change)
In `src/components/streaming/ReleaseSongTab.tsx`, remove the quality gate logic (lines 69-77) that blocks releases and the quality badge UI that shows "Min Quality" warnings.

#### 5. Version bump
Update `VersionHeader.tsx` and `VersionHistory.tsx` to v1.0.888.

### Files to modify
- `src/components/streaming/ReleaseSongTab.tsx` — remove quality check logic and UI
- `src/pages/admin/StreamingPlatforms.tsx` — remove min quality display (optional cleanup)
- `src/components/VersionHeader.tsx` — version bump
- `src/pages/VersionHistory.tsx` — changelog

### Database changes (data updates only, no schema changes)
- UPDATE `streaming_platforms` SET `min_quality_requirement = 0`
- UPDATE `radio_stations` to normalize genre names and expand accepted_genres arrays

