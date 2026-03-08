

## v1.0.993 — Health Stats → Company Systems (Payroll, Bankruptcy, Operations)

### Overview
The four company management functions (`process-company-operations`, `process-company-payroll`, `process-company-taxes`, `check-company-bankruptcy`) are the last major edge functions with zero health-stat integration. These are business-critical systems that should reflect the owner's band health.

### Changes

#### 1. Company Operations → Reputation Modifier (`process-company-operations/index.ts`)
- Fetch the company owner's band `reputation_score` via `companies.owner_id → band_members → bands`
- Reputation scales **activity-based revenue** (the `BASE_ACTIVITY_REVENUE` multiplier): **0.85x (toxic) → 1.15x (iconic)**
- Rationale: A reputable band owner attracts more clients/bookings to their companies

#### 2. Company Payroll → Morale Impact (`process-company-payroll/index.ts`)
- After successfully paying all salaries, award **+1 morale** to the owner's band (paying staff on time = responsible management)
- If payroll **fails** (insufficient funds), apply **-3 morale** penalty (can't pay your people = stress)

#### 3. Company Bankruptcy → Morale + Reputation Crash (`check-company-bankruptcy/index.ts`)
- When bankruptcy is **declared**, apply **-15 morale** and **-10 reputation** to the owner's band
- When a **warning** is issued (3 days negative), apply **-5 morale**
- Going bankrupt is a major public and personal blow

#### 4. Version bump + changelog
- `VersionHeader.tsx` → v1.0.993
- `VersionHistory.tsx` → Add changelog entry

### Files to modify
- `supabase/functions/process-company-operations/index.ts` — Reputation → revenue scaling
- `supabase/functions/process-company-payroll/index.ts` — Payroll success/failure → morale
- `supabase/functions/check-company-bankruptcy/index.ts` — Bankruptcy → morale + reputation crash
- `src/components/VersionHeader.tsx` — Bump version
- `src/pages/VersionHistory.tsx` — Add changelog entry

