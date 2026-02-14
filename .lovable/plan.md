

# Record Label Overhaul: Contracts, Offers, and Label-Owned Studios (v1.0.656)

## Overview

Three interconnected improvements to the record label experience:

1. **Contract Offers Hub** -- A dedicated, prominent section where players can view, compare, and accept/reject all pending offers (from demos AND scout offers) in one place
2. **Simplified Contract Obligations** -- Clear "what you owe" dashboard showing deadlines, quotas, and timelines for active contracts
3. **Label-Owned Studio Integration** -- Labels with parent companies that own recording studios give signed artists free recording at those studios

---

## 1. Contract Offers Hub

### Problem
Currently, contract offers appear inline in the "Contracts" tab but are easy to miss. There's no notification badge or dedicated view. Scouted offers and demo-based offers are handled separately.

### Solution
- Add a **notification badge** on the "Contracts" tab showing the number of pending offers
- Move offers to a prominent **top section** with an eye-catching design (pulsing border, "Action Required" header)
- Add a **deadline/expiry** for offers (new `expires_at` column on `artist_label_contracts` for offers) so players feel urgency
- Show a **plain-English summary** of obligations: "You must deliver X singles and Y albums within Z months. You'll receive $X upfront. You keep X% of royalties."
- Add an **"Obligations Summary"** card inside ContractOfferCard showing deadlines in simple terms

### Technical Changes
- Add `expires_at` column to `artist_label_contracts` (nullable, set when status='offered')
- Update `ContractOfferCard.tsx` to include:
  - Countdown timer showing time remaining to accept
  - "Your Obligations" section in plain English
  - Clearer accept/reject buttons with confirmation dialog
- Update `MyContractsTab.tsx` to show offer count badge and prioritize offers at top
- Auto-expire offers after 7 game days (via existing cron or new logic)

---

## 2. Active Contract Obligations Dashboard

### Problem
Active contracts show progress bars but don't clearly communicate deadlines or what happens if you fail to deliver.

### Solution
Add an **"Obligations"** panel to each active contract card showing:
- Time remaining on the contract (e.g., "18 months left")
- Release deadlines: "3 singles due, 2 delivered -- 1 remaining by [date]"
- Recoupment status in plain terms: "You've paid back $X of your $Y advance. Royalties go to the label until recouped."
- Warning indicators when behind schedule (red badges for overdue quotas)
- What territories you're committed to

### Technical Changes
- Update the active contract rendering in `MyContractsTab.tsx` to add:
  - A "Your Obligations" summary section
  - Deadline warnings (calculated from `start_date`, `end_date`, quotas)
  - Color-coded status: green (on track), amber (falling behind), red (overdue)

---

## 3. Label-Owned Studio: Free Recording for Signed Artists

### Problem
Labels can be subsidiaries of companies that also own recording studios, but there's no in-game benefit -- signed artists still pay full price.

### Solution
When booking a recording session, check if the artist's label is owned by a company that also owns a recording studio. If so, that studio should appear with a **"FREE -- Label Studio"** badge and zero cost.

### How It Works

```text
Artist has active contract with Label A
  -> Label A has company_id = Company X
  -> Company X also owns Studio B (city_studios.company_id = Company X)
  -> Studio B appears as FREE when artist books a session
```

### Technical Changes
- Update `StudioSelector.tsx`:
  - Accept optional `labelCompanyId` prop
  - Query `city_studios` and mark any studio with matching `company_id` as "Label Studio (Free)"
  - Show a badge/tag on those studios
- Update `SessionConfigurator.tsx`:
  - When studio is label-owned and artist is signed to that label's company, set cost to $0
  - Show "Covered by [Label Name]" instead of the price
- Update `RecordingWizard.tsx` to pass the label company ID through to StudioSelector
- Add a helper function to check if the current band/artist has a label with a parent company that owns studios

---

## 4. Label Directory Interactivity

### Problem
The label directory is informational but static. You can only "Submit Demo" -- there's no way to see what you'd be getting into.

### Solution
- Add a **"View Details"** expansion on each label card showing:
  - What deal types they typically offer
  - Average advance range
  - Current roster with names (public info)
  - Recent releases
- Add genre match indicator: shows how well your band's genre matches the label's focus

### Technical Changes
- Update `LabelDirectory.tsx` to add expandable detail sections using Collapsible or Accordion
- Query `artist_label_contracts` (active, non-sensitive fields) to show roster
- Query `label_releases` to show recent releases
- Calculate genre match percentage between band genre and label's `genre_focus`

---

## 5. Version Update

- Bump version to **v1.0.656**
- Add changelog entry covering all three improvements

## Files to Create
- None (all changes are to existing files)

## Files to Modify
- `src/components/labels/ContractOfferCard.tsx` -- add obligations summary, countdown, confirmation dialog
- `src/components/labels/MyContractsTab.tsx` -- offer count badge, obligations dashboard for active contracts, warning indicators
- `src/components/labels/LabelDirectory.tsx` -- expandable label details, genre match, roster preview
- `src/components/recording/StudioSelector.tsx` -- label-owned studio detection and free badge
- `src/components/recording/SessionConfigurator.tsx` -- zero cost for label-owned studios
- `src/components/recording/RecordingWizard.tsx` -- pass label company ID to studio selector
- `src/components/VersionHeader.tsx` -- bump to v1.0.656
- `src/pages/VersionHistory.tsx` -- add changelog entry
- Database migration: add `expires_at` to `artist_label_contracts`

