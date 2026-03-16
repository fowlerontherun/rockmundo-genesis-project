

## Problem Summary

Three issues to address:

1. **BandFinder links to the wrong page** — Clicking "View Band" in BandFinder navigates to `/bands/:bandId/management`, which shows a full management page (Roster with travel toggles, Rehearsals, Finances). This should instead go to the **public BandProfile** page (`/band/:bandId`) which shows a read-only view of the band.

2. **No "Invite Player" button on the public BandProfile page** — Leaders viewing another band's profile (or their own) via BandProfile have no way to invite players. The invite flow currently only exists in BandManager.

3. **No recruiting/open applications system** — There's no way for a band to mark itself as "recruiting" so other players can discover it and apply to join.

---

## Plan

### 1. Fix BandFinder navigation

In `src/pages/BandFinder.tsx`, change the "View Band" button's `onClick` from:
```
navigate(`/bands/${band.id}/management`)
```
to:
```
navigate(`/band/${band.id}`)
```
This sends users to the read-only `BandProfile` page instead of the management page.

### 2. Add `is_recruiting` column to `bands` table

**Migration:**
```sql
ALTER TABLE public.bands 
ADD COLUMN is_recruiting boolean NOT NULL DEFAULT false;
```

### 3. Create `band_applications` table

**Migration:**
```sql
CREATE TABLE public.band_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  applicant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instrument_role text NOT NULL DEFAULT 'Guitar',
  vocal_role text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, applicant_profile_id)
);

ALTER TABLE public.band_applications ENABLE ROW LEVEL SECURITY;

-- Applicants can view their own applications
CREATE POLICY "Users can view own applications"
  ON public.band_applications FOR SELECT TO authenticated
  USING (applicant_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Anyone authenticated can insert applications
CREATE POLICY "Users can apply to bands"
  ON public.band_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Band leaders can view applications to their band
CREATE POLICY "Leaders can view band applications"
  ON public.band_applications FOR SELECT TO authenticated
  USING (band_id IN (
    SELECT id FROM public.bands WHERE leader_id = auth.uid()
  ));

-- Band leaders can update application status
CREATE POLICY "Leaders can respond to applications"
  ON public.band_applications FOR UPDATE TO authenticated
  USING (band_id IN (
    SELECT id FROM public.bands WHERE leader_id = auth.uid()
  ));
```

### 4. Add recruiting toggle to BandManager Settings

In `BandSettingsTab`, add a toggle for "Open for Recruiting" that updates `bands.is_recruiting`. Only visible to the band leader.

### 5. Enhance BandProfile page

- Show a **"Recruiting"** badge if `is_recruiting` is true
- Show an **"Apply to Join"** button (dialog with instrument/vocal role + message) if:
  - The band is recruiting
  - The viewer is not already a member
  - The viewer hasn't already applied
- Show an **"Invite to Band"** button if the viewer is the band's leader (reuse `InviteFriendToBand` component)
- Add the `is_recruiting` field to the band query

### 6. Add Applications tab to BandManager

Create a `BandApplications` component showing pending applications with Accept/Reject buttons. On accept, insert into `band_members` and update application status. Show this in the BandManager members tab header (next to the Invite Friend button) — or as a separate sub-section.

### 7. Show recruiting badge in BandFinder

Update the BandFinder query to include `is_recruiting`, and show a green "Recruiting" badge on bands that are open.

---

### Files to create/modify

| File | Action |
|------|--------|
| `src/pages/BandFinder.tsx` | Fix navigation, add recruiting badge, query `is_recruiting` |
| `src/pages/BandProfile.tsx` | Add recruiting badge, apply button, invite button for leaders |
| `src/components/band/BandApplicationDialog.tsx` | **New** — Dialog for applying to a band |
| `src/components/band/BandApplicationsList.tsx` | **New** — List of applications for leader to manage |
| `src/components/band/BandSettingsTab.tsx` | Add recruiting toggle |
| `src/pages/BandManager.tsx` | Add applications section in members tab |
| DB migration | Add `is_recruiting` column + `band_applications` table + RLS |

