
# City Laws and Elections System

## Overview
Create a comprehensive city governance system where mayors are elected yearly by residents. Mayors set local laws affecting tax rates, drug policies, alcohol restrictions, allowed music genres, travel taxes, and community rules. These laws impact gameplay for all players residing in or visiting the city.

## Database Schema

### 1. City Laws Table: `city_laws`
Stores the current active laws for each city.

```text
┌─────────────────────────────────────────────────────────────────┐
│                          city_laws                              │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                          │
│ city_id               UUID → cities (FK, UNIQUE)                │
│ income_tax_rate       NUMERIC(4,2) DEFAULT 10.0 (5-25%)         │
│ sales_tax_rate        NUMERIC(4,2) DEFAULT 8.0 (0-15%)          │
│ travel_tax            NUMERIC(8,2) DEFAULT 50 (departure fee)   │
│ alcohol_legal_age     INTEGER DEFAULT 21 (16-25)                │
│ drug_policy           ENUM (prohibited, medical, decriminalized,│
│                             legalized)                          │
│ noise_curfew_hour     INTEGER DEFAULT 23 (22-02 or null)        │
│ busking_license_fee   NUMERIC(8,2) DEFAULT 0                    │
│ venue_permit_cost     NUMERIC(8,2) DEFAULT 500                  │
│ prohibited_genres     TEXT[] DEFAULT '{}'                       │
│ promoted_genres       TEXT[] DEFAULT '{}'                       │
│ festival_permit_required BOOLEAN DEFAULT true                   │
│ max_concert_capacity  INTEGER DEFAULT null (unlimited)          │
│ community_events_funding NUMERIC(8,2) DEFAULT 0                 │
│ effective_from        TIMESTAMPTZ                               │
│ effective_until       TIMESTAMPTZ                               │
│ enacted_by_mayor_id   UUID → city_mayors                        │
│ created_at            TIMESTAMPTZ                               │
│ updated_at            TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2. City Mayors Table: `city_mayors`
Tracks current and historical mayors for each city.

```text
┌─────────────────────────────────────────────────────────────────┐
│                         city_mayors                             │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                          │
│ city_id               UUID → cities (FK)                        │
│ profile_id            UUID → profiles (FK)                      │
│ term_start            TIMESTAMPTZ                               │
│ term_end              TIMESTAMPTZ                               │
│ is_current            BOOLEAN DEFAULT false                     │
│ election_id           UUID → city_elections (nullable)          │
│ approval_rating       NUMERIC(5,2) DEFAULT 50.0                 │
│ policies_enacted      INTEGER DEFAULT 0                         │
│ created_at            TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────────┘
```

### 3. City Elections Table: `city_elections`
Manages election cycles and results.

```text
┌─────────────────────────────────────────────────────────────────┐
│                        city_elections                           │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                          │
│ city_id               UUID → cities (FK)                        │
│ election_year         INTEGER (game year)                       │
│ status                ENUM (nomination, voting, completed,      │
│                             cancelled)                          │
│ nomination_start      TIMESTAMPTZ                               │
│ nomination_end        TIMESTAMPTZ                               │
│ voting_start          TIMESTAMPTZ                               │
│ voting_end            TIMESTAMPTZ                               │
│ winner_id             UUID → city_candidates (nullable)         │
│ total_votes           INTEGER DEFAULT 0                         │
│ voter_turnout_pct     NUMERIC(5,2)                              │
│ created_at            TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4. City Candidates Table: `city_candidates`
Players running for mayor.

```text
┌─────────────────────────────────────────────────────────────────┐
│                       city_candidates                           │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                          │
│ election_id           UUID → city_elections (FK)                │
│ profile_id            UUID → profiles (FK)                      │
│ campaign_slogan       TEXT                                      │
│ proposed_policies     JSONB (preview of intended law changes)   │
│ campaign_budget       NUMERIC(10,2) DEFAULT 0                   │
│ endorsements          TEXT[]                                    │
│ vote_count            INTEGER DEFAULT 0                         │
│ status                ENUM (pending, approved, withdrawn,       │
│                             disqualified)                       │
│ registered_at         TIMESTAMPTZ                               │
│ created_at            TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────────┘
```

### 5. City Election Votes Table: `city_election_votes`
Individual vote records with trigger for vote counting.

```text
┌─────────────────────────────────────────────────────────────────┐
│                     city_election_votes                         │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                          │
│ election_id           UUID → city_elections (FK)                │
│ voter_profile_id      UUID → profiles (FK)                      │
│ candidate_id          UUID → city_candidates (FK)               │
│ voted_at              TIMESTAMPTZ                               │
│ UNIQUE(election_id, voter_profile_id) -- one vote per election  │
└─────────────────────────────────────────────────────────────────┘
```

### 6. City Law History Table: `city_law_history`
Audit trail of all law changes.

```text
┌─────────────────────────────────────────────────────────────────┐
│                      city_law_history                           │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                          │
│ city_id               UUID → cities (FK)                        │
│ mayor_id              UUID → city_mayors (FK)                   │
│ law_field             TEXT (column name changed)                │
│ old_value             TEXT                                      │
│ new_value             TEXT                                      │
│ change_reason         TEXT                                      │
│ game_year             INTEGER                                   │
│ changed_at            TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────────┘
```

### Enums to Create
- `drug_policy_status`: `prohibited`, `medical_only`, `decriminalized`, `legalized`
- `election_status`: `nomination`, `voting`, `completed`, `cancelled`
- `candidate_status`: `pending`, `approved`, `withdrawn`, `disqualified`

## Gameplay Impact System

### How Laws Affect Players

| Law | Gameplay Effect |
|-----|-----------------|
| Income Tax Rate | Percentage deducted from all earnings (gigs, royalties, sales) |
| Sales Tax Rate | Added to merchandise and equipment purchases |
| Travel Tax | Fee charged when departing the city |
| Alcohol Legal Age | Players under age cannot enter certain venues/clubs |
| Drug Policy | Affects availability of "party" events, health recovery items |
| Noise Curfew | Gigs after curfew hour face fines or cancellation risk |
| Busking License Fee | Cost to obtain street performance permit |
| Prohibited Genres | Playing these genres results in fines or venue bans |
| Promoted Genres | Bonus to streams/attendance for these genres |
| Festival Permit | Required for large outdoor events |

## Election Flow

### Annual Election Cycle (tied to game calendar)
1. **Nomination Phase** (Game Month 10): Residents can register as candidates
2. **Campaign Phase** (Game Month 11): Candidates visible, can spend on campaigns
3. **Voting Phase** (Game Month 12, Days 1-15): Eligible voters cast ballots
4. **Results** (Game Month 12, Day 16): Winner announced
5. **Term Begins** (Game Year +1, Month 1): New mayor takes office

### Eligibility Requirements
- **To Run**: Player must have `current_city_id` or `city_of_birth` matching the city, minimum fame level (100+), no active bans
- **To Vote**: Player's `current_city_id` must match the city for at least 30 game days

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/[timestamp]_create_city_governance.sql` | All tables, enums, RLS, triggers |
| `src/types/city-governance.ts` | TypeScript interfaces |
| `src/hooks/useCityLaws.ts` | Fetch current laws for a city |
| `src/hooks/useCityElections.ts` | Election data and voting mutations |
| `src/hooks/useMayorDashboard.ts` | Mayor-specific law management |
| `src/components/city/CityLawsDisplay.tsx` | View current city laws |
| `src/components/city/ElectionBanner.tsx` | Active election notification |
| `src/components/city/VotingBooth.tsx` | Cast vote UI |
| `src/components/city/CandidateCard.tsx` | Candidate profile display |
| `src/components/city/MayorDashboard.tsx` | Law editing for mayors |
| `src/components/city/RunForMayorDialog.tsx` | Candidate registration |
| `src/pages/CityGovernance.tsx` | Main governance page |
| `supabase/functions/process-city-elections/index.ts` | Cron job to advance election phases |
| `supabase/functions/apply-city-taxes/index.ts` | Apply tax deductions to transactions |

### Files to Modify

| File | Changes |
|------|---------|
| `src/integrations/supabase/types.ts` | Auto-generated type updates |
| `src/utils/gameCalendar.ts` | Add election phase calculations |
| `src/components/travel/TravelCostCalculator.tsx` | Include travel tax |
| `src/components/gigs/GigPaymentBreakdown.tsx` | Show tax deductions |
| `src/pages/CityDetails.tsx` | Add governance tab/section |
| `src/components/VersionHeader.tsx` | Bump to v1.0.525 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

## Example Law Configurations

### Liberal City (e.g., Amsterdam-style)
```json
{
  "income_tax_rate": 15.0,
  "sales_tax_rate": 6.0,
  "travel_tax": 25,
  "alcohol_legal_age": 18,
  "drug_policy": "legalized",
  "noise_curfew_hour": null,
  "prohibited_genres": [],
  "promoted_genres": ["electronic", "reggae"]
}
```

### Conservative City
```json
{
  "income_tax_rate": 8.0,
  "sales_tax_rate": 12.0,
  "travel_tax": 100,
  "alcohol_legal_age": 21,
  "drug_policy": "prohibited",
  "noise_curfew_hour": 22,
  "prohibited_genres": ["punk", "death metal"],
  "promoted_genres": ["classical", "jazz"]
}
```

## Edge Function: Election Processor

A scheduled cron job (daily) that:
1. Checks if any elections need phase transitions based on game date
2. Advances `nomination` → `voting` → `completed`
3. Calculates winner when voting ends
4. Creates new `city_mayors` record for winner
5. Ends previous mayor's term
6. Generates default `city_laws` entry for new term

## UI Components

### City Governance Page Tabs
1. **Current Laws** - Display all active laws with explanations
2. **Your Mayor** - Current mayor info, approval rating, policies enacted
3. **Elections** - Active/upcoming elections, candidate list, voting
4. **Law History** - Timeline of law changes in the city
5. **Run for Mayor** - Registration form (if eligible)

### Mayor Dashboard Features
- Slider/input controls for each law value
- Preview of impact on city economy
- "Enact Changes" button (once per game month limit)
- Approval rating tracker
- Term remaining countdown

## Version Update
- Bump to **v1.0.525**
- Changelog: "Cities: Added city governance system with mayors, elections, and local laws affecting taxes, alcohol age, drug policy, allowed genres, and travel fees"
