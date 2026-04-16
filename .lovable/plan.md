

# Expand Mayor Roles, City Budgets & Politics Skills

Build out three connected systems: a **city budget** mayors actively spend, **city improvement projects** that boost city stats, and a new **Politics** skill family that gates and amplifies mayoral powers.

---

## 1. New Database Tables & Columns

**`city_projects`** (new) — improvement initiatives mayors fund
- `id`, `city_id`, `mayor_id`, `project_type` (enum), `name`, `description`
- `cost`, `duration_days`, `status` (proposed | in_progress | completed | cancelled)
- `started_at`, `completes_at`, `effects` (jsonb — stat boosts applied on completion)
- `approval_change` (impact on mayor approval)

**`city_project_types`** (new, seed data) — catalog of buildable projects:
- *Infrastructure*: Build Music Venue (+venues, +scene), Upgrade Train Network, Build Concert Hall (+max_capacity)
- *Culture*: Music Festival Sponsorship (+scene, +tourism), Public Art Program (+approval), Music Education Grant (+local_bonus)
- *Economy*: Tax Office Modernization (+collection efficiency), Tourism Campaign (+population growth)
- *Quality of Life*: Noise Reduction Initiative, Public Safety Boost, Healthcare Subsidy

Each type defines: base cost, duration, effects, required mayor skill level.

**`city_treasury`** additions
- `weekly_budget` — auto-allocated discretionary spend
- `salary_paid` — track mayor compensation
- `pending_commitments` — funds reserved for in-progress projects

**`city_mayors`** additions
- `salary_per_week` (computed from city size)
- `corruption_score` (0–100, increases if mayor pulls excessive funds)
- `vetoed_count`, `projects_completed`

**`mayor_actions_log`** (new) — audit trail of all spending/decisions for transparency

**`skill_definitions`** — insert 6 new Politics skills:
- `basic_public_speaking` — boosts approval gain from speeches
- `basic_negotiation` — reduces project costs 5–15%
- `basic_governance` — unlocks more advanced projects
- `professional_diplomacy` — reduces inter-city conflict, enables trade deals
- `professional_campaign_strategy` — boosts vote totals during elections
- `master_statecraft` — unlocks city-wide referendums and emergency powers

---

## 2. Expanded Mayor Powers

Add to **MayorDashboard** (new tabs):

**Budget Tab**
- Treasury overview (balance, weekly income, committed funds, mayor salary)
- Adjust mayor salary (within bounds — high salary tanks approval)
- Discretionary spend slider for community programs (boosts approval, costs cash)
- Recent ledger transactions

**Projects Tab**
- Browse available project catalog (filtered by mayor's politics skill level)
- Active projects with progress bars and ETA
- Completed project history showing effects applied
- "Propose Project" flow → cost preview → confirm → funds locked

**Public Relations Tab**
- "Hold Press Conference" action (consumes AP, gains approval, requires public_speaking skill)
- "Sign Trade Deal" with another mayor (requires diplomacy)
- "Issue Decree" — emergency one-off law change (requires statecraft)
- "Campaign Speech" during election season (boosts vote count)

**Skills sidebar widget** — shows mayor's current politics skill levels and which actions are unlocked.

---

## 3. City Effects from Mayoral Activity

When a project completes, a DB trigger applies its `effects` JSON to:
- `cities.music_scene`, `cities.local_bonus`, `cities.venues`, `cities.population`
- `city_laws.max_concert_capacity` (e.g., from concert hall project)
- Mayor's `approval_rating` and `policies_enacted`

Approval mechanics:
- Completing projects → +approval
- High taxes → −approval (existing law effects)
- High mayor salary → −approval
- Failed/cancelled projects → −approval & +corruption_score
- Corruption > 75 → triggers a recall election

---

## 4. Politics Skills Integration

Earn Politics SXP from:
- Holding office (passive weekly gain)
- Press conferences, decrees, campaign speeches (active actions)
- Successful project completion
- Winning elections

Skills unlock features at thresholds:
- Level 0: Basic law editing only (current functionality)
- Level 200 (basic): Propose infrastructure projects
- Level 500 (professional): Trade deals, advanced projects
- Level 800 (master): Referendums, emergency powers, no-vote law overrides

Non-mayors can train politics skills via books/mentors to prepare for future campaigns; high politics skill boosts vote totals during elections.

---

## 5. UI Surfaces

- **MayorDashboard.tsx**: expand tabs from 4 → 7 (Budget, Projects, PR, Taxes, Regulations, Music, History)
- **CityGovernanceSection.tsx**: show active projects to all citizens (transparency)
- **SkillsPage.tsx**: new "Politics" skill family group renders automatically once skills exist
- **CityElection.tsx**: show candidates' politics skill levels as a credibility indicator
- New helper: `src/utils/cityProjectEffects.ts` — applies project completion effects
- New hook: `src/hooks/useCityProjects.ts` — list/propose/track projects
- New hook: `src/hooks/useMayorPolitics.ts` — derive unlocked actions from skill levels

---

## 6. Background Processing

- **Cron / scheduled function** (extend existing edge function or add `process-city-projects`):
  - Hourly: check for projects with `completes_at <= now()` and apply effects
  - Weekly: pay mayor salary from treasury, accrue passive politics XP, decay corruption slightly
  - On law update: small approval ripple based on whether changes favor citizens

---

## 7. Versioning

Bump version to **v1.1.202** in `VersionHeader.tsx` and add detailed entry in `VersionHistory.tsx` covering: budget tab, projects system, politics skills, project effects, approval/corruption mechanics.

---

## Files to Create / Modify

**New**
- Migration: 4 tables + columns + skill seeds + project type seeds + RLS
- `src/types/city-projects.ts`
- `src/hooks/useCityProjects.ts`
- `src/hooks/useMayorPolitics.ts`
- `src/utils/cityProjectEffects.ts`
- `src/components/city/MayorBudgetTab.tsx`
- `src/components/city/MayorProjectsTab.tsx`
- `src/components/city/MayorPublicRelationsTab.tsx`
- `src/components/city/CityProjectsPublicView.tsx`
- `supabase/functions/process-city-projects/index.ts`

**Modified**
- `src/pages/MayorDashboard.tsx` — wire new tabs + skills sidebar
- `src/components/city/CityGovernanceSection.tsx` — show project activity
- `src/utils/mayorLawEffects.ts` — incorporate project-derived bonuses
- `src/components/VersionHeader.tsx`, `src/pages/VersionHistory.tsx`

