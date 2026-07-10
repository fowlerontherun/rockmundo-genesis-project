# RockMundo Social MMO Expansion Plan

## 1. Executive Summary

Social interaction should become one of RockMundo's primary progression engines because music careers are inherently social: artists form bands, hire teams, sign contracts, compete for attention, build fan communities, negotiate with venues, and earn status through reputation. A true music MMO cannot rely only on isolated timers, menus, and personal optimization; it needs other players to be the unpredictable, valuable, and memorable content that keeps the world alive.

The current problem is not that RockMundo lacks systems. The game already has strong foundations around bands, gigs, venues, companies, education, careers, media, nightlife, economy, and progression. The gap is that these systems do not yet consistently require, reward, or visibly celebrate meaningful player-to-player interaction. Players can progress, but the world can still feel too single-player because cooperation, hiring, mentoring, rivalry, community identity, and social reputation are not yet strong enough drivers of outcomes.

The target player experience is that every player can say, "my best opportunities came from other people." A solo artist should be able to remain viable, but joining a band, negotiating a record deal, mentoring a newcomer, hiring a reliable employee, promoting another player's venue, organizing a festival, joining a fan club, or building a trusted reputation should create real advantages. Players should remember social stories: the manager who rescued a tour, the rival band that stole a festival slot, the mentor who accelerated a career, the fan community that pushed a song viral, or the unreliable contractor whose reputation collapsed.

RockMundo should improve on Popmundo by preserving the strongest Popmundo-style social fantasy—bands, fame, relationships, companies, cities, roleplay, competition, fan culture, and emergent drama—while adding modern MMO expectations: clearer onboarding, safer communication, structured cooperation, transparent contracts, anti-griefing protections, moderation tooling, social graph recommendations, opt-in communities, asynchronous collaboration, seasonal events, better mobile-friendly UX, and server-authoritative rewards. The goal is not to copy Popmundo feature-for-feature, but to modernize its core truth: other players make the game meaningful.

Other players should become the most valuable content in RockMundo because they create novelty that static content cannot. A scripted gig system can provide rewards, but a negotiated tour creates trust, risk, timing, strategy, reputation, and story. A generated NPC company can create jobs, but a player-run company creates culture, politics, hiring standards, career ladders, and market pressure. A leaderboard can rank fame, but rival artists and fan communities make that ranking emotionally important.

## 2. Design Principles

1. **Meaningful interaction over spam or grinding**
   - Social progression should reward decisions, commitments, reliability, and outcomes, not repeated low-value clicks.
   - Avoid systems where players farm likes, messages, gifts, or invites with no gameplay consequence.
   - Prefer capped, weighted, and context-aware rewards over unlimited interaction loops.

2. **Cooperation should provide real advantages without making solo play impossible**
   - Bands, companies, mentors, labels, fan clubs, and communities should provide efficiency, access, risk reduction, and unique opportunities.
   - Solo players should retain viable routes through hired services, NPC fallback options, public markets, self-management, and solo-specific achievements.
   - Cooperation should increase the ceiling and create social stories, not hard-lock essential progression.

3. **Reputation should be earned through behavior**
   - Reputation should come from completed contracts, reliable attendance, fair dealing, mentorship outcomes, community contributions, and moderation-safe behavior.
   - Reputation should decay or become less prominent over time so players can recover from old mistakes without allowing rapid reputation laundering.
   - Ratings should be weighted by verified interactions, not anonymous popularity contests.

4. **Social systems must connect to progression**
   - Interaction should affect fame, career opportunities, employee quality, contract access, gig outcomes, fan conversion, company growth, learning speed, media reach, and economy flow.
   - Social progression should not be only cosmetic; it should shape strategic choices while remaining fair.

5. **Every interaction should create visible outcomes**
   - Players should see why cooperation mattered: better gig attendance, faster training, higher morale, stronger fan conversion, improved venue reputation, reduced tour risk, or unlocked contracts.
   - Dashboards should show contribution history, pending obligations, social impact summaries, and recent reputation changes.

6. **All rewards must be server-authoritative and exploit-resistant**
   - Never trust client-side interaction counts, attendance claims, reward calculations, or contract completion state.
   - Use server-side validation, rate limits, cooldowns, audit logs, fraud detection, and reversible transactions.
   - Design rewards around verified outcomes rather than raw message volume or mutual boosting.

7. **Privacy, blocking, reporting, and moderation must be built in**
   - Every communication and community surface must support blocking, reporting, muting, privacy settings, safety filters, and moderator review.
   - Social power must not become a griefing vector. Systems must include consent, opt-outs, access controls, cooldowns, and abuse response tools.

8. **Reuse before rebuilding**
   - Prefer extending existing bands, companies, gigs, venues, education, media, economy, notifications, profiles, and moderation systems.
   - New features should be delivered as thin, incremental layers over existing models and services before introducing large new abstractions.

## 3. Social Gameplay Pillars

### Communication and Presence

**Goal:** Make the world feel populated, responsive, and safe without turning communication into spam.

**Core features**
- **Friends and follows**
  - Add clear distinction between mutual friends, one-way follows, blocked users, bandmates, company colleagues, mentors, mentees, contractors, and rivals.
  - Provide friend activity summaries such as upcoming gigs, new releases, job openings, contract requests, and major achievements.
  - Allow privacy controls for online status, current city, current activity, relationship status, and direct-message permissions.

- **Direct messages and group conversations**
  - Support one-to-one messages for negotiation, mentoring, hiring, and social play.
  - Support group conversations scoped to bands, companies, labels, events, festivals, tours, and communities.
  - Add conversation metadata for gameplay context: attached contract, linked gig, linked venue booking, proposed payment, decision deadline, and accepted participants.

- **Presence and availability**
  - Show lightweight status such as online, recently active, busy, open to gigs, seeking band, hiring, available for mentoring, looking for label, or open to collaborations.
  - Use presence to improve discovery without exposing sensitive player behavior.
  - Allow players to opt out of public availability.

- **Notifications and social inbox**
  - Consolidate invitations, contract offers, band votes, company applications, mentor requests, event RSVPs, venue booking updates, and reports into a reliable social inbox.
  - Separate urgent actionable items from social feed noise.
  - Provide digest settings to avoid notification fatigue.

- **Safety requirements**
  - Include block, mute, report, conversation leave, invite cooldowns, attachment limits, and moderator-visible audit trails.
  - Blocked users should not be able to send messages, invite repeatedly, tag, hire, mentor, or route around the block through shared groups unless strict group moderation rules apply.

**Implementation approach**
1. Inventory existing profile, notification, and social media surfaces.
2. Add read-only relationship indicators before adding new write actions.
3. Introduce server-side social relationship records and privacy checks.
4. Add messaging only after block/report/moderation foundations exist.
5. Connect conversations to existing game objects such as bands, companies, gigs, and contracts.

### Bands, Crews, and Artist Collaboration

**Goal:** Make bands the strongest cooperative unit while preserving viable solo careers.

**Core features**
- **Band roles and permissions**
  - Define roles such as founder, leader, vocalist, guitarist, drummer, producer, songwriter, tour manager, promoter, accountant, and session musician.
  - Roles should control permissions for bookings, finances, releases, contracts, member invitations, strategy settings, and public announcements.
  - Allow temporary guest/session roles with limited access.

- **Shared goals and contribution tracking**
  - Add band objectives such as prepare setlist, rehearse, promote gig, record single, complete tour, win city chart, sign sponsor, or recruit missing role.
  - Track contribution by verified actions, not self-reported effort.
  - Display contribution summaries to reduce drama and make rewards fair.

- **Band morale and cohesion**
  - Introduce visible but bounded bonuses for stable collaboration: improved rehearsal efficiency, gig consistency, fan conversion, and media narrative.
  - Penalize only severe social failures such as missed accepted commitments, abrupt contract breaches, or repeated inactivity in critical roles.
  - Provide leader tools to rotate members, mark absences, and use substitute/session musicians.

- **Collaboration contracts**
  - Support guest features, co-writing, split royalties, shared production credits, and temporary tour participation.
  - Require explicit acceptance and show expected rewards, obligations, deadlines, and cancellation rules.

- **Solo viability**
  - Solo artists can hire session musicians, use public rehearsal services, buy promotion, sign short-term management contracts, and join open events.
  - Solo artists should earn less cooperative upside than coordinated groups, but should never be blocked from core career progression.

**Implementation approach**
1. Add documentation and UI labels for existing band responsibilities.
2. Add role metadata and permission checks in small PRs.
3. Add contribution logs for existing band actions.
4. Add objective templates using existing gig, song, rehearsal, and media systems.
5. Add collaboration contracts after the generic contract framework is stable.

### Companies, Hiring, and Player Labor Markets

**Goal:** Make player-run companies and employment a major social economy without allowing exploitation or pay-to-win.

**Core features**
- **Job boards**
  - Companies can post openings for managers, promoters, venue staff, producers, teachers, security, stylists, publicists, and accountants.
  - Job listings include responsibilities, pay, schedule expectations, required skills, location, contract length, and reputation requirements.
  - Applicants can attach social proof such as completed contracts, band history, certifications, and endorsements.

- **Employment contracts**
  - Contracts define salary, bonuses, task expectations, access permissions, confidentiality flags, trial periods, termination rules, and dispute options.
  - Server validates payment escrow and task completion where possible.
  - Avoid unpaid labor traps by requiring explicit terms and clear cancellation rules.

- **Task assignment and verification**
  - Companies assign tasks connected to real systems: promote show, book venue, teach class, produce track, restock business, scout talent, or run campaign.
  - Completion should be verified by existing game state when possible.
  - Manual completion can exist, but should not trigger high-value rewards without safeguards.

- **Company reputation**
  - Companies earn reputation through paid contracts, employee retention, fair dispute outcomes, customer ratings, event quality, and market reliability.
  - Bad behavior such as repeated non-payment, cancellations, or moderation violations reduces trust.

- **Labor market analytics**
  - Show average pay by role, city, skill level, and contract length.
  - Help players price services fairly and reduce opaque exploitation.

**Implementation approach**
1. Start with read-only company hiring profiles.
2. Add job postings with application flow.
3. Add escrow-backed simple contracts.
4. Add task templates connected to existing systems.
5. Add reputation and labor analytics after enough data exists.

### Contracts, Trust, and Reputation

**Goal:** Turn social promises into enforceable gameplay agreements.

**Core features**
- **Generic contract framework**
  - Support contract types for gigs, venue bookings, employment, management, label deals, sponsorships, teaching, mentoring, production, loans, royalties, collaborations, and event organization.
  - Each contract includes parties, terms, deadlines, payments, deliverables, cancellation rules, penalties, dispute process, and visibility.

- **Escrow and settlement**
  - Payments should use escrow for high-risk deals.
  - Server releases funds when objective completion conditions are met.
  - Partial completion should support partial settlement where appropriate.

- **Reputation dimensions**
  - Track reliability, professionalism, generosity, mentorship, business fairness, creative quality, community standing, and moderation safety.
  - Avoid a single simplistic score that can be farmed or brigaded.

- **Endorsements and references**
  - Allow verified endorsements only after meaningful shared activity.
  - Weight endorsements by relationship type, recency, and endorser credibility.
  - Limit endorsement frequency to prevent trading rings.

- **Disputes**
  - Provide structured dispute reasons and evidence from server logs.
  - Small disputes can resolve automatically based on objective completion; complex cases can enter moderator/admin review.

**Implementation approach**
1. Document contract types and shared fields.
2. Build the simplest escrow-backed contract for one existing flow.
3. Add audit logging and admin review views.
4. Expand contract templates one at a time.
5. Add reputation only after contracts generate reliable behavioral signals.

### Mentoring, Education, and New Player Integration

**Goal:** Make experienced players valuable guides while protecting new players from manipulation.

**Core features**
- **Mentor profiles**
  - Experienced players can opt into mentor status by specialty: performance, songwriting, business, gigs, companies, social media, economy, or roleplay.
  - Profiles show availability, language, time zone, reputation, specialties, and previous mentee outcomes.

- **Mentorship contracts**
  - Mentees can request structured mentoring with goals and duration.
  - Mentors receive rewards only when mentees complete verified learning milestones, not when they spam messages.
  - New players can leave mentorship without penalty.

- **Guided social onboarding**
  - New players get safe suggestions: join beginner-friendly communities, attend open gigs, apply to starter bands, ask mentors, or take entry-level jobs.
  - Use opt-in discovery rather than forced social dependency.

- **Teaching and classes**
  - Player teachers can host classes tied to education systems.
  - Class quality depends on teacher skill, attendance, preparation, reputation, and moderation-safe conduct.
  - Limit rewards with cooldowns and diminishing returns.

- **Protections**
  - Prevent mentors from extracting excessive fees, coercing contracts, or targeting brand-new players with predatory offers.
  - Provide starter contract templates with safe defaults.

**Implementation approach**
1. Add mentor opt-in and discovery UI.
2. Add mentorship request/accept flow with block/report support.
3. Add milestone-based rewards tied to existing education/tutorial goals.
4. Add player-led classes after teaching validation is defined.
5. Add mentor reputation and moderation review tools.

### Competition, Rivalries, and Public Status

**Goal:** Make competition emotional, visible, and fair without encouraging harassment.

**Core features**
- **Rival declarations**
  - Players or bands can declare opt-in rivalries with mutual consent or public competitive framing.
  - Rivalry goals can include chart battles, city fame races, festival outcomes, venue sellouts, song releases, or media campaigns.
  - Rivalry pages show progress, history, stakes, and final outcomes.

- **Leaderboards with context**
  - Add leaderboards for city scenes, genre scenes, labels, companies, venues, mentors, fan clubs, and seasonal events.
  - Include filters for new players, solo artists, bands, companies, and regions.
  - Use anti-smurf and anti-boosting protections.

- **Seasonal competitions**
  - Create time-boxed events where cooperation and rivalry intersect: battle of the bands, label showcases, city festivals, fan-club drives, media weeks, and company awards.
  - Reward prestige, cosmetics, profile badges, limited economic bonuses, and historical recognition, not direct pay-to-win power.

- **Public status and legacy**
  - Profiles should show meaningful achievements: tours completed, famous gigs, reliable contracts, mentees helped, companies built, community awards, and rivalry wins.
  - Create archives so social history persists.

- **Anti-harassment rules**
  - Rivalry systems must be opt-in, block-aware, and moderation-compatible.
  - Rivalry rewards should never require direct insults, brigading, or targeted harassment.

**Implementation approach**
1. Add contextual leaderboard filters to existing stats.
2. Add seasonal event documentation and data requirements.
3. Add opt-in rivalry declarations.
4. Add rivalry progress tracking for one objective type.
5. Expand to multi-objective rivalry campaigns.

### Communities, Clubs, and Fan Ecosystems

**Goal:** Let players form persistent social homes beyond bands and companies.

**Core features**
- **Player communities**
  - Support clubs, scenes, genre groups, city communities, fan clubs, business associations, roleplay circles, and newcomer guilds.
  - Communities have membership rules, roles, announcements, events, shared goals, moderation settings, and public/private visibility.

- **Fan clubs**
  - Artists and bands can cultivate fan clubs managed by players.
  - Fan clubs can coordinate promotions, attend gigs, run contests, create media buzz, and unlock community cosmetics.
  - Rewards should be based on verified participation and capped to avoid alt farming.

- **Community projects**
  - Communities can run festivals, charity events, compilation albums, city campaigns, venue circuits, training weeks, and genre spotlights.
  - Projects require contributions from multiple roles and produce visible world outcomes.

- **Community reputation**
  - Communities earn trust through completed events, fair moderation, newcomer support, and low report rates.
  - Toxic or exploitative communities lose discovery placement and may face admin action.

- **Discovery**
  - Players can discover communities by city, genre, language, playstyle, time zone, beginner friendliness, competitiveness, and moderation style.

**Implementation approach**
1. Reuse existing group/band/company UI patterns for community shells.
2. Add simple join/leave/role flows.
3. Add announcements and event links.
4. Add community projects tied to gigs/media/education.
5. Add community reputation and discovery ranking.

### Economy, Markets, and Social Value Creation

**Goal:** Make the economy more player-driven by connecting trust, services, and social production.

**Core features**
- **Service marketplace**
  - Players can offer production, songwriting, session performance, promotion, teaching, management, styling, venue booking, security, and consulting.
  - Listings should show price, availability, skill, reputation, completion history, and refund rules.

- **Reputation-sensitive markets**
  - High-reputation players and companies gain better visibility, lower escrow requirements, or access to premium opportunities.
  - Low-reputation players can recover by completing smaller verified contracts.

- **Player-created demand**
  - Bands need promoters, venues need performers, labels need artists, teachers need students, festivals need staff, fan clubs need organizers, and companies need employees.
  - Systems should intentionally create complementary needs instead of letting every player self-produce everything optimally.

- **No pay-to-win**
  - Premium monetization should not sell reputation, contract completion, social authority, leaderboard placement, or direct competitive power.
  - Monetization can support cosmetics, convenience, expanded analytics, community customization, and non-competitive expression.

- **Anti-exploit economy controls**
  - Add rate limits, suspicious transaction detection, alt-account monitoring, escrow, market price warnings, and admin audit tools.
  - Prevent circular contracts from generating infinite reputation or currency.

**Implementation approach**
1. Define service categories using existing systems.
2. Add marketplace listings without automated settlement.
3. Add escrow and verified settlement for one service category.
4. Add market analytics and reputation weighting.
5. Add fraud dashboards before high-value expansion.

## 4. Popmundo-Inspired Features to Preserve and Modernize

- **Deep band identity**: Keep bands as social units with lineup history, roles, rehearsals, releases, touring, and public legacy.
- **Character relationships**: Support friendship, romance, family, rivalries, mentorship, and professional ties with privacy and consent controls.
- **City-based scenes**: Make location matter through local charts, venues, communities, newspapers/media, job markets, and festivals.
- **Player-run businesses**: Preserve the fantasy that players can own and manage meaningful companies that other players interact with.
- **Roleplay and emergent stories**: Give players tools for announcements, events, bios, interviews, rivalries, and social archives.
- **Prestige through history**: Store and display meaningful accomplishments so social actions become part of the world's memory.
- **Modernization upgrades**: Add safety controls, better UX, mobile-friendly flows, clear contracts, onboarding, dashboards, notifications, and anti-exploit validation.

## 5. Progression and Reward Model

Social interaction should affect progression through bounded, explainable channels:

1. **Efficiency bonuses**
   - Bands rehearse more effectively when members fulfill accepted commitments.
   - Mentorship accelerates early learning milestones.
   - Companies reduce operational friction when reliable employees complete tasks.

2. **Access bonuses**
   - Trusted players receive better contract offers, festival invitations, label interest, mentorship opportunities, and job applications.
   - Communities unlock projects and seasonal competitions through collective reputation.

3. **Visibility bonuses**
   - Fan clubs, promoters, media collaborations, and community projects increase discovery, but should not guarantee success.
   - Visibility should be capped and compete with quality, timing, genre fit, and audience interest.

4. **Prestige rewards**
   - Badges, profile history, community trophies, rivalry archives, company awards, and social titles provide long-term status.
   - Prestige should be difficult to buy and should remain tied to verified history.

5. **Economic rewards**
   - Contracts, employment, services, royalties, and revenue shares move money between players.
   - High-value transactions require escrow, audit logs, and exploit checks.

6. **Recovery paths**
   - Players with low reputation can rebuild through smaller contracts, community service, successful mentorship, or time-based decay of old penalties.
   - Avoid permanent social death except for serious moderation enforcement.

## 6. Safety, Privacy, Moderation, and Abuse Prevention

Safety is a core feature, not an afterthought.

**Required controls**
- Block, mute, report, privacy settings, invite limits, cooldowns, and opt-in discovery.
- Group moderation tools: roles, message deletion, member removal, join approvals, report queues, and audit history.
- Contract safety: clear terms, escrow, cancellation windows, dispute flow, safe defaults, and warnings for unusual terms.
- New player protection: restricted high-risk contracts, mentor review, beginner-safe job templates, and warnings for above-market fees.
- Anti-harassment: block-aware rivalries, opt-in public challenges, no reward for targeted abuse, and moderator escalation.
- Anti-fraud: server-side reward calculation, rate limits, alt detection signals, circular trade detection, and reversible suspicious payouts.
- Data privacy: do not expose online status, city, activity, relationships, or contact options beyond player settings.

**Moderation tooling**
- Report queues linked to messages, contracts, communities, profiles, events, and market listings.
- Evidence bundles containing relevant server logs and limited context.
- Moderator actions such as warning, content removal, temporary communication restriction, contract freeze, community delisting, suspension, and appeal.
- Metrics for report volume, response time, repeat offenders, false reports, and community health.

## 7. Implementation Roadmap for Small, Safe Pull Requests

### Phase 0: Audit and Documentation
- Inventory existing social, band, company, gig, media, notification, moderation, and economy systems.
- Map where social interactions already exist and where they are missing.
- Define shared terminology for relationships, communities, contracts, reputation, and verified actions.
- Add this plan and follow-up technical design documents only.

### Phase 1: Visibility and Discovery Foundations
- Add improved profile social metadata and privacy settings.
- Add availability flags such as looking for band, hiring, open to gigs, seeking mentor, or open to collaboration.
- Add discovery filters for players, bands, companies, venues, jobs, and communities.
- Add non-invasive notification improvements for invitations and applications.

### Phase 2: Safety and Trust Foundations
- Add block/mute/report coverage across all social surfaces.
- Add invite cooldowns and permission checks.
- Add audit logging for social actions and contract-like offers.
- Add admin/moderator review views before launching high-impact systems.

### Phase 3: Band and Company Cooperation
- Add band roles, permissions, and contribution history.
- Add company hiring profiles and job boards.
- Add simple application flows with safe messaging constraints.
- Add task templates tied to existing systems.

### Phase 4: Contracts and Escrow
- Add generic contract model in a dedicated technical PR after schema design approval.
- Start with one low-risk contract type, such as paid promotion or session musician work.
- Add escrow and server-side completion checks.
- Add cancellation, dispute, and settlement flows.

### Phase 5: Mentoring and New Player Social Onboarding
- Add mentor opt-in and mentor discovery.
- Add milestone-based mentorship rewards.
- Add beginner-friendly communities and starter job recommendations.
- Add safeguards for new-player contracts and fees.

### Phase 6: Communities and Fan Clubs
- Add community shells with roles, membership, announcements, and linked events.
- Add fan club mechanics connected to artists and bands.
- Add community projects tied to gigs, media, festivals, and education.
- Add community reputation and discovery ranking.

### Phase 7: Rivalries, Seasons, and Social Legacy
- Add opt-in rivalry declarations.
- Add seasonal competitions and contextual leaderboards.
- Add social history archives on profiles, bands, companies, and communities.
- Add awards that emphasize prestige over raw power.

### Phase 8: Economy Expansion and Live Ops
- Add broader service marketplace categories.
- Add labor analytics and market health dashboards.
- Add fraud detection dashboards and economy alerts.
- Add recurring social events, festivals, city campaigns, and moderation reports.

## 8. Data and System Reuse Strategy

Before adding new models or services, each feature should ask whether an existing system can be extended:

- **Profiles**: social identity, reputation summaries, availability, achievements, privacy.
- **Bands**: roles, contributions, collaboration goals, fan clubs, rivalry history.
- **Companies**: hiring, employment, service offerings, contracts, reputation.
- **Gigs and venues**: social attendance, promotions, event staffing, rivalry goals, community projects.
- **Education**: mentorship, teaching, classes, onboarding milestones.
- **Media systems**: interviews, announcements, social posts, fan campaigns, reputation signals.
- **Economy**: escrow, payments, service listings, royalties, fraud detection.
- **Notifications**: invitations, applications, contracts, disputes, event reminders.
- **Moderation**: reports, audit logs, penalties, appeals, community health.

New systems should be introduced only when reuse would create confusing ownership, unsafe coupling, or unmaintainable logic.

## 9. Technical Guidelines for Future Codex PRs

Every future implementation PR should:

1. Be small enough to review safely.
2. Include only one feature slice or one infrastructure slice.
3. Avoid mixing schema changes, UI changes, business logic, and moderation tooling unless the slice requires it.
4. Add tests for permission checks, reward validation, privacy behavior, and exploit prevention.
5. Keep reward calculations server-side.
6. Add audit logs for high-impact social actions.
7. Include migration plans only in PRs explicitly scoped for schema work.
8. Preserve solo-player fallback paths.
9. Include admin/moderation considerations before exposing public interaction.
10. Document rollout flags, rollback plan, and abuse risks.

Suggested PR slicing pattern:

1. Documentation and technical design.
2. Read-only UI or discovery metadata.
3. Server-side permissions and safety controls.
4. Minimal write flow with no rewards.
5. Reward integration with caps and tests.
6. Admin/moderation tooling.
7. Analytics and balancing.

## 10. Success Metrics

Track both social health and business outcomes:

- Friend/follow creation rate.
- Message response rate and report rate.
- Band formation rate and band retention.
- Contract completion rate, dispute rate, and escrow volume.
- New-player mentor match rate and mentee retention.
- Job applications, hires, and completed company tasks.
- Community creation, membership growth, and event participation.
- Fan club participation and conversion to gig attendance or media engagement.
- Solo-player progression rate compared with cooperative-player progression rate.
- Reputation distribution and recovery rate.
- Report handling time and repeat offender rate.
- Economy concentration, suspicious transaction rate, and market liquidity.
- 1-day, 7-day, 30-day, and 90-day retention for socially connected players versus isolated players.

## 11. Key Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Social spam replaces meaningful play | Rate limits, verified outcomes, diminishing returns, and capped rewards. |
| Cooperation becomes mandatory | Maintain solo paths, NPC/public services, and solo achievements. |
| Reputation is brigaded or farmed | Weight verified interactions, limit endorsements, detect circular networks, and add decay. |
| New players are exploited | Safe templates, fee warnings, mentorship safeguards, cancellation rights, and moderation review. |
| Player companies become abusive | Transparent contracts, dispute tools, company reputation, and labor market analytics. |
| Rivalries become harassment | Opt-in rivalry mechanics, block awareness, report integration, and no rewards for abusive behavior. |
| Economy inflation from social rewards | Escrow, caps, fraud detection, and rewards tied to real sinks and verified outcomes. |
| Moderation load increases | Build report queues, evidence bundles, automated triage, and community moderator tools. |
| Feature scope becomes too large | Deliver through small PRs with flags, tests, and rollback plans. |

## 12. Recommended First Follow-Up PRs

1. **Social systems audit document**
   - Map current profile, band, company, gig, media, notification, economy, and moderation capabilities.
   - Identify exact files, routes, components, and data models to extend.

2. **Relationship and privacy technical design**
   - Define friends, follows, blocks, mutes, visibility settings, and privacy rules.
   - Include permission matrix and moderation requirements.

3. **Band role and contribution design**
   - Define band roles, permissions, contribution events, and solo fallback needs.
   - Do not implement until reviewed.

4. **Contract framework technical design**
   - Define generic contract fields, escrow behavior, completion validation, dispute states, and audit logs.
   - Identify the safest first contract type.

5. **Mentorship MVP design**
   - Define mentor opt-in, discovery, milestone validation, reward caps, and new-player protections.

6. **Community and fan club MVP design**
   - Define community shell, roles, membership, announcements, linked events, and moderation tools.

## 13. Definition of Done for the Social MMO Expansion

The expansion should be considered successful when:

- Players regularly discover opportunities through other players.
- Bands and companies have meaningful internal roles, obligations, and rewards.
- Contracts make cooperation safer and more enforceable.
- Mentors measurably improve new-player retention.
- Communities and fan clubs create recurring events and identity.
- Reputation affects opportunity without becoming permanent punishment.
- Rivalries and leaderboards create excitement without harassment.
- Solo players remain viable and respected.
- Social rewards are server-authoritative, capped, auditable, and resistant to farming.
- Moderation tools are strong enough to support increased interaction.
- The player economy has more trusted services, jobs, and interdependence.
- Players perceive other players as the most valuable content in RockMundo.
