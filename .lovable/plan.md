

## Marriage and Children System — Phase 1 Implementation (v1.1.036)

This is a large feature. Following the plan doc's roadmap, this implements **Phase 1 (Foundations)** and **Phase 2 (Child Lifecycle Baseline)** to deliver functional marriage, proposal/wedding flow, child planning with dual consent, and basic child profile creation. Phase 3 (parenting events, co-parent decisions, family legacy page with live data) and Phase 4 (tuning, anti-abuse) will follow in future versions.

---

### What Players Will Experience

1. **Proposal and Marriage** — When a romance reaches the "engaged" stage, a "Plan Wedding" button appears. The player schedules a wedding (optional guests, venue flavor). Both partners confirm. Marriage record is created, romance stage updates to "married", and an activity feed announcement is posted.

2. **Family Dashboard** — The currently-empty "Family" tab on the Relationships page becomes a live dashboard showing the player's marriage status, partner info, children, and a "Plan Child" button.

3. **Child Planning** — Married players can initiate child planning. The system validates both parents are 18+, married, and have empty character slots. A child request is sent to the partner for dual consent. Both choose a controlling parent and surname policy. After confirmation, a gestation timer starts (7 in-game days). On birth, a child profile is created in the controller's character slot.

4. **Child Profiles** — Children appear in the family tree with age, inherited trait potentials, and playability state (NPC at 0-5, guided at 6-15, full at 16+).

---

### Database Schema

**New tables (SQL migration):**

```
marriages
  id uuid PK
  partner_a_id uuid FK profiles(id)
  partner_b_id uuid FK profiles(id)
  status text CHECK (proposed, accepted, active, separated, divorced)
  proposed_at timestamptz
  wedding_date timestamptz
  started_at timestamptz
  ended_at timestamptz
  ended_by uuid
  end_reason text
  metadata jsonb DEFAULT '{}'
  created_at, updated_at
  UNIQUE active marriage constraint (only one active per profile)

child_requests
  id uuid PK
  parent_a_id uuid FK profiles(id)
  parent_b_id uuid FK profiles(id)
  marriage_id uuid FK marriages(id)
  controller_parent_id uuid FK profiles(id)
  surname_policy text CHECK (parent_a, parent_b, hyphenated, custom)
  custom_surname text
  upbringing_focus text CHECK (balanced, artistic, academic, athletic, social)
  status text CHECK (pending, accepted, rejected, expired, completed)
  expires_at timestamptz
  gestation_ends_at timestamptz
  created_at, updated_at

player_children
  id uuid PK
  parent_a_id uuid FK profiles(id)
  parent_b_id uuid FK profiles(id)
  controller_user_id uuid FK auth.users(id)
  child_profile_id uuid FK profiles(id) NULLABLE (linked when born)
  child_request_id uuid FK child_requests(id)
  marriage_id uuid FK marriages(id)
  name text
  surname text
  birth_game_date jsonb
  current_age int DEFAULT 0
  playability_state text CHECK (npc, guided, playable) DEFAULT 'npc'
  inherited_potentials jsonb DEFAULT '{}'
  traits jsonb DEFAULT '[]'
  emotional_stability int DEFAULT 50
  bond_parent_a int DEFAULT 50
  bond_parent_b int DEFAULT 50
  created_at, updated_at
```

**RLS policies:**
- Players can read marriages/children/requests where they are a participant
- Players can insert child_requests where they are parent_a
- Players can update child_requests where they are parent_b (accept/reject)
- Read-all for admins via `has_role()`

**Game config:** No config entry needed for Phase 1; marriage unlocks organically from the romance system.

---

### Frontend Files

1. **`src/hooks/useMarriage.ts`** — Queries and mutations:
   - `useMarriageStatus(profileId)` — fetch active marriage
   - `useProposeMarriage()` — create marriage record from engaged romance
   - `useAcceptProposal()` / `useDeclineProposal()`
   - `useInitiateDivorce()`

2. **`src/hooks/useChildPlanning.ts`** — Queries and mutations:
   - `useChildRequests(profileId)` — pending/active requests
   - `usePlayerChildren(profileId)` — born children
   - `useRequestChild()` — validate eligibility, create request
   - `useRespondToChildRequest()` — accept/reject
   - `useCompleteChildBirth()` — triggered when gestation ends, creates child profile with inherited potentials

3. **`src/components/family/MarriageStatusCard.tsx`** — Shows current marriage: partner name, anniversary, status badge, divorce button

4. **`src/components/family/ProposalDialog.tsx`** — Modal for proposing wedding from engaged romance; partner confirmation flow

5. **`src/components/family/ChildPlanningDialog.tsx`** — Multi-step dialog: eligibility check → controller selection → surname/upbringing → send request. Partner view: review and accept/reject.

6. **`src/components/family/ChildCard.tsx`** — Display card for a child: name, age, playability state, inherited potential preview, bond gauges

7. **`src/components/family/FamilyDashboard.tsx`** — Assembled dashboard component combining marriage status, children list, pending requests, and "Plan Child" CTA. Replaces the placeholder in the Relationships page Family tab.

8. **Edit `src/pages/Relationships.tsx`** — Replace the empty Family tab placeholder with `<FamilyDashboard />` wired to real data from the new hooks.

9. **Edit `src/components/social/RomanticProgressionPanel.tsx`** — Add "Plan Wedding" button when stage is "engaged" and no active marriage exists.

10. **SQL migration** — Tables, RLS, and a helper function `check_marriage_eligibility(profile_id)` that validates no active marriage + romance at engaged/married stage.

11. **Version bump** to 1.1.036 + changelog entry.

---

### Inheritance Formula (implemented in `useCompleteChildBirth`)

```
For each skill domain:
  potential = 0.45 * parentA_skill + 0.45 * parentB_skill + 0.10 * random(-10, 10)
  potential *= upbringing_modifier (±15% based on focus)
  potential = clamp(potential, 1, 20)  // Never starts above 20
```

The child's `inherited_potentials` JSON stores growth rate multipliers per domain, not raw skill values. This ensures children don't bypass progression.

---

### Technical Notes

- Marriage is a separate entity from `romantic_relationships`. The romance tracks emotional scores; the marriage tracks legal state. They reference each other via `partner_a_id`/`partner_b_id` matching.
- Child requests expire after 7 in-game days if not accepted.
- Gestation period is 7 in-game days after acceptance.
- The existing `FamilyLegacyPanel.tsx` component will be reused inside `FamilyDashboard` once real data is available.
- Character slot validation uses the existing `useCharacterSlots` hook.
- All DB writes use `asAny()` wrapper consistent with existing codebase patterns for type safety workarounds.

