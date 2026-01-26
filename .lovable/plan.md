

# Collaborative Songwriting System

## Overview
Add the ability to invite band members or friends to co-write songs together. Band members can join directly, while non-band members must agree to either a one-off writing fee or a royalty percentage offer.

## Database Schema

### New Table: `songwriting_collaborations`
```text
┌─────────────────────────────────────────────────────────────────┐
│                   songwriting_collaborations                    │
├─────────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                            │
│ project_id          UUID → songwriting_projects (FK)            │
│ inviter_user_id     UUID → auth.users (FK)                      │
│ invitee_profile_id  UUID → profiles (FK)                        │
│ status              ENUM (pending, accepted, declined, expired) │
│ is_band_member      BOOLEAN                                     │
│ compensation_type   ENUM (none, flat_fee, royalty)              │
│ flat_fee_amount     NUMERIC (null if royalty)                   │
│ royalty_percentage  NUMERIC (null if flat_fee)                  │
│ fee_paid            BOOLEAN DEFAULT false                       │
│ contribution_notes  TEXT                                        │
│ invited_at          TIMESTAMPTZ                                 │
│ responded_at        TIMESTAMPTZ                                 │
│ created_at / updated_at                                         │
└─────────────────────────────────────────────────────────────────┘
```

### New Enum: `collaboration_compensation_type`
Values: `none`, `flat_fee`, `royalty`

### New Enum: `collaboration_status`
Values: `pending`, `accepted`, `declined`, `expired`

## Technical Implementation

### 1. Migration File
- Create `songwriting_collaborations` table with foreign keys
- Add enums for compensation type and status
- Enable RLS with policies for:
  - Inviters can view/create/update their own invitations
  - Invitees can view and respond to invitations addressed to them
- Add unique constraint on `(project_id, invitee_profile_id)` to prevent duplicate invitations

### 2. New Hook: `useCollaborationInvites`
Location: `src/hooks/useCollaborationInvites.ts`

Functions:
- `fetchProjectCollaborators(projectId)` - Get all collaborators for a project
- `inviteCollaborator(params)` - Send invitation with compensation details
- `respondToInvitation(id, accept)` - Accept or decline invitation
- `cancelInvitation(id)` - Withdraw pending invitation
- `payFlatFee(collaborationId)` - Process one-off payment

### 3. New Component: `CollaboratorInviteDialog`
Location: `src/components/songwriting/CollaboratorInviteDialog.tsx`

Features:
- Search for band members and friends
- Band members shown at top with "No fee required" badge
- Friends/non-members show compensation options:
  - Flat fee input ($50 - $10,000 range)
  - Royalty percentage slider (5% - 50%)
- Preview of offer before sending
- Validation: Check inviter has enough cash for flat fee

### 4. New Component: `CollaborationOfferCard`
Location: `src/components/songwriting/CollaborationOfferCard.tsx`

For invitees to view and respond to offers:
- Show project details (title, genre, current progress)
- Display compensation offer clearly
- Accept / Decline buttons
- For royalty offers: Show estimated earnings based on song quality

### 5. New Component: `ProjectCollaboratorsPanel`
Location: `src/components/songwriting/ProjectCollaboratorsPanel.tsx`

Displays on project detail/edit view:
- List of current collaborators with status badges
- Pending invitations with cancel option
- "Invite Collaborator" button

### 6. Updates to Existing Components

**SimplifiedProjectCard.tsx**
- Add collaborator avatars/count indicator
- Show "Collaboration" badge for projects with active collaborators

**Songwriting.tsx**
- Add "Collaborators" section in project creation/edit forms
- Integrate `ProjectCollaboratorsPanel` in project detail view

**SongCompletionDialog.tsx**
- Show collaborator splits before finalizing
- Confirm royalty percentages are correctly applied to finished song

### 7. Payment Flow for Flat Fees

When invitee accepts a flat fee offer:
1. Check inviter has sufficient `profiles.cash`
2. Deduct fee from inviter's cash
3. Add fee to invitee's cash
4. Mark `fee_paid = true` on collaboration record
5. Record transaction in a new `collaboration_payments` audit table

### 8. Royalty Integration

When song is completed from project:
- Collect all accepted royalty collaborators
- Calculate splits: Original writer gets `100 - sum(royalty_percentages)`
- Populate `songs.co_writers` array with collaborator names
- Populate `songs.split_percentages` array with percentages
- Create `band_song_ownership` records for each collaborator

## User Flows

### Flow 1: Invite Band Member
```text
1. Open songwriting project → Click "Invite Collaborator"
2. See band members listed first (fetched from band_members table)
3. Select band member → Shows "No compensation required"
4. Click "Send Invitation"
5. Band member receives notification → Can accept/decline
6. If accepted: Collaborator added to project
```

### Flow 2: Invite Friend (Flat Fee)
```text
1. Open songwriting project → Click "Invite Collaborator"
2. Search friends (from friendships table)
3. Select friend → Choose "One-off Writing Fee"
4. Enter fee amount (e.g., $500)
5. Click "Send Offer"
6. Friend receives notification with offer details
7. Friend accepts → Fee transferred immediately
8. Collaborator added to project
```

### Flow 3: Invite Friend (Royalty)
```text
1. Open songwriting project → Click "Invite Collaborator"
2. Search friends → Select friend
3. Choose "Royalty Split" → Set percentage (e.g., 15%)
4. Click "Send Offer"
5. Friend reviews offer (sees estimated earnings)
6. Friend accepts → No immediate payment
7. When song completes: 15% of all future royalties go to collaborator
```

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/[timestamp]_add_songwriting_collaborations.sql` | Database schema |
| `src/hooks/useCollaborationInvites.ts` | Data fetching and mutations |
| `src/components/songwriting/CollaboratorInviteDialog.tsx` | Invitation UI |
| `src/components/songwriting/CollaborationOfferCard.tsx` | Offer response UI |
| `src/components/songwriting/ProjectCollaboratorsPanel.tsx` | Collaborators list |

### Modified Files
| File | Changes |
|------|---------|
| `src/integrations/supabase/types.ts` | Auto-generated type updates |
| `src/pages/Songwriting.tsx` | Add collaborator panel integration |
| `src/components/songwriting/SimplifiedProjectCard.tsx` | Show collaborator indicators |
| `src/components/songwriting/SongCompletionDialog.tsx` | Show royalty splits |
| `src/utils/bandRoyalties.ts` | Extend for collaboration royalties |
| `src/components/VersionHeader.tsx` | Version bump to 1.0.524 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

## Version Update
- Bump to **v1.0.524**
- Changelog: "Songwriting: Added collaborative songwriting with band member and friend invitations, flat fee and royalty compensation options"

