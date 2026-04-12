

# Plan: Full Genre Coverage for Radio + Host Avatars + NPC Foundation

## Problem Summary

**Genre gaps**: 13 genres have ZERO radio stations: Soul, Grunge, Gospel, Drum and Bass, House, Dubstep, Techno, Folk, Industrial, Ambient, Progressive Rock, Celtic, Funk. Several others (Bluegrass, Ska, Trance) have only 1 station each.

**No host avatars**: The `radio_shows` table has no `host_avatar_url` column. 34 unique hosts exist across 890 shows but none have images.

**No NPC link**: Hosts are just text names on shows with no NPC entity to support future quests.

## Plan

### 1. Add missing-genre radio stations via migration

Insert ~30-40 new radio stations ensuring every genre from the 52-genre list has at least 3-5 stations. Group them thematically:
- **Soul/Funk/Gospel** stations (e.g., "Soul City FM", "Funk Nation Radio", "Gospel Hour")
- **Electronic sub-genres** (House, Techno, Dubstep, Drum and Bass, Trance, Ambient, Industrial)
- **Rock sub-genres** (Grunge, Progressive Rock)
- **Folk/Celtic/Bluegrass/Ska** stations
- Each station gets appropriate city, quality level, listener base, and frequency

### 2. Create `radio_hosts` table

New table to store host NPCs with:
- `id`, `name`, `bio`, `avatar_url`, `personality_traits` (jsonb), `speciality_genres` (text[]), `city_id`, `is_active`, `created_at`

Add `host_id` column to `radio_shows` referencing `radio_hosts`, keeping `host_name` as fallback.

RLS: public read, admin write.

### 3. Seed radio hosts from existing show data

Deduplicate the 34 existing host names into `radio_hosts` records, then backfill `radio_shows.host_id`. Add ~15 new hosts for the new genre stations with distinct personalities (e.g., "Grunge Gary", "DJ Technika", "Celtic Claire").

### 4. Generate AI avatars for all hosts

Use the Lovable AI gateway (same style prompt as player avatars) to generate cartoon game-style portraits for each host. Script will:
- Use `google/gemini-2.5-flash-image` with a text-only prompt (no source photo -- pure generation)
- Same art style as player avatars: bold outlines, cel-shading, vibrant colors, game character look
- Each host gets a genre-appropriate outfit from the existing `GENRE_OUTFIT_MAP`
- Upload to Supabase storage bucket, update `radio_hosts.avatar_url`

This will be a batch script run via `code--exec` generating ~50 images.

### 5. Update UI to show host avatars

- `RadioStationDetail.tsx`: Show host avatar next to host name in the show schedule
- Join `radio_hosts` in the show query to get `avatar_url`

### 6. Version bump

Update to v1.1.168 with changelog entry.

## Technical Details

**New table schema:**
```sql
CREATE TABLE radio_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  personality_traits JSONB DEFAULT '{}',
  speciality_genres TEXT[] DEFAULT '{}',
  city_id UUID REFERENCES cities(id),
  catchphrase TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**New stations** will cover all 13 zero-coverage genres plus boost the 3 near-zero genres, spread across diverse cities globally.

**Avatar generation** will produce ~50 images using the same cartoon style prompt as player avatars but without a source photo (text-to-image generation).

