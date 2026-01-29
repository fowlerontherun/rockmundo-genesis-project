

# Massive Gear Seed & Brand System
**Version: 1.0.576**

## Overview
This update will massively expand the gear catalog to match all instrument skills in the game, add brand/manufacturer support with optional logos, and introduce color variants for visual diversity.

---

## Database Schema Changes

### 1. Add New Columns to `equipment_items`

```sql
ALTER TABLE equipment_items 
ADD COLUMN brand text,
ADD COLUMN brand_logo_url text,
ADD COLUMN color_options jsonb DEFAULT '[]'::jsonb,
ADD COLUMN skill_boost_slug text;
```

| Column | Type | Purpose |
|--------|------|---------|
| `brand` | text | Manufacturer name (e.g., "Fender", "Gibson", "Roland") |
| `brand_logo_url` | text | URL to brand logo image (optional) |
| `color_options` | jsonb | Array of available colors (e.g., `["Sunburst", "Jet Black", "Arctic White"]`) |
| `skill_boost_slug` | text | Links to skill_definitions for stat boosts |

---

## Brand Catalog (Real-World Inspired)

### Guitars & Strings
| Brand | Style | Price Tier |
|-------|-------|------------|
| Fender | American classic, versatile | Epic/Legendary |
| Gibson | Rock heritage, warm tones | Rare/Epic |
| PRS (Paul Reed Smith) | Premium boutique | Epic/Legendary |
| Ibanez | Shred, metal, versatile | Uncommon/Rare |
| Martin | Acoustic excellence | Rare/Epic |
| Taylor | Modern acoustic | Rare/Epic |
| Epiphone | Gibson budget line | Common/Uncommon |
| Squier | Fender budget line | Common/Uncommon |
| Jackson | Metal specialist | Rare |
| ESP/LTD | Metal & rock | Rare/Epic |
| Gretsch | Rockabilly, hollow body | Rare/Epic |
| Rickenbacker | Jangly, British invasion | Epic |
| Music Man | Premium, active electronics | Epic |
| Yamaha | Reliable all-rounder | Common/Uncommon |
| Schecter | Modern metal | Uncommon/Rare |

### Bass
| Brand | Style |
|-------|-------|
| Fender | P-Bass, J-Bass classics |
| Music Man | StingRay, active tone |
| Warwick | German precision |
| Rickenbacker | Progressive rock |
| Ibanez | Fast necks, modern |

### Keyboards & Pianos
| Brand | Style |
|-------|-------|
| Nord | Red stage keyboards |
| Roland | Versatile, reliable |
| Korg | Synths & workstations |
| Yamaha | Pianos & stage keyboards |
| Moog | Analog synth legend |
| Sequential | Prophet synths |
| Arturia | Hybrid analog/digital |

### Drums & Percussion
| Brand | Style |
|-------|-------|
| DW (Drum Workshop) | Premium American |
| Pearl | Japanese precision |
| Tama | Starclassic excellence |
| Ludwig | Classic American |
| Gretsch | Jazz heritage |
| Zildjian | Cymbal masters |
| Sabian | Canadian cymbals |
| Meinl | Percussion specialist |
| Roland | Electronic drums |

### Microphones
| Brand | Style |
|-------|-------|
| Shure | Industry standard |
| Neumann | Studio legend |
| Sennheiser | German engineering |
| AKG | Austrian quality |
| Audio-Technica | Value champions |
| Rode | Australian innovation |

### Audio Equipment
| Brand | Style |
|-------|-------|
| Focusrite | Scarlett interfaces |
| Universal Audio | Premium converters |
| PreSonus | Studio solutions |
| Behringer | Budget gear |
| Mackie | Mixers & monitors |

---

## Color Variants by Instrument Type

### Guitars
- **Solid Colors**: Jet Black, Arctic White, Candy Apple Red, Lake Placid Blue, Surf Green, Vintage Sunburst, Olympic White
- **Wood Finishes**: Natural, Tobacco Sunburst, Cherry Burst, Honeyburst
- **Special**: Gold Top, Silverburst, Seafoam Green, Shell Pink

### Basses
- Black, White, Sunburst, Natural, Vintage White, Lake Placid Blue

### Keyboards/Synths
- Black, White, Red (Nord), Wood panels

### Drums
- Black, White, Red, Blue, Natural Maple, Cherry, Champagne Sparkle, Black Galaxy

---

## Seeded Instruments (Matching Skills)

### Electric Guitars (~20 items)
| Item | Brand | Rarity | Price | Colors |
|------|-------|--------|-------|--------|
| Squier Affinity Stratocaster | Squier | Common | $250 | Black, White, Sunburst |
| Epiphone Les Paul Standard | Epiphone | Uncommon | $450 | Cherry, Ebony |
| Fender Player Stratocaster | Fender | Rare | $850 | Sunburst, Black, White, Blue |
| Gibson SG Standard | Gibson | Rare | $1,600 | Cherry, Ebony |
| PRS SE Custom 24 | PRS | Rare | $900 | Charcoal Burst, Blue |
| Ibanez RG550 | Ibanez | Rare | $1,000 | Road Flare Red, Desert Sun Yellow |
| Fender American Professional II | Fender | Epic | $1,800 | Sunburst, Miami Blue, Dark Night |
| Gibson Les Paul Standard | Gibson | Epic | $2,700 | Honeyburst, Ebony, Gold Top |
| PRS Custom 24 | PRS | Epic | $4,200 | 10-Top Quilt finishes |
| Gibson Custom Shop 1959 Les Paul | Gibson | Legendary | $6,500 | Aged Cherry Sunburst |
| Fender Custom Shop Stratocaster | Fender | Legendary | $5,500 | Relic finishes |

### Acoustic Guitars (~10 items)
| Item | Brand | Rarity | Price |
|------|-------|--------|-------|
| Yamaha FG800 | Yamaha | Common | $200 |
| Fender CD-60S | Fender | Common | $230 |
| Taylor 110e | Taylor | Uncommon | $800 |
| Martin D-15M | Martin | Rare | $1,400 |
| Taylor 314ce | Taylor | Rare | $1,900 |
| Martin D-28 | Martin | Epic | $3,300 |
| Gibson J-45 Standard | Gibson | Epic | $2,700 |
| Martin D-45 | Martin | Legendary | $10,000 |

### Bass Guitars (~10 items)
| Item | Brand | Rarity | Price |
|------|-------|--------|-------|
| Squier Affinity P-Bass | Squier | Common | $250 |
| Fender Player Jazz Bass | Fender | Rare | $900 |
| Music Man StingRay Special | Music Man | Epic | $2,400 |
| Fender American Ultra Jazz Bass | Fender | Epic | $2,200 |
| Warwick Thumb NT | Warwick | Legendary | $5,000 |

### Keyboards & Synths (~15 items)
| Item | Brand | Rarity | Price |
|------|-------|--------|-------|
| Casio CT-S300 | Casio | Common | $150 |
| Yamaha PSR-E373 | Yamaha | Common | $200 |
| Roland Juno-DS61 | Roland | Uncommon | $700 |
| Korg Minilogue XD | Korg | Rare | $650 |
| Nord Electro 6D | Nord | Epic | $2,800 |
| Moog Subsequent 37 | Moog | Epic | $1,800 |
| Nord Stage 4 | Nord | Legendary | $5,500 |
| Moog One | Moog | Legendary | $9,000 |

### Drums & Percussion (~15 items)
| Item | Brand | Rarity | Price |
|------|-------|--------|-------|
| Pearl Export EXX | Pearl | Common | $800 |
| Tama Imperialstar | Tama | Uncommon | $1,000 |
| Gretsch Catalina Maple | Gretsch | Rare | $1,200 |
| DW Performance Series | DW | Epic | $3,500 |
| Ludwig Classic Maple | Ludwig | Epic | $3,000 |
| DW Collector's Series | DW | Legendary | $6,000 |
| Roland TD-27KV | Roland | Rare | $3,500 |
| Roland TD-50KV2 | Roland | Epic | $8,000 |

### Wind Instruments (~15 items)
| Item | Brand | Rarity | Price |
|------|-------|--------|-------|
| Yamaha YAS-280 Alto Sax | Yamaha | Common | $1,400 |
| Yamaha YTR-2330 Trumpet | Yamaha | Common | $600 |
| Selmer Paris Reference 54 Alto | Selmer | Epic | $8,000 |
| Bach Stradivarius 180S37 | Bach | Epic | $4,500 |
| Yamaha YFL-222 Flute | Yamaha | Common | $700 |
| Buffet Crampon R13 Clarinet | Buffet | Epic | $4,000 |

### DJ & Electronic (~10 items)
| Item | Brand | Rarity | Price |
|------|-------|--------|-------|
| Numark Mixtrack Pro FX | Numark | Common | $350 |
| Pioneer DDJ-400 | Pioneer DJ | Uncommon | $300 |
| Pioneer DDJ-1000 | Pioneer DJ | Rare | $1,200 |
| Technics SL-1200MK7 | Technics | Epic | $1,100 |
| Pioneer CDJ-3000 | Pioneer DJ | Legendary | $2,400 |

### Microphones (~8 items - expand existing)
| Item | Brand | Rarity | Price |
|------|-------|--------|-------|
| Audio-Technica AT2020 | Audio-Technica | Uncommon | $100 |
| Rode NT1-A | Rode | Rare | $230 |
| AKG C414 XLII | AKG | Epic | $1,100 |

---

## Brand Logos (Technical Approach)

### Option A: Store URLs (Recommended)
Use the `brand_logo_url` column to store URLs to brand logos. These could be:
1. **Public CDN URLs** - Link to official brand assets (licensing concerns)
2. **Supabase Storage** - Upload approved logos to your own bucket
3. **Placeholder icons** - Use generic instrument icons per category

### Option B: Icon-Based System
Instead of real logos, use a `brand_icon` field that maps to Lucide icons:
```typescript
const brandIcons = {
  "Fender": "guitar",
  "Roland": "piano",
  "DW": "drum",
  // etc.
}
```

**Recommendation**: Start with Option B (icons) to avoid trademark issues, then optionally add actual brand logos later via Supabase Storage with proper licensing.

---

## Implementation Summary

| File | Changes |
|------|---------|
| `supabase/migrations/[new].sql` | Add columns + seed ~120 items |
| `src/types/gear.ts` | Add brand, color types |
| `src/pages/admin/GearItemsAdmin.tsx` | Add brand/color form fields |
| `src/components/gear/GearCard.tsx` | Display brand + color options |
| `src/components/VersionHeader.tsx` | Version bump |
| `src/pages/VersionHistory.tsx` | Changelog entry |

---

## Stat Boost Mappings

Each instrument will boost its matching skill:
```typescript
// Example stat_boosts
{ "instruments_basic_electric_guitar": 5, "performance": 2 }
{ "instruments_professional_jazz_piano": 10, "performance": 5 }
```

---

## Total Seeded Items

| Category | Count |
|----------|-------|
| Electric Guitars | ~20 |
| Acoustic Guitars | ~10 |
| Classical Guitars | ~5 |
| Bass Guitars | ~10 |
| Keyboards/Synths | ~15 |
| Drums | ~10 |
| Percussion | ~8 |
| Saxophones | ~6 |
| Trumpets/Brass | ~8 |
| Flutes/Winds | ~8 |
| Violins/Strings | ~6 |
| DJ Equipment | ~10 |
| Microphones | ~8 |
| Audio Equipment | ~6 |
| **Total** | **~130 items** |

