
# Fix Songwriting Collaboration & Complete Company System Integration

## Problem Summary

### Issue 1: Missing "Invite Collaborator" Button in Songwriting
The user sees a "Collaborators" tab in the Create Songwriting Project dialog (as shown in the screenshot), but this tab only contains static checkbox options for generic co-writer types (Specialist Lyricist, Hook Melody Writer, etc.) - not actual player invitations.

The `CollaboratorInviteDialog` and `ProjectCollaboratorsPanel` components exist and are fully functional, but they are NOT integrated into the songwriting workflow. They allow:
- Searching for band members and friends
- Setting compensation (flat fee or royalty split)
- Sending real invitations to players

**Root Cause**: The collaboration invitation system is built but not wired up to the UI.

### Issue 2: Company System Incomplete/Disconnected
The company system is partially implemented:
- **Working**: Company creation, finance management, tax overview, subsidiary creation, routing
- **Placeholder**: Some management pages show "coming soon" messages (Rehearsal Studio, some Venue features)
- **No obvious errors** in current implementation - the hooks and components are functioning

---

## Implementation Plan

### Part 1: Add Invite Collaborator Button to Songwriting

**Approach A (Recommended)**: Add `ProjectCollaboratorsPanel` to the project cards when expanded

Currently, the `SimplifiedProjectCard` shows accepted collaborators but has no way to add new ones. We should:

1. Add an "Invite Collaborator" button to each project card
2. This button opens the `CollaboratorInviteDialog`
3. The existing panel already handles displaying and managing collaborators

**Files to modify:**
- `src/components/songwriting/SimplifiedProjectCard.tsx` - Add invite button and integrate `CollaboratorInviteDialog`

**Code changes:**
```typescript
// Add state and dialog integration
const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

// Add button in the card actions
<Button
  onClick={() => setInviteDialogOpen(true)}
  variant="outline"
  size="sm"
  disabled={isLocked}
>
  <Users className="w-3 h-3 mr-1" />
  Invite
</Button>

// Add dialog at the bottom
<CollaboratorInviteDialog
  open={inviteDialogOpen}
  onOpenChange={setInviteDialogOpen}
  projectId={project.id}
  userBandId={userBandId}
/>
```

**Approach B**: Replace static options in the dialog's Collaborators tab

Instead of the current checkbox list (Specialist Lyricist, Hook Melody Writer, etc.), replace with the `ProjectCollaboratorsPanel` after a project is created.

**Note**: Projects need to be created first before inviting collaborators (the invite system needs a `project_id`). So we need a two-step flow:
1. Create project with basic info
2. Add collaborators after project exists

### Part 2: Complete Company Management Pages

Several management pages need implementation to match the company types:

| Company Type | Management Page | Status |
|--------------|-----------------|--------|
| Security Firm | `/security-firm/:companyId` | ✅ Functional with guards, contracts |
| Merch Factory | `/merch-factory/:companyId` | ✅ Functional with catalog, production, workers |
| Logistics | `/logistics-company/:companyId` | ⚠️ Needs review |
| Venue | `/venue-business/:venueId` | ⚠️ Placeholder tabs |
| Rehearsal Studio | `/rehearsal-studio-business/:studioId` | ⚠️ All placeholder content |
| Recording Studio | `/recording-studio-business/:studioId` | ⚠️ Needs review |

**Files to enhance:**
- `src/pages/RehearsalStudioBusinessManagement.tsx` - Implement staff, equipment, bookings, revenue
- `src/pages/VenueBusinessManagement.tsx` - Complete placeholder sections
- `src/pages/LogisticsCompanyManagement.tsx` - Verify functionality
- `src/pages/RecordingStudioBusinessManagement.tsx` - Verify functionality

---

## Detailed Implementation

### File 1: `src/components/songwriting/SimplifiedProjectCard.tsx`

Add the invite functionality:

1. Import `CollaboratorInviteDialog`
2. Add `userBandId` prop to the component
3. Add state for dialog visibility
4. Add "Invite" button next to existing action buttons
5. Render the dialog

### File 2: `src/pages/Songwriting.tsx`

Pass `userBandId` to the SimplifiedProjectCard:

1. Get `primaryBand` data (already fetched via `usePrimaryBand`)
2. Pass `primaryBand?.id` as `userBandId` prop to each `SimplifiedProjectCard`

### File 3: `src/pages/RehearsalStudioBusinessManagement.tsx` (Enhancement)

Replace placeholder content with functional components:

1. Fetch actual studio data using the `studioId` param
2. Display real booking data
3. Add staff management (using existing company employee patterns)
4. Add equipment inventory
5. Show revenue and financial data

### File 4: Version Updates

- `src/components/VersionHeader.tsx` - Bump to v1.0.531
- `src/pages/VersionHistory.tsx` - Add changelog entry

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/components/songwriting/SimplifiedProjectCard.tsx` | Add "Invite" button and CollaboratorInviteDialog |
| `src/pages/Songwriting.tsx` | Pass userBandId to SimplifiedProjectCard |
| `src/pages/RehearsalStudioBusinessManagement.tsx` | Replace placeholders with functional components |
| `src/components/VersionHeader.tsx` | Bump to v1.0.531 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Technical Notes

### Songwriting Collaboration Flow
1. User creates a songwriting project
2. On the project card, user clicks "Invite" button
3. Dialog shows band members and friends
4. User selects collaborator and sets compensation
5. Invitation is sent and tracked in `songwriting_collaborations` table
6. Collaborator accepts/declines via their pending invitations
7. Accepted collaborators appear on project card
8. When song completes, royalty splits are applied automatically

### Company Subsidiary Types
The company types use a pattern where:
1. `companies` table stores the parent company record
2. Specialized tables (e.g., `security_firms`, `merch_factories`) store type-specific data
3. A trigger `create_specialized_company_record` auto-creates the specialized record when company is inserted
4. Management pages query both the company and specialized tables

This pattern should be followed for any remaining implementations.
