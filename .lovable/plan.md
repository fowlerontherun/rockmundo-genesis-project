

## v1.0.995 — Health Stats Event Log: Track What's Changing Your Band Health

### Problem
All 3 health stats (Morale, Reputation, Sentiment) are now wired into 50+ edge functions, but players have **no visibility** into what's causing their stats to change. The BandHealthDashboard shows current values and feedback loops, but there's no event log showing "Sponsorship payment → +3 morale" or "Bankruptcy declared → -15 morale, -10 reputation". Players can't understand why their stats are drifting.

### Solution
Create a **Health Event Log** system that records every health-stat change from edge functions into a new `band_health_events` table, and display them in a scrollable timeline on the Band Overview page.

### Changes

#### 1. New DB table: `band_health_events`
```sql
CREATE TABLE public.band_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,          -- 'morale' | 'reputation' | 'sentiment'
  delta integer NOT NULL,            -- +3, -15, etc.
  new_value integer NOT NULL,        -- value after change
  source text NOT NULL,              -- 'sponsorship_payment', 'bankruptcy', 'chart_hit', etc.
  description text,                  -- human-readable: "Sponsorship payment received ($5,000)"
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_health_events_band ON public.band_health_events(band_id, created_at DESC);
ALTER TABLE public.band_health_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Band members can view their band health events"
  ON public.band_health_events FOR SELECT TO authenticated
  USING (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));
```

#### 2. New component: `BandHealthEventLog.tsx`
- Fetches latest 20 events from `band_health_events` for the band
- Renders as a compact scrollable timeline grouped by day
- Color-coded: green for positive deltas, red for negative, with stat icons
- Shows source and description for each event

#### 3. Add to BandOverview
- Place the `BandHealthEventLog` below the existing `BandHealthDashboard` in the 3-column health grid

#### 4. Instrument 3 high-traffic edge functions as proof-of-concept
Start with the 3 most visible stat-changing functions to log events:
- **`process-company-payroll`** — log morale +1/-3 on payroll success/failure
- **`check-company-bankruptcy`** — log morale -5/-15 and reputation -10 on bankruptcy
- **`complete-gig`** — log morale/reputation/sentiment changes from gig completion

Future passes can instrument the remaining ~45 functions.

#### 5. Version bump + changelog
- `VersionHeader.tsx` → v1.0.995
- `VersionHistory.tsx` → Add changelog entry

### Files to modify/create
- **New migration** — `band_health_events` table + RLS
- **New:** `src/components/band/BandHealthEventLog.tsx`
- **Edit:** `src/components/band/BandOverview.tsx` — Add event log component
- **Edit:** `supabase/functions/process-company-payroll/index.ts` — Log events
- **Edit:** `supabase/functions/check-company-bankruptcy/index.ts` — Log events
- **Edit:** `supabase/functions/complete-gig/index.ts` — Log events
- **Edit:** `src/components/VersionHeader.tsx` — Bump to v1.0.995
- **Edit:** `src/pages/VersionHistory.tsx` — Add changelog entry

