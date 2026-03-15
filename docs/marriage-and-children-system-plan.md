# Marriage and Children System Plan

## 1) Product Vision
Create a long-term family progression feature where two player-controlled characters can marry, plan a child, and shape the child’s future through parenting choices, genetics, and training. The system should mirror the social depth of Popmundo-style family mechanics while adding richer milestones, co-parent decisions, and meaningful tradeoffs.

---

## 2) Core Design Pillars
1. **Meaningful commitment**: Marriage and parenting should feel like strategic life choices, not a one-click bonus.
2. **Shared ownership**: Both parents participate in key decisions (surname, upbringing, schedule, specialization).
3. **Aging-based progression**: Child capabilities unlock by age and maturity, with full playability at 16.
4. **Inherited identity**: Children inherit partial skill potential and traits from both parents.
5. **Fairness and anti-abuse**: Prevent exploit loops, griefing, and account-farming behavior.

---

## 3) Eligibility Rules

### Marriage prerequisites
- Both characters must be age **18+** in-game.
- Both characters must be free of conflicting legal status (not currently married, not in a cooldown from divorce).
- Optional: minimum relationship value (e.g., 70/100) and minimum acquaintance duration (e.g., 30 in-game days).

### Child creation prerequisites
- Both characters must be age **18+**.
- Both characters must each have at least **one empty character slot**.
- Both players must explicitly confirm parenting consent through a 2-step flow.
- Parents must choose who controls the child account slot before pregnancy/birth finalization.

### Child playability rules
- Age 0–5: NPC-only, parents can make developmental choices.
- Age 6–15: semi-playable “guided mode” (limited actions, school/training focus, no adult systems).
- Age 16+: **fully playable character**.

---

## 4) Feature Flow (Player Journey)

### A) Relationship & Marriage Arc
1. Characters build relationship through interactions/events.
2. One player proposes; the other accepts/declines.
3. Marriage event is scheduled (optional social event with guests/bonuses).
4. Married status unlocks family dashboard and child planning.

### B) Child Planning Arc
1. Parent A opens “Plan Child” panel.
2. System validates rules: age 18+, marriage/partnership status, empty slot for both.
3. Parent A sends child request to Parent B.
4. Parent B reviews:
   - parenting cost preview,
   - cooldown impacts,
   - controller assignment options.
5. Both parents sign off and select:
   - **controlling parent/player**,
   - surname policy,
   - upbringing focus (balanced, artistic, academic, athletic, social).
6. Child enters gestation timer (or equivalent lore-friendly countdown).
7. Birth event generates child profile and assigns slot to chosen controller.

### C) Growth Arc
- Child receives periodic growth events (age-ups, school outcomes, behavioral events).
- Parents choose from branching responses that influence traits and growth curves.
- At 16, unlock ceremony marks full character control and full systems access.

---

## 5) Inheritance & Skill System

### Skill inheritance model
Use a weighted hybrid formula combining:
1. **Base potential by parent skills** (e.g., average + weighted best-parent contribution).
2. **Trait modifiers** (discipline, creativity, charisma, resilience).
3. **Upbringing modifiers** from player decisions during ages 0–15.
4. **Random variance band** to keep outcomes unique.

### Example inheritance formula (initial potential score)
For each skill domain `D`:
- `InheritedPotential[D] = 0.45 * Parent1Skill[D] + 0.45 * Parent2Skill[D] + 0.10 * RandomVariance`
- Apply trait/upbringing multipliers in a bounded range (e.g., ±15%).
- Clamp within domain limits by child age tier.

### Skill domain suggestions
- Musicality (vocals/instrument)
- Performance
- Composition/Songwriting
- Social influence
- Business acumen
- Fitness/health

### Balance constraints
- Hard cap inherited starting skill so children never bypass progression.
- Inheritance affects **potential growth rate** more than raw starting power.
- Rare “talent spike” chance from high-synergy parent pairings.

---

## 6) Systems Detail for Engagement

### Parenting decision events
- School type selection (public/private/arts/elite).
- Mentor opportunities (costly but boosts specific tracks).
- Life events (injury, rivalries, confidence slumps, breakthrough moments).
- Co-parent conflict events requiring consensus or tie-break systems.

### Family relationship simulation
- Parent-child bond and co-parent harmony values.
- Strong bond grants morale and discipline boosts.
- Neglect/conflict introduces stress debuffs or slower progression.

### Social layer
- Public announcements (weddings, births, coming-of-age events).
- Optional media/publicity consequences for high-fame families.
- Family legacy page tracking generations and notable achievements.

---

## 7) Data Model (High-Level)

### New/extended entities
- `marriages`
  - `id`, `character_a_id`, `character_b_id`, `status`, `started_at`, `ended_at`
- `child_requests`
  - `id`, `parent_a_id`, `parent_b_id`, `controller_parent_id`, `status`, `expires_at`
- `children`
  - `id`, `parent_a_id`, `parent_b_id`, `controller_player_id`, `birth_date`, `age`, `playability_state`
- `child_traits`
  - normalized trait stats and modifiers
- `child_skill_potential`
  - per-domain inherited potential values
- `parenting_events`
  - event history, choices made, outcomes

### Critical constraints
- Unique active marriage per character.
- Child request must store both-slot-availability snapshot and revalidate on acceptance.
- Controller assignment immutable after a lock window (or expensive legal transfer process).

---

## 8) Backend Logic & Jobs

### Real-time checks
- Validate age and slot availability at proposal and acceptance.
- Race-condition protection with transactional locking.

### Scheduled jobs
- Age progression ticks.
- Child event generation by age bracket.
- Playability state transitions (6, 16 milestones).

### Audit & moderation
- Action logs for proposals, acceptances, controller assignment, and ownership transfer.
- Abuse heuristics: repeated child creation/deletion loops, suspicious transfer patterns.

---

## 9) UX/UI Requirements

### New interfaces
- Relationship panel (proposals, status, anniversaries).
- Marriage management page.
- Family dashboard (children overview, milestones, decisions).
- Child profile page with timeline + inheritance breakdown.

### Decision UX principles
- Show consequences before confirmation.
- Co-parent action history must be transparent.
- Time-sensitive decisions should include reminders and grace windows.

---

## 10) Anti-Abuse, Fairness, and Safety
- Cooldowns on marriage/divorce/re-marriage and consecutive child planning.
- Minimum account age or trust level before participating in family creation.
- Optional consent reconfirmation for high-impact actions.
- Guardrails against multi-account exploitation (risk flags + review workflows).

---

## 11) Implementation Roadmap

### Phase 1: Foundations
- Marriage entity/state machine.
- Eligibility checks (18+, slot checks).
- Child request and dual-consent workflow.

### Phase 2: Child lifecycle baseline
- Birth creation flow.
- Age progression and playability gates (0–5, 6–15, 16+).
- Basic inherited potential generation.

### Phase 3: Depth and engagement
- Parenting event system.
- Co-parent decision mechanics.
- Family legacy page and social announcements.

### Phase 4: Balance and polish
- Tuning inheritance curves and event frequencies.
- Anti-abuse improvements and analytics-driven balancing.
- Localization, tooltips, and onboarding tutorials.

---

## 12) Success Metrics
- Marriage participation rate among eligible players.
- Child creation completion rate (request → birth).
- Child retention to age 16.
- Average weekly family interactions per parent.
- Abuse flag rate and false-positive review outcomes.

---

## 13) Open Design Questions
1. Is marriage required for child planning, or is long-term partnership enough?
2. Can controller ownership transfer later, and at what cost?
3. Should coming-of-age unlock be exactly 16 or configurable per server rules?
4. What level of inherited fame/social capital is fair for legacy balance?
5. How to handle inactive controller players after child reaches 16?

---

## 14) MVP Acceptance Criteria
- Two age-eligible characters can marry.
- Child creation requires both parents age 18+ and both with empty character slots.
- Parents can choose controlling parent during child creation.
- Child cannot be fully playable until age 16.
- Child inherits configurable, bounded portions of both parents’ skill potentials.
