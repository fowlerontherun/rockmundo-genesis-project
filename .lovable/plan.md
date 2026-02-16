

## Record Label Management Overhaul — v1.0.759

### Problem Summary

The label management section has several broken/incomplete flows:
1. **Scout dialog**: Selecting a band and clicking "Send Offer" auto-generates terms and silently creates a contract -- no contract designer is shown
2. **Contracts tab (label owner)**: Shows contracts as read-only cards with no actions -- cannot approve, reject, or review "offered" contracts
3. **Demo acceptance**: Instantly generates and sends a contract with no review step
4. **Signing (activating a contract)**: No mechanism for the label owner to activate an "offered" contract once the artist accepts, or to review pending offers

### Solution

#### 1. Contract Designer Dialog (New Component)

Create `src/components/labels/management/ContractDesignerDialog.tsx` -- a full contract term editor that opens when:
- You select a band in the Scout dialog (instead of silently sending)
- You click "Accept & Offer" on a demo (instead of auto-generating)

The designer lets the label owner customize:
- Advance amount, royalty split (artist/label %), single quota, album quota
- Term length (months), termination fee %, territories
- Manufacturing coverage toggle
- Shows auto-suggested values from `generateContractTerms` as defaults
- Preview of estimated contract value
- "Send Offer" button that creates the contract

#### 2. Enhanced Contracts Tab with Actions

Update `LabelContractsTab.tsx` to include action buttons per contract status:
- **"offered"** contracts: Show "Withdraw Offer" button (sets status to "terminated")
- **"active"** contracts: Show "View Details" expandable section with obligations, release progress, and recoupment
- **"pending"** contracts (artist-requested): Show "Review & Approve" button that opens the Contract Designer pre-filled, and a "Reject" button
- Add contract count badges by status at the top

#### 3. Scout Dialog Flow Fix

Update `ScoutOfferDialog.tsx`:
- When a band is selected and "Send Offer" is clicked, instead of creating the contract directly, open the Contract Designer Dialog with auto-generated terms pre-filled
- The user reviews/adjusts terms, then confirms to actually create the contract

#### 4. Demo Accept Flow Fix

Update `LabelDemosTab.tsx`:
- "Accept & Offer" button opens the Contract Designer Dialog with the demo's band and auto-generated terms
- Contract is only created when the user confirms in the designer

#### 5. Pending Offers Count Badge

Add a count of "offered" and "pending" contracts to the Contracts tab trigger in `LabelManagement.tsx` (similar to how demos shows pending count).

### Technical Details

**Files to create:**
- `src/components/labels/management/ContractDesignerDialog.tsx`

**Files to modify:**
- `src/components/labels/management/ScoutOfferDialog.tsx` -- open designer instead of auto-creating
- `src/components/labels/management/LabelDemosTab.tsx` -- open designer on accept
- `src/components/labels/management/LabelContractsTab.tsx` -- add action buttons for offered/pending/active contracts
- `src/pages/LabelManagement.tsx` -- add pending contract count badge to contracts tab
- `src/components/VersionHeader.tsx` -- bump to 1.0.759
- `src/pages/VersionHistory.tsx` -- add changelog entry

**No database changes needed** -- all contract fields already exist in `artist_label_contracts`.

### Contract Designer Dialog Details

The dialog accepts:
- `bandId`, `bandName`, `bandGenre`, `bandFame`, `bandFans` (for display)
- `labelId`, `labelReputation`
- `songQuality` (optional, from demo)
- `demoSubmissionId` (optional, links demo to contract)
- `existingContractId` (optional, for editing pending contracts)
- `onSuccess` callback

Flow:
1. On open, calls `generateContractTerms` to get suggested defaults
2. Renders editable fields (advance, royalty split slider, quotas, term, territories, termination fee, manufacturing toggle)
3. Shows live contract value estimate
4. "Send Offer" creates the contract in DB, invalidates queries, closes dialog

