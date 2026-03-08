

# Plan: Modeling Career Rework + Fashion & Clothing Design Skills (Multi-Phase)

This is a large interconnected feature set spanning modeling skill gates, new skill tree branches, a player clothing shop system, and education seeding. Presented in 4 phases for manageable implementation.

---

## Phase 1: Modeling & Fashion Skill Trees (v1.0.919)

### New Skill Tree Categories

**Modeling (6 tracks, 18 skills)**
Prefix: `modeling`, Category: `Modeling & Fashion`

| Track | Basic | Professional | Mastery |
|-------|-------|-------------|---------|
| Posing | Basic Posing | Professional Posing | Posing Mastery |
| Runway Walking | Basic Runway | Professional Runway | Runway Mastery |
| Camera Presence | Basic Camera Work | Professional Camera Presence | Camera Mastery |
| Commercial Modeling | Basic Commercial | Professional Commercial | Commercial Mastery |
| Editorial Modeling | Basic Editorial | Professional Editorial | Editorial Mastery |
| Brand Collaboration | Basic Brand Work | Professional Brand Strategy | Brand Empire |

**Fashion Design (5 tracks, 15 skills)**
Prefix: `fashion`, Category: `Fashion & Clothing`
Prerequisites: `modeling_basic_posing` >= 100 (gates entry into fashion from modeling)

| Track | Basic | Professional | Mastery |
|-------|-------|-------------|---------|
| Fashion Fundamentals | Basic Fashion Knowledge | Professional Fashion Theory | Fashion Mastery |
| Textile & Materials | Basic Textiles | Professional Materials | Textile Mastery |
| Pattern Making | Basic Patterns | Professional Pattern Design | Pattern Mastery |
| Style & Aesthetics | Basic Styling | Professional Aesthetics | Style Mastery |
| Fashion Business | Basic Fashion Business | Professional Fashion Management | Fashion Empire |

**Clothing Design (4 tracks, 12 skills)**
Prefix: `clothing`, Category: `Clothing Design`
Prerequisites: `fashion_basic_fundamentals` >= 250 (gates from fashion)

| Track | Basic | Professional | Mastery |
|-------|-------|-------------|---------|
| Garment Construction | Basic Construction | Professional Garment Making | Construction Mastery |
| Clothing Branding | Basic Clothing Brand | Professional Brand Identity | Brand Legend |
| Genre Aesthetics | Basic Genre Style | Professional Genre Fashion | Genre Fashion Mastery |
| Retail & Commerce | Basic Retail | Professional Shop Management | Retail Empire |

Total: **45 new skills** across 3 categories.

### Modeling Skill Gates

Update `ModelingCareerProgress.tsx` tier requirements:

| Tier | Current Requirement | New Skill Requirement |
|------|--------------------|-----------------------|
| Amateur | 0 gigs, 0 looks | + `modeling_basic_posing` >= 50 |
| Rising | 3 gigs, 40 looks | + `modeling_basic_runway` >= 100 |
| Established | 8 gigs, 60 looks | + `modeling_professional_posing` >= 250 |
| Supermodel | 15 gigs, 80 looks | + `modeling_professional_runway` >= 400 |
| Fashion Icon | 25 gigs, 90 looks | + `modeling_mastery_posing` >= 650 |

Update `modelingOfferGenerator.ts` to check player has minimum modeling skills before generating offers at each tier. Gigs with `gig_type: 'runway'` require runway skills; `cover_shoot` requires camera skills, etc.

### Files to Create/Modify
- **`src/data/skillTree.ts`** -- Add `modelingFashionConfigs`, `fashionDesignConfigs`, `clothingDesignConfigs` arrays, include in final build
- **`src/components/modeling/ModelingCareerProgress.tsx`** -- Add skill requirements to tier checks
- **`src/utils/modelingOfferGenerator.ts`** -- Skill-gated offer generation
- **`src/pages/Modeling.tsx`** -- Pass skill data, show skill requirements on page
- **Version bump** -- v1.0.919

---

## Phase 2: Education Seeding for New Skills (v1.0.920)

### Database Seeding (via insert tool, not migrations)

**Books** (~15 new entries in existing books system)
- "The Art of the Pose" -- modeling_basic_posing
- "Runway Confidence" -- modeling_basic_runway
- "Fashion Design 101" -- fashion_basic_fundamentals
- "Textiles: A Designer's Guide" -- fashion_basic_textiles
- "Building a Clothing Brand" -- clothing_basic_branding
- Plus ~10 more covering professional/mastery tiers

**Mentors** (~8 new Legendary Masters)
- "Naomi Fierce" -- modeling mastery, London, $50k
- "Karl Stein" -- fashion design mastery, Paris, $100k
- "Valentina Rossi" -- textile mastery, Milan, $75k
- "Alexander Wu" -- clothing design mastery, Tokyo, $80k
- Plus 4 more across cities

**University Courses** (~20 new courses)
- Modeling programs at fashion hubs (NYC, London, Paris, Milan, Tokyo)
- Fashion design degrees at major cities
- Clothing/textile courses with 14-28 day durations
- Each linked to appropriate skill slugs

### Files to Modify
- Seed data via Supabase insert tool (books, mentors, courses tables)
- **Version bump** -- v1.0.920

---

## Phase 3: Player Clothing Shop System (v1.0.921)

### Database Schema (1 migration)

**`player_clothing_brands`** table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK auth.users | unique |
| brand_name | text | Player-chosen name |
| brand_description | text nullable | |
| logo_url | text nullable | |
| genre_focus | text | Primary genre aesthetic |
| quality_rating | numeric default 0 | Average of all items |
| style_rating | numeric default 0 | Average of all items |
| reputation | integer default 0 | Built over time |
| total_sales | integer default 0 | |
| total_revenue | numeric default 0 | |
| city_id | uuid FK cities | Shop location |
| is_open | boolean default false | |
| created_at / updated_at | timestamptz | |

RLS: Read all authenticated, CRUD own.

**`player_clothing_items`** table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| brand_id | uuid FK player_clothing_brands | |
| creator_user_id | uuid FK auth.users | |
| name | text | |
| description | text nullable | |
| category | text | 'tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'hats' |
| genre_style | text | Links to game genres |
| quality_score | integer 1-100 | Calculated from skills |
| style_score | integer 1-100 | Calculated from skills |
| production_cost | numeric | Materials cost |
| sale_price | numeric | Player sets |
| stock_quantity | integer default 0 | |
| total_sold | integer default 0 | |
| is_listed | boolean default true | |
| rarity | text default 'common' | Based on quality |
| metadata | jsonb | Color variants, materials, etc |
| created_at | timestamptz | |

RLS: Read all authenticated, CRUD own via brand_id.

**`player_clothing_purchases`** table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| buyer_user_id | uuid FK auth.users | |
| item_id | uuid FK player_clothing_items | |
| seller_user_id | uuid FK auth.users | |
| price_paid | numeric | |
| purchased_at | timestamptz | |

RLS: Insert own buyer_id, read own.

### Quality & Style Calculation

```text
quality_score = floor(
  (garment_construction_skill / 10) +
  (textile_skill / 15) +
  (pattern_skill / 15)
) -- cap 100

style_score = floor(
  (style_aesthetics_skill / 10) +
  (genre_aesthetics_skill / 15) +
  (fashion_fundamentals / 20)
) -- cap 100

Rarity derived from quality:
  0-30: common
  31-50: uncommon
  51-70: rare
  71-85: epic
  86-100: legendary
```

### Genre-Clothing Links
Clothing items have a `genre_style` field matching game genres (rock, hip_hop, pop, jazz, electronic, country, metal, punk, r_and_b, latin). Players wearing genre-matched clothing get:
- +5% fan interaction bonus at gigs of that genre
- +3% merchandise sales for that genre
- Visual flair in avatar system

### New Files
- **`src/pages/ClothingShop.tsx`** -- Browse/buy from player shops
- **`src/pages/ClothingDesigner.tsx`** -- Create items, manage brand, set prices
- **`src/hooks/useClothingBrand.ts`** -- CRUD for brand and items
- **`src/hooks/useClothingMarketplace.ts`** -- Browse/search/buy
- **`src/components/clothing/ClothingItemCard.tsx`** -- Display component
- **`src/components/clothing/ClothingDesignForm.tsx`** -- Create new items
- **`src/utils/clothingQuality.ts`** -- Quality/style calculation from skills

### Modified Files
- **`src/App.tsx`** -- Add routes `/clothing-shop`, `/clothing-designer`
- **`src/components/ui/navigation.tsx`** + **`HorizontalNavigation.tsx`** -- Add nav entries
- **`src/pages/hubs/CareerHub.tsx`** -- Add "Fashion Designer" career tile
- **`src/i18n/*.ts`** -- Translation keys
- **Version bump** -- v1.0.921

---

## Phase 4: Integration & Polish (v1.0.922)

### Gameplay Integration
- **Avatar system**: Player-purchased clothing appears in wardrobe (`usePlayerAvatar.ts`)
- **Gig bonuses**: Genre-matched clothing provides stat bonuses during gigs
- **Modeling connection**: High fashion design skills unlock exclusive modeling gigs (editorial, fashion week)
- **Merchandise crossover**: Clothing brands contribute to merchandise system reputation

### Addiction Tie-in
- "Shopping" addiction (already in conditionSystem) triggers from excessive clothing purchases

### XP Rewards
- Creating clothing items: 30-80 XP (based on quality)
- Selling items: 10 XP per sale
- Modeling gigs now award modeling skill XP (not just fame/cash)

### Files Modified
- **`src/hooks/usePlayerAvatar.ts`** -- Include player-made clothing in wardrobe
- **`src/utils/addictionSystem.ts`** -- Link shopping addiction to clothing purchases
- **`src/utils/modelingOfferGenerator.ts`** -- Award modeling XP on gig completion
- **Version bump** -- v1.0.922

---

## Implementation Order

Phase 1 first (skill trees + modeling gates), as everything else depends on the skills existing. Phase 2 next (education seeding). Phase 3 (clothing shop) can follow immediately. Phase 4 (integration) last.

Each phase is a single implementation message. Shall I begin with Phase 1?

