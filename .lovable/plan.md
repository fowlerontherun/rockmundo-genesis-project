
# Role Playing Enhancements & New Player Wizard

## Overview

A comprehensive upgrade to transform the game into a rich role-playing experience with deep character identity, meaningful choices, NPC relationships, and a guided onboarding wizard that shapes your entire career through origin story decisions.

---

## Part 1: New Player Wizard (8-Step Onboarding)

### Step Flow

```
┌────────────────────────────────────────────────────────────┐
│  Step 1: Welcome & Name                                    │
│  "What should the world call you?"                         │
│  - Artist name input                                       │
│  - Display name input                                      │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Step 2: Character Appearance                              │
│  Integrated sprite creator (existing system)               │
│  - Gender, body, hair, face, clothing                      │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Step 3: Your Origin Story                                 │
│  "Where did your musical journey begin?"                   │
│  Choose 1 of 8 origins → starting bonuses                  │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Step 4: Personality Traits                                │
│  "What defines you as an artist?"                          │
│  Choose 2-3 traits → gameplay modifiers                    │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Step 5: Musical Identity                                  │
│  - Primary genre selection                                 │
│  - Musical influences (affects songwriting style)          │
│  - Signature sound description                             │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Step 6: Career Path                                       │
│  "How do you want to start?"                               │
│  - Solo Artist: Full control, harder start                 │
│  - Form a Band: Create with AI members                     │
│  - Join Existing: Browse open bands                        │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Step 7: Starting City                                     │
│  Choose home base city                                     │
│  - Each city has genre bonuses and scene characteristics   │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Step 8: Your Story So Far                                 │
│  AI-generated backstory summary combining all choices      │
│  - Review and confirm or regenerate                        │
│  - Tutorial prompts for first actions                      │
└────────────────────────────────────────────────────────────┘
```

---

## Part 2: Character Origins (8 Types)

Each origin provides unique starting bonuses and unlocks specific early-game content.

| Origin | Description | Starting Bonuses |
|--------|-------------|------------------|
| **Street Busker** | Learned music on the streets, reading crowds | +500 Fame (local), +Performance skill, unlocks busking gigs |
| **Music School Grad** | Classically trained with technical mastery | +3 skill levels in instrument, +Composition skill, student debt (-$2000) |
| **Garage Band Kid** | Self-taught with friends in suburban garages | +1 free AI band member, +Chemistry bonus, +DIY recording skill |
| **Industry Insider** | Worked behind the scenes, knows the business | +$3000 cash, +2 industry contacts, +Negotiation skill |
| **Viral Sensation** | Blew up online with a lucky break | +2000 Fame (global), +5000 followers, fragile reputation |
| **Cover Artist** | Built following performing others' songs | +Cover song catalog, +Stage presence, lower originality rep |
| **Prodigy Child** | Started young, pushed by family | +5 skill levels total, +Fame, complicated family relationship |
| **Scene Veteran** | Played in failed bands, starting fresh | +2 connections, +Resilience trait, knows what NOT to do |

---

## Part 3: Personality Traits (Choose 2-3)

Traits provide persistent gameplay modifiers and gate certain narrative choices.

### Trait Categories

**Creative Traits:**
| Trait | Effect |
|-------|--------|
| Perfectionist | +20% song quality, +50% writing time |
| Spontaneous | -10% quality, +30% faster output, +unique moments |
| Innovator | +15% to experimental genres, -10% to mainstream |
| Traditionalist | +15% to classic genres, NPC respect from veterans |

**Social Traits:**
| Trait | Effect |
|-------|--------|
| Diplomat | +20% negotiation success, fewer conflicts |
| Provocateur | +30% media attention, +controversy events |
| Introvert | -10% PR effectiveness, +15% solo writing quality |
| Charismatic | +20% fan conversion, +interview performance |

**Work Ethic Traits:**
| Trait | Effect |
|-------|--------|
| Workaholic | +25% XP gain, -10% health recovery |
| Hedonist | +Party events, -15% reliability reputation |
| Disciplined | +10% skill training, +Reliability reputation |
| Free Spirit | Random inspiration bonuses, scheduling penalties |

**Emotional Traits:**
| Trait | Effect |
|-------|--------|
| Sensitive | +Emotional depth in songs, vulnerability to criticism |
| Thick-Skinned | Immune to bad reviews, -emotional range |
| Ambitious | +Fame gain, rivalry events triggered more often |
| Humble | +Fan loyalty, slower fame growth |

---

## Part 4: Reputation & Relationships System

### Reputation Axes (4 Spectrums)

Track player choices across four key axes that affect NPC interactions:

```
Authenticity:  [Sell-out] ◄────────────────► [Authentic]
               Commercial deals,            Indie cred,
               mainstream appeal            underground respect

Attitude:      [Diva] ◄────────────────────► [Humble]
               Demanding rider,             Easy to work with,
               premium treatment            grassroots love

Reliability:   [Flaky] ◄──────────────────► [Dependable]
               Cancel gigs,                 Trusted partner,
               miss deadlines               repeat bookings

Creativity:    [Formulaic] ◄───────────────► [Innovative]
               Safe choices,                Risk-taking,
               predictable sales            cult following
```

### Actions That Shift Reputation

| Action | Authenticity | Attitude | Reliability | Creativity |
|--------|--------------|----------|-------------|------------|
| Accept corporate sponsorship | -10 | - | - | - |
| Play benefit show | +5 | +5 | +2 | - |
| Demand higher rider | - | -8 | - | - |
| Cancel gig last minute | - | - | -15 | - |
| Release experimental album | - | - | - | +10 |
| Cover pop hit | -5 | - | - | -5 |
| Show up early to soundcheck | - | +3 | +5 | - |
| Change genre for sales | -8 | - | - | -8 |

### NPC Relationship System

**Relationship Types:**
- **Industry Contacts**: Labels, promoters, producers, managers
- **Fellow Artists**: Collaboration potential, rivalry, mentorship
- **Media**: Journalists, bloggers, influencers
- **Venue Owners**: Booking relationships
- **Fans**: Individual superfan relationships (rare)

**Relationship Attributes:**
| Attribute | Range | Effect |
|-----------|-------|--------|
| Affinity | -100 to +100 | Willingness to work with you |
| Trust | 0 to 100 | Reliability of deals/promises |
| Respect | 0 to 100 | Quality of offers received |
| History | Events list | Shared experiences |

---

## Part 5: In-Character Dialogue & Reactions

### Dialogue System

NPCs respond based on:
1. Your reputation axes values
2. Your relationship with them specifically
3. Your personality traits
4. Recent actions/events

**Example Dialogue Variations:**

*Booking agent approaches about corporate gig:*

**If Authentic + Humble:**
> "Look, I know this isn't your usual scene, but the money's good and they specifically asked for someone with integrity. No logo placement, I promise."

**If Sell-out + Diva:**
> "They want you front and center at their launch. Full branding package. Name your price—they're desperate for your star power."

**If Authentic + Provocateur:**
> "Before you say no—what if we leaked that you're considering it? The controversy alone would be worth more than the gig."

### AI-Generated Responses

Use Lovable AI to generate contextual NPC dialogue:

```typescript
// Example prompt structure for NPC dialogue
const systemPrompt = `You are ${npcName}, a ${npcRole} in the music industry.
Player reputation: Authenticity ${auth}/100, Attitude ${att}/100
Your relationship with player: Affinity ${aff}, Trust ${trust}
Player traits: ${traits.join(', ')}
Recent events: ${recentEvents}

Respond in character to their request. Be brief (1-3 sentences).
Your personality: ${npcPersonality}`;
```

---

## Part 6: Database Schema

### New Tables

**`character_origins`** (Reference table)
| Column | Type | Description |
|--------|------|-------------|
| id | text PK | Origin identifier (e.g., 'street_busker') |
| name | text | Display name |
| description | text | Flavor text |
| starting_cash_modifier | int | +/- cash |
| starting_fame_modifier | int | +/- fame |
| starting_skill_bonuses | jsonb | {skill: level_bonus} |
| unlocks | text[] | Early content unlocks |
| drawbacks | jsonb | Negative modifiers |

**`personality_traits`** (Reference table)
| Column | Type | Description |
|--------|------|-------------|
| id | text PK | Trait identifier |
| name | text | Display name |
| category | text | creative/social/work/emotional |
| description | text | Flavor text |
| modifiers | jsonb | Gameplay effects |
| incompatible_with | text[] | Mutually exclusive traits |

**`player_character_identity`** (Per-profile)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| profile_id | uuid FK | Links to profiles |
| origin_id | text FK | Selected origin |
| trait_ids | text[] | Selected traits (2-3) |
| backstory | text | AI-generated summary |
| musical_influences | text[] | Selected influences |
| signature_sound | text | Player description |
| created_at | timestamptz | |

**`player_reputation`** (Per-profile)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| profile_id | uuid FK | Links to profiles |
| authenticity | int | -100 to 100, default 0 |
| attitude | int | -100 to 100, default 0 |
| reliability | int | -100 to 100, default 0 |
| creativity | int | -100 to 100, default 0 |
| updated_at | timestamptz | |

**`npc_relationships`** (Per-profile per NPC)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| profile_id | uuid FK | Player profile |
| npc_id | uuid FK | NPC reference |
| affinity | int | -100 to 100 |
| trust | int | 0 to 100 |
| respect | int | 0 to 100 |
| interaction_count | int | Times interacted |
| last_interaction | timestamptz | |
| history | jsonb | Array of event summaries |

**`reputation_events`** (Audit log)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| profile_id | uuid FK | |
| event_type | text | Action that triggered change |
| axis | text | Which axis changed |
| change_amount | int | Delta value |
| context | jsonb | Event details |
| created_at | timestamptz | |

---

## Part 7: Frontend Components

### New Files to Create

```
src/pages/
  Onboarding.tsx                      <- Wizard container

src/components/onboarding/
  OnboardingWizard.tsx                <- Step controller
  steps/
    WelcomeStep.tsx                   <- Step 1: Name
    AppearanceStep.tsx                <- Step 2: Avatar
    OriginStep.tsx                    <- Step 3: Origins
    TraitsStep.tsx                    <- Step 4: Personality
    MusicIdentityStep.tsx             <- Step 5: Genre/influences
    CareerPathStep.tsx                <- Step 6: Solo/band/join
    StartingCityStep.tsx              <- Step 7: Location
    BackstoryStep.tsx                 <- Step 8: Summary
  OriginCard.tsx                      <- Origin selection card
  TraitBadge.tsx                      <- Trait selection chip
  ReputationMeter.tsx                 <- Visual axis display

src/components/reputation/
  ReputationAxes.tsx                  <- 4-axis visual display
  ReputationHistory.tsx               <- Recent changes log
  ReputationTooltip.tsx               <- Hover explanation

src/components/relationships/
  NPCRelationshipCard.tsx             <- NPC relationship display
  RelationshipList.tsx                <- All relationships
  RelationshipHistory.tsx             <- Interaction timeline

src/hooks/
  useOnboarding.ts                    <- Wizard state management
  useCharacterIdentity.ts             <- Origin/traits data
  useReputation.ts                    <- Reputation tracking
  useNPCRelationships.ts              <- NPC relationship data
```

### Integration Points

1. **First Login Detection**: Redirect to `/onboarding` if no character identity exists
2. **Reputation Display**: Add to Dashboard sidebar
3. **NPC Interactions**: Modify all booking/negotiation dialogs
4. **Journal Integration**: Log reputation changes as milestones
5. **Random Events**: Gate events based on traits/reputation

---

## Part 8: Edge Functions

**`generate-backstory`**
- Takes: origin, traits, genre, influences, city
- Returns: AI-generated 2-3 paragraph backstory
- Uses: Lovable AI with structured prompts

**`update-reputation`**
- Takes: profile_id, action_type, context
- Calculates: Which axes change and by how much
- Logs: Creates reputation_event record
- Returns: New reputation values

**`get-npc-dialogue`**
- Takes: npc_id, profile_id, context, dialogue_type
- Generates: In-character response based on relationships
- Uses: Lovable AI with NPC personality + relationship data

---

## Part 9: Implementation Phases

### Phase 1: Database & Core (v1.0.566)
- [ ] Create all new tables with RLS policies
- [ ] Seed character_origins and personality_traits
- [ ] Create useCharacterIdentity hook
- [ ] Create useReputation hook

### Phase 2: Onboarding Wizard (v1.0.567)
- [ ] Create Onboarding page and wizard controller
- [ ] Implement Steps 1-4 (Name, Appearance, Origin, Traits)
- [ ] Implement Steps 5-7 (Music, Career, City)
- [ ] Create generate-backstory edge function
- [ ] Implement Step 8 (Backstory generation)
- [ ] First-login redirect logic

### Phase 3: Reputation System (v1.0.568)
- [ ] Create ReputationAxes component
- [ ] Create update-reputation edge function
- [ ] Integrate with existing actions (gigs, negotiations, etc.)
- [ ] Add reputation display to Dashboard
- [ ] Log reputation changes to Journal

### Phase 4: NPC Relationships (v1.0.569)
- [ ] Create NPC reference data
- [ ] Create relationship components
- [ ] Create get-npc-dialogue edge function
- [ ] Modify booking/negotiation dialogs
- [ ] Add relationship list to Relationships page

### Phase 5: In-Character Dialogue (v1.0.570)
- [ ] Implement AI dialogue generation
- [ ] Add dialogue variations based on reputation
- [ ] Create NPC personality profiles
- [ ] Test across all interaction points

---

## Part 10: Version Updates

Each phase increments version with detailed changelog:

**v1.0.566**: Database foundation for RP system
**v1.0.567**: New Player Wizard with 8-step onboarding
**v1.0.568**: Reputation tracking across 4 axes
**v1.0.569**: NPC relationship system
**v1.0.570**: AI-powered in-character dialogue

---

## Files Summary

### Create (New)
| File | Purpose |
|------|---------|
| `src/pages/Onboarding.tsx` | Wizard container page |
| `src/components/onboarding/*` | All wizard step components |
| `src/components/reputation/*` | Reputation UI components |
| `src/components/relationships/NPC*` | NPC relationship components |
| `src/hooks/useOnboarding.ts` | Wizard state |
| `src/hooks/useCharacterIdentity.ts` | Origin/traits |
| `src/hooks/useReputation.ts` | Reputation data |
| `src/hooks/useNPCRelationships.ts` | NPC relationships |
| `supabase/functions/generate-backstory/*` | AI backstory |
| `supabase/functions/update-reputation/*` | Reputation logic |
| `supabase/functions/get-npc-dialogue/*` | AI NPC dialogue |

### Modify (Existing)
| File | Changes |
|------|---------|
| `src/App.tsx` | Add /onboarding route, first-login redirect |
| `src/pages/Dashboard.tsx` | Add reputation sidebar widget |
| `src/pages/Relationships.tsx` | Add NPC relationships tab |
| All booking/negotiation dialogs | Add NPC dialogue integration |
| All action edge functions | Call update-reputation on relevant actions |

---

## Testing Checklist

- [ ] New user sees onboarding wizard on first login
- [ ] All 8 steps complete successfully
- [ ] Origin bonuses applied correctly
- [ ] Traits modifiers work in gameplay
- [ ] Backstory generates appropriately
- [ ] Reputation changes on relevant actions
- [ ] NPC dialogue varies by reputation
- [ ] Relationships track over time
- [ ] Returning users skip onboarding

---

*This plan provides a complete role-playing foundation that deeply integrates character identity into every aspect of gameplay.*
