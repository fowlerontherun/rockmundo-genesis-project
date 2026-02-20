

## Record Contract Negotiation System - v1.0.839

### Problem
Contract offers exist in the database and the `ContractOfferCard` component has Accept/Reject/Counter-Offer buttons, but:
- The offer query only fetches contracts with status `offered`, so once you counter-offer (status changes to `negotiating`), the card vanishes
- There is no label auto-response logic -- countering just sets the status and nothing happens
- There is no tracking of how many counter-offers have been made (3-strike limit)
- There is no "likelihood of acceptance" indicator
- Inbox notifications exist for new offers but don't deep-link to actionable buttons

### Plan

#### 1. Database Migration
Add columns to `artist_label_contracts` to support the negotiation loop:
- `counter_count` (integer, default 0) -- tracks how many times the player has countered
- `original_advance` (integer) -- stores the label's original offer terms for comparison
- `original_royalty_pct` (integer) -- original royalty percentage
- `original_single_quota` (integer) -- original single quota
- `original_album_quota` (integer) -- original album quota
- `last_action_by` (text, default 'label') -- who made the last move: 'label' or 'artist'

#### 2. Update ContractOfferCard to Handle Negotiating Status
- Expand the query in `MyContractsTab.tsx` to fetch contracts with status `offered` OR `negotiating` (where `last_action_by = 'label'`, meaning the label has responded)
- Show the label's counter-terms alongside the player's original request
- Display a "Likelihood of Acceptance" progress bar based on:
  - How close the player's ask is to the original offer
  - How many counters have been used (decreases with each round)
  - Formula: starts at ~70%, drops ~20% per counter round, and further drops based on how aggressive the ask is

#### 3. Label Auto-Response Logic
When the player submits a counter-offer, add client-side logic (in the counter-offer mutation's `onSuccess`) that simulates the label responding after a brief delay:
- **Round 1-2**: The label meets the player partway (moves 30-50% toward the player's ask from the original terms) and sets `last_action_by = 'label'`, `status = 'offered'` so the card reappears
- **Round 3**: The label auto-rejects (`status = 'rejected'`) -- the player pushed too hard
- Each label response slightly adjusts the contract terms and increments tracking

#### 4. Acceptance Likelihood Bar
Add a visual progress bar on the `ContractOfferCard` showing how likely the label is to accept if the player hits "Accept" or how risky a counter is:
- Green zone (60-100%): Label is receptive
- Yellow zone (30-59%): Getting risky
- Red zone (0-29%): Label likely to walk away
- The bar factors in: counter_count, difference from original terms, and label reputation

#### 5. Inbox Notification Enhancement
The existing `ContractDesignerDialog` already sends inbox notifications with deep-links. This plan will also send a notification when the label responds to a counter-offer, so the player gets notified in their inbox with a "Review Counter" CTA that scrolls to the offer card.

### Technical Details

**Files to modify:**
- **Database migration**: Add `counter_count`, `original_advance`, `original_royalty_pct`, `original_single_quota`, `original_album_quota`, `last_action_by` columns
- **`src/components/labels/MyContractsTab.tsx`**: Update the contract offers query to include `negotiating` status offers where label has responded
- **`src/components/labels/ContractOfferCard.tsx`**: Add acceptance likelihood bar, show counter round indicator (e.g., "Counter 1 of 3"), update counter mutation to store originals on first counter and trigger label auto-response
- **`src/components/labels/ContractNegotiationDialog.tsx`**: Add the likelihood bar and counter-round warning here too
- **`src/components/VersionHeader.tsx`**: Bump to v1.0.839
- **`src/pages/VersionHistory.tsx`**: Add changelog entry

**Negotiation flow:**

```text
Label sends offer (status: 'offered', last_action_by: 'label')
  |
  +--> Player ACCEPTS --> status: 'accepted_by_artist'
  |
  +--> Player REJECTS --> status: 'rejected'
  |
  +--> Player COUNTERS (round 1) --> status: 'negotiating', counter_count: 1
       |
       Label auto-responds (meets halfway) --> status: 'offered', last_action_by: 'label'
       |
       +--> Player ACCEPTS revised terms
       |
       +--> Player COUNTERS (round 2) --> counter_count: 2
            |
            Label auto-responds (smaller concession) --> status: 'offered'
            |
            +--> Player ACCEPTS
            |
            +--> Player COUNTERS (round 3) --> counter_count: 3
                 |
                 Label AUTO-REJECTS --> status: 'rejected'
                 Inbox notification: "Label walked away"
```

