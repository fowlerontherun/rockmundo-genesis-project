# Rockmundo RP Expansion & Modernization — Full Implementation Plan

## Document Control
- **Owner:** Product + Design + Gameplay Engineering
- **Contributors:** Frontend, Backend, Data, LiveOps, Community, Moderation
- **Status:** Draft for implementation planning
- **Target Horizon:** 12–18 months (phased)
- **Last Updated:** 2026-03-25

---

## 1. Executive Summary

This document provides a granular implementation blueprint to expand Rockmundo’s role-playing systems by:

1. Building on existing systems already present in the codebase (identity traits, reputation axes, romance stages, family systems, social drama, elections, nightlife).
2. Capturing the long-form social simulation strengths associated with Popmundo-style gameplay (institutional power, persistent consequences, life simulation continuity).
3. Modernizing the stack with event-sourced consequences, user-generated narrative tooling, opt-in AI assist, and robust trust & safety controls.

The core strategic objective is to transform RP from “feature islands” into a **cohesive living world simulation** where actions generate delayed, interpretable, and socially propagated consequences.

---

## 2. Product Goals & Non-Goals

### 2.1 Goals
- Deliver persistent RP loops with visible cause/effect across social, career, family, civic, and economy systems.
- Introduce player-run institutions with meaningful levers (city governance, events, organizations).
- Complete family legacy gameplay into multigenerational progression.
- Enable social platforms (Twaater/DikCok) to become simulation amplifiers, not cosmetic side channels.
- Provide scalable moderation/compliance architecture for higher narrative complexity.

### 2.2 Non-Goals
- Full simulation parity with any legacy title in v1.
- Fully autonomous AI storytelling without human/player control.
- Unbounded sandbox without anti-abuse constraints.

---

## 3. Current-State Baseline (Rockmundo)

### 3.1 Existing RP-Relevant Foundation
- Character identity, traits, reputation axes, NPC relationships.
- Romance stage progression with emotional/reputation implications.
- Family dashboard + child planning flow scaffolding.
- Social drama event categories and media outlet model.
- Social hubs and channels framing.
- City election flow and candidacy/voting surfaces.
- Nightlife risk/reward design direction.

### 3.2 Gaps to Address
- Weak global consequence chaining between systems.
- Limited institutional power depth and city-level policy impact.
- Incomplete long-horizon family lifecycle and dynasty gameplay.
- Social media lacks robust narrative causality / audience segmentation.
- Missing contract/legal depth for trust and betrayal gameplay.
- UGC narrative systems and moderation pipelines are underdeveloped.

---

## 4. Guiding Design Principles

1. **Meaningful Consequence:** Every major action creates traceable outcomes.
2. **Player Agency First:** Players choose branch points; systems resolve outcomes.
3. **Readable Simulation:** Explanations must be visible (“why this happened”).
4. **Opt-In Intensity:** Drama depth should be adjustable by player preference.
5. **Fairness and Safety:** Abuse prevention and consent are first-class design concerns.
6. **Composable Systems:** New mechanics integrate with existing progression and economy.

---

## 5. Program Architecture Overview

### 5.1 Platform Layers
- **Gameplay Actions Layer:** User actions (social, career, governance, family, nightlife).
- **Consequence Engine Layer:** Event ingest, rule evaluation, delayed outcomes, propagation.
- **Narrative Layer:** Social cards, media copy, timeline updates, notifications.
- **Moderation Layer:** Guardrails, fraud/risk detection, policy enforcement.
- **Analytics Layer:** Telemetry, balancing dashboards, cohort/retention monitoring.

### 5.2 Canonical Pattern
Use a hybrid event-sourcing model:
- **Action Events** (immutable): what happened.
- **State Projections** (query-optimized): current reputation, trust, policy, dynasty, etc.
- **Scheduled Resolutions**: delayed outcomes and arc continuations.

---

## 6. Epic A — Living Reputation Graph

## A.1 Scope
Evolve current global reputation scores into a graph-based model with multi-context perception.

## A.2 Data Model

### New Tables
1. `reputation_entities`
   - `id`, `entity_type` (`player`, `band`, `npc`, `media_outlet`, `city_faction`), `entity_id`, `created_at`

2. `reputation_edges`
   - `id`, `source_entity_id`, `target_entity_id`, `context` (`global`, `genre`, `city`, `relationship`, `institution`), `axis`, `score`, `confidence`, `decay_rate`, `updated_at`

3. `reputation_events_v2`
   - `id`, `actor_entity_id`, `subject_entity_id`, `event_type`, `axis_impacts_json`, `context`, `explainability_payload_json`, `created_at`

4. `reputation_decay_jobs`
   - `id`, `edge_id`, `run_at`, `decay_delta`, `status`

### Migration Strategy
- Backfill current axis scores into `global` context edges.
- Keep legacy table as compatibility projection for existing UI.

## A.3 Domain Rules
- Base change = event intensity × source credibility × audience relevance.
- Confidence weighted by source quality (trusted outlets > gossip channels).
- Decay curve context-specific (tabloid scandals decay faster than legal convictions).
- Contradictory events reduce confidence before score inversion.

## A.4 API Endpoints
- `GET /reputation/:entityId/overview`
- `GET /reputation/:entityId/timeline?context=...`
- `POST /reputation/events` (internal service only)
- `GET /reputation/:entityId/explain/:edgeId`

## A.5 Frontend
- Reputation radar by context.
- “Why changed?” drawer listing top contributing events.
- Trend graph with confidence overlays.

## A.6 Telemetry
- Reputation volatility index per cohort.
- Explainability panel open-rate.
- Correlation with retention and social interactions.

---

## 7. Epic B — Institutional RP (City Governance 2.0)

## B.1 Scope
Extend election system into policy-and-consequence gameplay.

## B.2 Office Model
### Roles
- Mayor
- Police Chief
- Chief Justice
- Cultural Director

### Powers (Examples)
- **Mayor:** city tax bands, grants, festival permits.
- **Police Chief:** nightlife raid probability, underworld crackdowns.
- **Chief Justice:** sentencing leniency multipliers, appeal windows.
- **Cultural Director:** city funding bias for genres/events.

## B.3 Data Model
- `city_offices`
- `city_office_terms`
- `city_policy_snapshots`
- `city_policy_votes`
- `city_budget_ledgers`
- `city_citizen_approval`

## B.4 Election Enhancements
- Manifesto system with policy promises.
- Debate events with rhetoric checks and fact-check risk.
- Campaign spending + disclosure ledger.
- End-of-term report cards.

## B.5 Consequence Integration
- City policy modifies:
  - Nightlife risk table
  - Venue permit rates
  - Event insurance costs
  - Underworld activity visibility
  - Fan sentiment by city demographics

## B.6 Abuse Controls
- Anti-alt account candidacy checks.
- Campaign finance anomaly detection.
- Office action cooldowns and audit trails.

---

## 8. Epic C — Family & Dynasty Lifecycle

## C.1 Scope
Complete the family arc from marriage through child maturity and dynasty systems.

## C.2 Core Flows
1. Relationship progression to engagement.
2. Marriage event and legal status changes.
3. Child planning with explicit dual consent.
4. Gestation countdown and birth completion.
5. Age-bracket progression with milestone events.
6. Age 16 unlock and dynasty transition.

## C.3 Subsystems
### Parenting Decision Engine
- Event pools by age bracket.
- Branching outcomes mapped to trait vectors.
- Parent disagreement resolution mechanic.

### Dynasty Systems
- Family tree persistence.
- Inherited social capital model (bounded).
- Legacy pressure mechanic (expectation stress).
- Intergenerational rivalry carryover.

## C.4 Data Model
- `family_units`
- `child_development_tracks`
- `parenting_decisions`
- `dynasty_reputation`
- `dynasty_events`

## C.5 Balancing Constraints
- Inheritance boosts growth potential, not immediate power.
- Hard gates prevent new-character progression skips.
- Legacy advantages offset by pressure and expectation penalties.

## C.6 UX Requirements
- Family dashboard timeline.
- Co-parent action queue with reminders.
- Child milestone recap cards.
- Dynasty hall-of-records view.

---

## 9. Epic D — Social Narrative Engine (Twaater/DikCok)

## D.1 Scope
Turn social channels into causal RP dissemination systems.

## D.2 Narrative Card Pipeline
1. Ingest consequence events.
2. Generate candidate narrative cards (tone variants).
3. Rank by relevance, novelty, and audience fit.
4. Publish to segmented feeds.
5. Track response and propagate downstream effects.

## D.3 Audience Segmentation
- Casual fans
- Hardcore fans
- Genre purists
- Media watchers
- Political citizens
- Rival factions

## D.4 Mechanics
- Rumor lifecycle (emergence → spread → verification/falsehood decay).
- PR response choices with delayed outcome windows.
- Backfire probability based on credibility and timing.
- “Silence strategy” viability for some events.

## D.5 Data Model
- `social_narrative_cards`
- `audience_segments`
- `segment_reactions`
- `rumor_states`
- `pr_response_actions`

## D.6 Moderation Controls
- Defamation guardrails.
- Harassment escalation detection.
- Protected categories filter for generated text.

---

## 10. Epic E — Contract & Legal Roleplay

## E.1 Scope
Build enforceable agreements and legal consequences.

## E.2 Contract Domains
- Label deals
- Management agreements
- Sponsorships
- Event hosting contracts
- Governance pledges

## E.3 Clause Engine
Clause categories:
- Exclusivity
- Release cadence
- Morality
- Revenue splits
- Attendance obligations
- Cancellation penalties

## E.4 Breach Resolution
- Automated breach detection rules.
- Optional arbitration branch.
- Litigation risk and timeline.
- Settlement negotiation mini-flow.

## E.5 Data Model
- `contracts`
- `contract_parties`
- `contract_clauses`
- `breach_cases`
- `arbitration_outcomes`

---

## 11. Epic F — Nightlife & Underworld Long Arcs

## F.1 Scope
Implement optional high-variance RP paths with consent-aware intensity.

## F.2 Intensity Preference
Per-player profile:
- `low_drama`
- `balanced`
- `high_drama`

Affects event frequency/severity and public exposure.

## F.3 Arc Examples
- Addiction and recovery
- Informant storyline
- Security scandal
- Redemption tour arc

## F.4 Risk/Reward Integrations
- Health decay and recovery curves.
- Career volatility multipliers.
- Relationship trust impacts.
- City policy interaction (strict vs permissive cities).

## F.5 Safety
- Optional content boundaries.
- Opt-out for sensitive narrative domains.
- Player recovery actions should always exist.

---

## 12. Epic G — Player-Created Events (UGC RP)

## G.1 Scope
Enable players to host structured, system-integrated events.

## G.2 Event Builder
Template types:
- Showcase
- Charity event
- Rivalry challenge
- Wedding/celebration
- Community summit

### Builder Controls
- Venue and schedule
- Access permissions
- Role assignments
- Reward budget and sponsors
- Canonization request toggle

## G.3 Canonization Workflow
1. Event completes with quality metrics.
2. Optional community/mod review.
3. Canonized events become historical world entries.

## G.4 Abuse Prevention
- Reward budget caps.
- Organizer trust thresholds.
- Fraud scoring for suspicious participation graphs.

---

## 13. Epic H — AI-Assisted Narrative (Opt-In)

## H.1 Scope
Assist writing and event recaps while preserving player authority.

## H.2 Allowed AI Surfaces
- Interview question generation.
- Tabloid-style draft copy from factual event payload.
- Event recap summarization.
- NPC flavor response suggestions.

## H.3 Guardrails
- Never fabricate mechanical outcomes.
- Never auto-commit high-impact actions.
- Human/player approval required before publication.
- Filter for policy-compliant language.

## H.4 Tooling
- Prompt templates with strict schema outputs.
- Content risk classifier before publish.
- Moderation review queues for flagged outputs.

---

## 14. Cross-Cutting System Design

## 14.1 Unified Consequence Ledger
Create `world_consequence_ledger` as central append-only stream:
- `event_id`
- `domain`
- `actor`
- `targets`
- `intensity`
- `scheduled_followups`
- `visibility_scope`

All major systems publish here; downstream projections subscribe.

## 14.2 Scheduling & Jobs
- Job queues for delayed consequences and arc continuations.
- Idempotent handlers and replay-safe processing.
- Dead-letter queues with automated alerting.

## 14.3 Explainability
Every major UI impact must support:
- Top 3 influencing events
- Confidence level
- Estimated decay/time-to-normalize

---

## 15. Technical Implementation Breakdown

## 15.1 Backend Services
- `consequence-service`
- `reputation-service`
- `governance-service`
- `family-service`
- `narrative-service`
- `contract-service`
- `moderation-service`

### Responsibilities
Each service owns write-path business rules and emits domain events. Read models can be denormalized for frontend performance.

## 15.2 Database Strategy
- PostgreSQL for canonical state.
- Materialized views for high-read dashboards.
- Partition large event tables by month.
- Strict foreign keys for legal/contract records.

## 15.3 API Versioning
- Introduce `/v2` endpoints for new graph and consequence models.
- Backward compatibility for existing clients for at least 2 major releases.

## 15.4 Frontend Architecture
- Domain hooks per epic.
- Shared timeline components.
- Explainability widgets reused across reputation, governance, family.
- Feature flags at route/component/action level.

## 15.5 Security
- Server-authoritative calculations for high-value actions.
- Signed action intents for anti-tampering.
- Permission matrix for office powers and event hosting.

---

## 16. LiveOps, Moderation, and Trust & Safety

## 16.1 Moderation Operations
- Tiered queue: auto-resolved, human-review, escalated.
- SLA definitions for high-severity harassment/abuse.
- Audit logs with immutable moderation decisions.

## 16.2 Policy Layers
- Content safety policy for RP-generated text.
- Anti-harassment and impersonation policy.
- Governance abuse policy (campaign fraud, office misuse).

## 16.3 Risk Signals
- Alt-account network patterns.
- Circular transaction and reward farms.
- Coordinated manipulation in elections/social sentiment.

---

## 17. Analytics & KPI Framework

## 17.1 North-Star Outcomes
- RP weekly active participants.
- Cross-domain consequence interaction rate.
- 30/60/90 day retention uplift in RP cohorts.
- Player-generated event participation.

## 17.2 Epic KPIs
### Reputation Graph
- Explainability open rate
- Reputation volatility balance index

### Governance
- Voter turnout
- Policy engagement and approval variance

### Family
- Child planning completion rate
- Child-to-age-16 continuation rate

### Social Narrative
- PR response usage rate
- Rumor resolution ratio

### Contracts
- Contract acceptance and breach frequency
- Arbitration completion outcomes

### UGC
- Event publish success rate
- Canonization approval rate

---

## 18. Rollout Plan (Phased)

## Phase 0 — Foundations (4–6 weeks)
- Introduce consequence ledger schema and event bus conventions.
- Implement feature-flag scaffolding and telemetry baselines.
- Build moderation queue primitives.

## Phase 1 — Consequence & Reputation (8–10 weeks)
- Ship reputation graph backend + read models.
- Integrate existing social drama and romance events into ledger.
- Release explainability UI.

## Phase 2 — Governance & Family Deepening (10–12 weeks)
- Launch office powers and city policy snapshots.
- Complete co-parent workflows and child progression milestones.
- Release dynasty timeline.

## Phase 3 — Social Narrative + Contracts (10–12 weeks)
- Narrative cards, segment reactions, PR response loops.
- Contract clause engine and breach outcomes.

## Phase 4 — Nightlife Arcs + UGC + AI Assist (12+ weeks)
- Long-form nightlife/underworld arcs.
- Player event builder and canonization flow.
- AI-assisted narrative drafting with moderation gating.

---

## 19. Delivery Workstreams by Team

## 19.1 Product
- Define success thresholds and guardrails.
- Prioritize office powers and family milestone events.
- Own sequencing and comms with community.

## 19.2 Design
- Build cross-domain timeline patterns.
- Create explainability interaction spec.
- Author event-builder UX and consent flows.

## 19.3 Backend
- Event schema, ledger ingestion, projection jobs.
- Domain rule engines and schedule processors.
- Anti-abuse signal collection.

## 19.4 Frontend
- Dashboard and timeline surfaces.
- Governance control panels.
- Narrative card feed and PR tooling.

## 19.5 Data/Analytics
- KPI instrumentation.
- Balance simulation tooling.
- Experiment measurement framework.

## 19.6 Moderation/Community
- Policy docs and escalation runbooks.
- UGC canonization moderation workflows.
- Live event support.

---

## 20. Quality & Testing Strategy

## 20.1 Automated Tests
- Unit tests for rule engines (reputation, contracts, governance, family branching).
- Integration tests for event pipeline and projection consistency.
- Property-based tests for balancing boundaries (no runaway loops).

## 20.2 Simulation Tests
- Monte Carlo simulation for economy and reputation drift.
- Election and policy stress simulation.
- Family progression long-run simulation.

## 20.3 Manual QA
- Narrative coherence walkthroughs.
- Abuse scenario playbooks.
- Cross-feature consequence acceptance tests.

## 20.4 Release Gates
- Telemetry completeness >= 95% for critical events.
- No critical moderation regressions.
- Performance budgets met for feed and dashboard loads.

---

## 21. Backlog (Granular Task Seeds)

## 21.1 Reputation Graph
- [ ] Create DDL migrations for `reputation_entities`, `reputation_edges`, `reputation_events_v2`.
- [ ] Backfill legacy reputation table to graph edges.
- [ ] Implement edge decay scheduler.
- [ ] Build `GET /reputation/:id/overview` endpoint.
- [ ] Add explainability drawer component.

## 21.2 Governance
- [ ] Define policy categories and legal ranges.
- [ ] Add office powers permission matrix.
- [ ] Implement `city_policy_snapshots` projection job.
- [ ] Build campaign manifesto editor.
- [ ] Add policy impact badges on city pages.

## 21.3 Family
- [ ] Implement milestone event generator by age bracket.
- [ ] Add co-parent conflict resolution state machine.
- [ ] Add legacy pressure modifier to child progression.
- [ ] Create dynasty timeline view + filters.

## 21.4 Social Narrative
- [ ] Build narrative card generation function.
- [ ] Implement audience segment affinity calculations.
- [ ] Add PR response action menu and cooldowns.
- [ ] Add rumor lifecycle state tracker.

## 21.5 Contracts
- [ ] Implement contract template DSL.
- [ ] Add clause validator and legal bounds.
- [ ] Implement breach detection cron.
- [ ] Build arbitration UI workflow.

## 21.6 Nightlife/Underworld
- [ ] Add player RP intensity setting.
- [ ] Implement arc progression table + cooldown logic.
- [ ] Wire city policy effects into risk generation.

## 21.7 UGC Events
- [ ] Build event template library.
- [ ] Add event role assignment and permissions.
- [ ] Implement reward cap validator.
- [ ] Build canonization moderation queue.

## 21.8 AI Assist
- [ ] Implement narrative draft schema.
- [ ] Add safety classifier pass before publish.
- [ ] Create approval UI for AI drafts.
- [ ] Log all prompt/response artifacts for audits.

---

## 22. Risks & Mitigation

1. **Complexity overload**
   - Mitigation: phased release + feature flags + progressive onboarding.

2. **Runaway drama toxicity**
   - Mitigation: consent settings, moderation tooling, cooldown systems.

3. **Economy imbalance from social volatility**
   - Mitigation: bounded multipliers, decay safeguards, balancing simulations.

4. **Governance exploitation**
   - Mitigation: office audit logs, action rate limits, fraud detection.

5. **AI content misuse**
   - Mitigation: strict opt-in, pre-publish filtering, human review paths.

---

## 23. Open Decisions Required

1. Should political offices be available globally at once or city-by-city rollout?
2. What is the acceptable max inheritance advantage for dynasty systems?
3. Which contract domains launch first (labels vs sponsorships vs management)?
4. Should UGC event rewards be soft-currency only at launch?
5. How much automation is acceptable in AI narrative publishing at v1?

---

## 24. Definition of Done (Program-Level)

A release wave is considered complete when:
- Core mechanic is fully instrumented.
- Consequences are visible and explainable in UI.
- Abuse vectors have mitigation + moderation playbooks.
- KPIs are tracked and compared against baseline.
- Feature flags and rollback paths are in place.

---

## 25. Suggested Immediate Next Steps (Next 2 Sprints)

### Sprint 1
- Finalize consequence ledger schema.
- Implement reputation graph migration plan.
- Define governance policy taxonomy.
- Draft family milestone event content list.

### Sprint 2
- Ship internal alpha for reputation explainability UI.
- Add policy simulation sandbox for city governance.
- Implement co-parent disagreement prototype.
- Build narrative card proof-of-concept pipeline.

---

## 26. Appendix — Proposed Event Envelope (Reference)

```json
{
  "event_id": "uuid",
  "occurred_at": "2026-03-25T00:00:00Z",
  "domain": "romance|governance|family|social|contract|nightlife|ugc",
  "action_type": "string",
  "actor": {
    "entity_type": "player|band|npc|city_office",
    "entity_id": "uuid"
  },
  "targets": [
    {
      "entity_type": "player|band|city|segment",
      "entity_id": "uuid"
    }
  ],
  "intensity": 0.0,
  "public_visibility": "private|friends|city|global",
  "effects": {
    "reputation": [],
    "economy": [],
    "relationship": [],
    "health": []
  },
  "scheduled_followups": [
    {
      "run_at": "2026-03-30T00:00:00Z",
      "handler": "resolve_pr_backlash"
    }
  ],
  "explainability": {
    "summary": "string",
    "confidence": 0.0,
    "source_refs": ["id1", "id2"]
  }
}
```

---

## 27. Appendix — Launch Readiness Checklist

- [ ] Feature flags configured by epic.
- [ ] DB migrations reviewed and rollback-tested.
- [ ] Monitoring and alert thresholds defined.
- [ ] Moderation runbook published.
- [ ] CS/community FAQ prepared.
- [ ] Analytics dashboards validated.
- [ ] A/B or staged rollout plan approved.
- [ ] Incident playbook rehearsed.

---

## 28. Closing Note

This plan intentionally prioritizes **interconnected simulation and explainable consequences** over isolated feature additions. Executed in phases, it can evolve Rockmundo into a modern RP ecosystem that preserves the life-sim depth players love while adding contemporary social, governance, narrative, and safety systems.
