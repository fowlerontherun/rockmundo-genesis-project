# Social System Audit — Phase 0 Repository Audit

Date: 2026-07-10  
Scope: Repository audit for `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`. This is an audit/planning document only; no social feature implementation is included.

## Executive Summary

RockMundo already has many social-adjacent foundations: public player profiles, profile search, friendships, direct messages, Twaater social media, system inbox, global/band realtime chat, band invites/applications, company storefronts/shifts, employment, achievements, activity logs, notifications, and admin moderation for Twaater. However, these systems are unevenly integrated and do not yet form a coherent Social MMO platform.

The most important Phase 0 findings are:

1. **Profiles are broad but privacy-light.** Public profile views expose identity, location, activity, band history, songs, achievements, skills/attributes, and social action entry points, but there is no clear repository-wide privacy model for online status, city, activity, direct-message permissions, or relationship visibility.
2. **Friendship exists, but block/follow/mute semantics are fragmented.** `friendships` includes a `blocked` enum state, Twaater has one-way follows, and DMs/invites exist, but block enforcement is not consistently integrated across DMs, invites, profiles, recruitment, Twaater mentions, or chat.
3. **Communication is fragmented across Inbox, DMs, Twaater DMs, Twaater posts/replies, ChatWindow, band chat, and social invites.** Unread counts and realtime updates exist in places, but there is no single permission/muting/moderation/rate-limit layer.
4. **Presence is count-oriented, not social-discovery-oriented.** There are Supabase presence hooks for online counts and realtime chat presence, but no public availability flags such as looking for band, members, producer, work, or services.
5. **Band recruitment exists.** Bands have creation/management, guarded invitation creation/response, guarded application submission/response/withdrawal, member roles, band search/browser, and recruiting flags. Missing pieces include auditions, structured recruitment search filters, and richer permission matrices. See `docs/social/implementation/PHASE_2_REVIEW.md` for the Phase 2 closure review.
6. **Company and employment systems exist, but social labor-market safeguards are immature.** There are companies, employees, public storefronts, reviews, shifts, jobs, and player employment. They do not yet provide a full contract-backed hiring pipeline with escrow, dispute handling, labor analytics, or block/report protections.
7. **Moderation/admin coverage is partial.** Twaater moderation/admin exists, and reports are present in the Twaater schema, but general profile/DM/chat/invite/band/company report queues and evidence bundles are not unified.
8. **Security posture is mixed.** Several tables use RLS participant checks, but some public read policies are intentionally broad (profiles, storefronts, shifts, reviews, band invitations) and need explicit privacy/abuse review before the MMO social expansion builds on them.

## Methodology

Audited by searching and reading relevant code in:

- Frontend pages/components/hooks under `src/pages`, `src/components`, `src/features`, and `src/hooks`.
- Supabase integrations under `src/integrations/supabase`.
- Database migrations under `supabase/migrations`.
- Supabase Edge Functions under `supabase/functions` where they create social notifications/inbox items or social-media automation.
- Admin pages under `src/pages/admin`.

This document intentionally distinguishes **implemented**, **partial**, **fragmented**, and **missing** capabilities. Existing planning text was used only as the desired target, not as evidence of implemented behavior.

## Key Existing Surfaces and Data Models

### Frontend surfaces

| Area | Existing files reviewed | Notes |
|---|---|---|
| Player profiles/search | `src/pages/PlayerProfile.tsx`, `src/pages/PlayerSearch.tsx`, `src/services/publicProfileSearch.ts`, `src/services/publicProfileDetail.ts`, `src/services/profileService.ts` | Public identity and search; profile search and detail now use public-safe RPCs; richer profile-history surfaces remain partial.
| Relationships/friends | `src/pages/Relationships.tsx`, `src/features/relationships/*`, `src/integrations/supabase/friends.ts` | Friend requests, accepted friendships, relationship events, co-op/recap UI, DMs.
| Direct messages/social invites | `src/hooks/useDirectMessages.ts`, `src/hooks/useSocialInvites.ts`, `src/features/relationships/components/DirectMessagePanel.tsx` | One-to-one DMs and social invites over Supabase tables/realtime.
| Inbox/notifications | `src/pages/Inbox.tsx`, `src/hooks/useInbox.ts`, `src/hooks/useNotificationsFeed.ts`, `src/hooks/useGameNotifications.ts` | System inbox, unread counts, notifications feed.
| Twaater | `src/pages/SocialMedia.tsx`, `src/pages/TwaaterMessagesPage.tsx`, `src/pages/TwaaterNotifications.tsx`, `src/pages/admin/TwaaterAdmin.tsx`, `src/pages/admin/TwaaterModeration.tsx`, `src/hooks/useTwaater*` | Social posts, follows, messages, notifications, moderation/admin.
| Realtime chat/presence | `src/pages/RealtimeCommunication.tsx`, `src/components/realtime/ChatWindow.tsx`, `src/hooks/useRealtimePresence.ts`, `src/hooks/usePublicPresence.ts`, `src/hooks/useJamSessionChat.ts` | Global/band chat, online count, realtime subscriptions.
| Bands/recruitment | `src/pages/BandManager.tsx`, `src/pages/BandBrowser.tsx`, `src/pages/BandSearch.tsx`, `src/components/band/*`, `src/hooks/useCollaborationInvites.ts` | Band management, search, invites, applications, chat, roles.
| Companies/employment | `src/pages/Employment.tsx`, `src/pages/WorldCompanies.tsx`, `src/pages/admin/CompanyAdmin.tsx`, `src/hooks/useCompanies.ts`, `src/hooks/useCompany*` | Jobs, shifts, storefronts, employees, company admin.
| Admin/security | `src/pages/admin/*`, `src/hooks/useUserRole.tsx`, `src/types/security.ts` | Role-based admin surfaces and Twaater-specific moderation.

### Database and backend surfaces

| Area | Existing migrations/functions reviewed | Notes |
|---|---|---|
| Profiles/core identity | `20250916075501_...sql`, later profile extension migrations | Core `profiles`, `player_skills`, `bands`, `band_members`, `songs`.
| Achievements | `20250916081629_...sql`, `20250916130000_player_achievement_summary.sql` | Achievement catalogue, player achievements, summary view.
| Friendships | `20261101100000_create_friendships_table.sql`, older `20250920135913_...sql` | Request/accept/decline/block state and participant RLS.
| Direct messages/social invites | `20260517054236_...sql` | `direct_messages`, `social_invites`, participant RLS, realtime index support.
| Inbox | `20260126184233_...sql`, `supabase/functions/generate-system-inbox/index.ts` | `player_inbox`, categories/priorities/actions, system generated messages.
| Twaater | `20251013055241_...sql`, `20251128154207_...sql`, Twaater functions | Accounts, follows, posts, replies, reactions, conversations/messages, notifications, bot generation, engagement.
| Bands | `20250916160000_create_band_invitations_table.sql`, `20260316144740_...sql` | Invitations, applications, recruiting flag.
| Companies/employment | `20260117171301_...sql`, `20260630133409_...sql`, `20251007102455_...sql` | Companies, employees, storefronts, reviews, shifts, jobs/player employment.
| Contracts | `20250916140602_...sql`, `20250916153000_create_contracts_table.sql`, `20251020120000_create_contract_negotiation_tables.sql` | Multiple contract-related schemas exist; not yet a general social trust layer.

## 1. Player Profiles and Identity

### Implemented / present

- `profiles` table stores core public identity and progression: `user_id`, `username`, `display_name`, `avatar_url`, `bio`, `level`, `experience`, `cash`, `fame`, timestamps; later migrations extend profiles with demographics, age, city/location, avatar, health, clothing/loadout, etc.
- ✅ `PlayerSearch` now uses the server-authoritative `search_public_profiles` RPC and `public_safe_profiles` projection for username/display-name search, returning safe summary fields, privacy-allowed city, and band badges while filtering blocked/private profiles.
- ✅ `PlayerProfile` now uses the server-authoritative `get_public_profile_detail` RPC and the same public-safe visibility helper for detail reads. It shows safe identity, bio, level/fame/fans, privacy-allowed city, joined date, and current public band badges instead of raw health, energy, activity, age/gender, attributes, skills, travel/imprisonment, VIP/generation, total-playtime, or current-city detail fields.
- Achievements are backed by `achievements` and `player_achievements`; profile UI surfaces unlocked achievements.
- Career history is partially represented through gigs, bands, releases/songs, activity logs, jobs/employment, charts, awards, and profile/statistics pages, but it is not normalized into a single public career-history model.
- Current band information is available through `band_members` joins and band profile/browser/search pages.
- Employment/company information exists through `player_employment`, `company_employees`, companies, shifts, and World Companies, but profile-level display is partial.
- Music catalogue exists via `songs`, release/repertoire pages, public song pages, charts, song rankings, and profile song queries.
- Genres exist across bands/songs/releases and search filters.
- Skills are stored in `player_skills` and expanded skill/attribute systems; profile surfaces skills/attributes in some contexts.
- Activity history exists in several tables/hooks (`useGameActivityLog`, relationship feed, inbox, gigs, shifts), but there is no single social activity timeline with privacy controls.

### Partial / fragmented

- **Public vs private data boundaries are partially explicit.** Player search and player profile detail now use public-safe projections/RPCs, but other discovery surfaces may still query broader profile data directly. Database RLS/policies still need a field-by-field review for future privacy-sensitive attributes such as online status, current activity, city, health, relationship status, and direct-message availability.
- **Reputation appears in multiple systems** (profile reputation hook, company reputation, Twaater fame, band ratings, public-image utilities) without a unified social reputation taxonomy.
- **Skills offered/services offered are not first-class profile metadata.** Services can be inferred from skills, company shifts, producer profiles, mentors, jobs, and storefronts, but players cannot publish a coherent “services offered” profile.
- **Career history is scattered.** Band memberships, releases, gigs, jobs, achievements, and awards are independent surfaces rather than a canonical career timeline.

### Missing / risks

- ✅ `profile_privacy_settings` now covers the first visibility/contact slice for profile, city, activity, online status, relationship details, DM permission, and band/company invite opt-ins. Remaining gaps: achievements, band/company history, service availability, and full read/write enforcement across all social surfaces.
- ✅ Player search and player profile detail now filter blocked/private pairs through `can_view_public_profile_summary`; other discovery routes still need block-aware migration.
- ✅ `public_safe_profiles`, `search_public_profiles`, and `get_public_profile_detail` now separate player-search/detail fields from private profile state. Remaining gaps: richer discovery and recruitment-specific projections.
- No clear audit trail for profile edits, display-name/handle changes, or profile moderation actions outside Twaater-specific tooling.

### Recommended Phase 1 foundations

1. Define public-safe profile projection and private profile fields.
2. Add privacy settings and helper functions before adding richer social profile features.
3. Centralize profile access checks, including block/mute/report state.
4. Introduce a normalized public career timeline that composes existing band, gig, release, employment, achievement, and award events.

## 2. Friends and Player Relationships

### Implemented / present

- `friendships` table has requestor/addressee, `pending`, `accepted`, `declined`, and `blocked` statuses, unique unordered profile-pair index, timestamps, and participant RLS.
- Relationship UI supports friend requests, accepting, cancelling/removing friendships, friend search, friendship lists, co-op/recap cards, activity feed, and direct message panels.
- `PlayerSearch` can show friend state and trigger friend request/accept actions.
- `Relationships` page also includes richer character relationship systems: romance/family/rivalry/NPC-style interactions, co-op quests, gifts, teaching, and social drama surfaces.
- Twaater supports one-way follows via `twaater_follows`.
- Direct-message entry points exist from player search and relationship surfaces.
- Band viewing and profile access are available from player/band search and band profile routes.

### Partial / fragmented

- **Blocking exists as a friendship status but is not a dedicated cross-system safety primitive.** DMs, social invites, band invites/applications, Twaater follows/mentions/messages, chat, gifts, and profile access need a shared block check.
- **Ignoring/muting is not clearly implemented globally.** Twaater and chat may have local moderation affordances, but no repository-wide mute/ignore table/policy was found.
- **Following exists only in Twaater account space.** It does not map cleanly to player profile follows, band follows, company follows, or social-discovery follows.
- **Sending money/items is distributed.** Gift and economy systems exist (song gifts, friend gifts, marketplace, contracts, company salaries/shifts), but there is no general friend-to-friend money/item transfer with abuse controls.
- **Profile access is public-route based.** There is no central relationship-aware access helper for whether a viewer can see contact buttons, current activity, city, or private history.

### Missing / risks

- No global relationship type model distinguishes friend, follower, blocked, muted, ignored, bandmate, company colleague, mentor, mentee, contractor, rival, family, or romantic partner for permission checks.
- ✅ Friend-request sends now use a server-authoritative `send_friend_request` RPC with block checks, idempotent pending-request handling, recipient notification deduplication, denied-attempt audit records, and a seven-day recently-declined resend cooldown. Remaining gaps: accept/decline/remove/block lifecycle writes still need dedicated RPCs and broader social rate limiting remains unresolved.
- No block-aware routing protection for shared group contexts (band/company/chat) was found.
- No social-graph recommendations should be added until block/privacy foundations exist.

### Recommended Phase 1 foundations

1. Create a relationship/visibility permission matrix before expanding actions.
2. Promote block/mute/ignore to dedicated, cross-system safety records or functions.
3. Update DMs, invites, follows, profile buttons, band recruitment, gifts, and chat to call shared block/privacy checks.
4. Add request/invite cooldowns and abuse logging.

## 3. Communication

### Implemented / present

- **System Inbox:** `player_inbox` supports categories, priorities, metadata, related entities, action data, read/archive/delete state, and unread counts. Edge functions generate welcome, milestone, weekly, daily, and event outcome inbox items.
- **Direct Messages:** `direct_messages` supports sender/recipient profile IDs, deterministic channel IDs, message body length check, read timestamps, participant RLS, unread query hooks, and realtime invalidation.
- **Twaater DMs:** `twaater_conversations`/`twaater_messages` support account-based conversations and Twaater message UI.
- **Twaater public communication:** posts, replies, reactions, mentions, notifications, hashtags, search/explore, AI feed, bot engagement, and moderation pages exist.
- **Realtime chat:** `RealtimeCommunication` and `ChatWindow` expose global and band chat with online count callbacks; band chat also appears inside band management.
- **Band chat:** `BandManager` includes `BandChat` for band-scoped communication.
- **Jam/session chat:** Hooks and pages exist for jam session chat/voice-like collaboration surfaces.
- **Notifications:** Separate notification tables/hooks exist (`notifications`, `twaater_notifications`, inbox, sponsorship/company notifications), and realtime subscriptions are present in several hooks.
- **Moderation hooks:** Twaater moderation/admin pages and Twaater report tables/policies exist.

### Partial / fragmented

- **Mail vs inbox vs DMs are separate concepts.** Inbox is system/actionable mail; DMs are player-to-player; Twaater DMs are social-media account-to-account. There is no unified communication policy layer.
- **Attachments are not present in general DMs/inbox.** Inbox supports `metadata`/`action_data`; Twaater posts can link game entities, but DMs do not have attachment tables for contracts, songs, gigs, items, money, images, or evidence.
- **Search is uneven.** Twaater has full-text search and hashtag/search surfaces; inbox/DM search is not apparent.
- **Group conversations are partial.** Band/global chat and Twaater one-to-one conversations exist, but general group DMs, company chat, event/tour/festival conversations, and contract-linked conversations are missing or fragmented.
- **Unread counts exist per inbox/DM/Twaater notifications but are not consolidated.**
- **Rate limiting is mostly absent at the schema/API level.** Body length limits exist; Twaater daily awards/XP limits exist; but DMs, invites, chat, follows, mentions, and friend requests need abuse throttling.

### Missing / risks

- No global report queue for DMs, inbox messages, chat messages, profile content, band/company listings, invitations, and contracts.
- No message retention/evidence bundle policy was found outside Twaater-specific moderation.
- ✅ Direct-message sends now use the shared `can_profile_receive_dm` guard through a server-authoritative `send_direct_message` RPC and guarded insert policy. ✅ Friend-request sends now use `send_friend_request` with shared block checks, duplicate handling, cooldowns, notification dedupe, and denied-attempt audit logging. ✅ Social invite sends/responses now use `send_social_invite` and `respond_social_invite` with sender/recipient authority checks, shared block checks, duplicate pending handling, expiry handling, notification dedupe, and denied-attempt audit logging. Remaining gaps: Twaater messages/follows/mentions, realtime chat, band recruitment, gifts, and other communication surfaces still need consistent block/mute/report enforcement.
- No attachment limit/schema, malware/content validation, or moderation workflow for future attachments.
- No company chat identified as a first-class communication channel.
- No clear SSE-specific implementation; realtime appears primarily Supabase Realtime channels/subscriptions.

### Recommended Phase 1 foundations

1. Define communication primitives: system inbox, direct messages, group conversations, social posts, realtime chat.
2. Add shared send guards: participant validity, block/mute, privacy permissions, cooldowns, rate limits, and moderation logging.
3. Add unified unread/notification aggregation for social surfaces.
4. Add report hooks and evidence retention before adding attachments/group DMs.
5. Defer attachments until validation/moderation/size limits are designed.

## 4. Presence and Discoverability

### Implemented / present

- `useRealtimePresence` tracks authenticated users on Supabase `online-users` presence and exposes online count.
- `usePublicPresence` subscribes read-only to online count for unauthenticated/public pages.
- `RealtimeCommunication` uses realtime chat presence/online counts.
- Profile and search surfaces show city, current activity, bands, fame/fans/level, and biographical information.
- Band search/browser supports finding active bands and, in the schema, `bands.is_recruiting`.
- World Companies exposes public storefronts and open company shifts.
- Producer/mentor/talent discovery pages and hooks exist in adjacent systems.

### Partial / fragmented

- Online presence is aggregate-count oriented, not player-discovery oriented.
- `profiles.current_activity` and `current_city_id` are visible in profile/search contexts but do not appear governed by privacy controls.
- Looking-for states are scattered or implicit: recruiting flag on bands, open company shifts, producer profiles, mentors, job postings, and storefront `now_hiring`.
- Player search is limited to username/display name; it does not filter by availability, skills, city, genre, reputation, language, time zone, mentor status, or band-seeking/member-seeking flags.

### Missing / risks

- No `looking_for_band`, `looking_for_members`, `looking_for_producer`, `looking_for_work`, `looking_for_services`, or `available_for_collaboration` profile fields/settings were found.
- No privacy controls for online status/last active/current activity/current city were found.
- No last-active public/private policy was found.
- Recruitment search is not yet a dedicated matching system.

### Recommended Phase 1 foundations

1. Add opt-in availability/status settings with explicit visibility scopes.
2. Keep online/last-active private by default or scoped by settings/friendship.
3. Build discovery/search off public-safe views, not raw profile tables.
4. Add block-aware search exclusion before adding recommendations.

## 5. Band Recruitment and Membership

### Implemented / present

- Bands can be created and managed through band manager/components.
- `bands`, `band_members`, roles, instrument/vocal roles, leader/founder concepts, status, chemistry/cohesion, finances, repertoire, gigs, riders, vehicles, gear, and chat surfaces exist.
- ✅ `band_invitations` creation now uses the guarded `send_band_invitation` RPC for new client flows, with server-side actor resolution, invite permission checks, target privacy/block checks, active-member rejection, duplicate pending invite idempotency, validation constraints, denied-attempt audit logging, and notification dedupe. Invitation responses now use the guarded `respond_band_invitation` RPC, and leader/founder cancellation has the guarded `cancel_band_invitation` RPC; response creates membership idempotently and updates related notifications.
- ✅ `band_applications` supports applications with applicant profile, instrument/vocal role, message, status, responded timestamp, pending-only duplicate prevention per band/applicant, and applicant self-view. Creation now uses the guarded `submit_band_application` RPC with server-side applicant resolution, recruiting-open checks, current-member denial, block checks against recruitment managers, role/message validation, manager notification dedupe, retry idempotency, and audit logging. Approval/rejection uses the guarded `respond_band_application` RPC with server-side actor resolution, pending/final-state checks, leader/founder recruitment authorization, former-member exclusion through active membership checks, applicant self-approval denial, block checks, duplicate active-membership prevention, safe default member role creation, notification dedupe, and audit logging. Applicant withdrawal now uses `withdraw_band_application`, which resolves the acting profile from `auth.uid()`, locks the application, verifies applicant ownership and pending state, transitions to `withdrawn`, preserves history, updates manager notification metadata as non-actionable, and avoids membership changes. Recruitment notification display now surfaces application/invitation status metadata, normalizes legacy application routes away from the unused `?tab=applications` query string, and uses a shared pending/final/actionable status map for notifications plus applicant and manager history.
- `bands.is_recruiting` exists.
- Band browser/search lets players discover bands; band ratings and profiles exist.
- Collaboration invite hooks and cross-band collaboration utilities exist for adjacent collaboration concepts.

### Partial / fragmented

- Invitation policies are broad in one migration: invitations are viewable by everyone. This may be acceptable for public recruiting but is risky for private invitations.
- Band leader checks vary across older schema surfaces, but invitation creation/cancellation and application approval/rejection now use the dedicated `can_manage_band_invitations` helper. The helper now requires current active leader/founder membership unless the actor is the band `leader_id`. Other band actions still need migration.
- Auditions are not first-class. Applications include role/message but not scheduled auditions, audition media, votes, or review history.
- Band roles exist but are not yet a complete permission matrix for finances, bookings, releases, contracts, chat moderation, invites, applications, and public announcements.
- Band invitation creation/response and band application submission/approval/rejection/withdrawal are now duplicate guarded and server-authoritative. Applicant history on band profiles and manager band-application history now preserve accepted, rejected, and withdrawn rows with controls only for pending states. Auditions, leader-side invitation cancellation UI, and broader recruitment rate limits remain unresolved.

### Missing / risks

- No structured audition flow.
- No recruitment-specific search/matching over missing instruments, skill thresholds, city, genre, schedule, language, or availability.
- No broad anti-spam cooldowns for invites/applications beyond duplicate pending band invitation/application idempotency and response idempotency.
- No invite/application report flow or evidence retention.
- No membership history archive with role changes and join/leave reasons as a canonical profile/band career timeline. Application history is now visible in narrow applicant/manager surfaces, but it is not a full career timeline.

### Recommended Phase 1 foundations

1. Standardize band role/permission checks in a shared helper/RPC.
2. Make recruitment access policies explicit: public listings vs private invites.
3. Add block/cooldown checks for invitations/applications before adding auditions.
4. Add recruitment search from public-safe player/band availability fields.
5. Add membership/audition history only after privacy rules are defined.

## 6. Companies, Employment, and Services

### Implemented / present

- `companies` supports owner, name, logo, type, parent, headquarters city, balance, bankruptcy/status, reputation, description, and timestamps.
- `company_employees` supports company/profile role, salary, hired date, status, and performance rating.
- `company_transactions` tracks company financial events.
- Public company storefronts expose quality, price tier, rating, market share, weekly customers/revenue, public visibility, and `now_hiring`.
- Company reviews exist with public read and own-review write policies.
- Company shifts support open shift postings with role, description, wage, duration, skill requirements, slot counts, status, start/expiry, and claims.
- `Employment` page supports player jobs and shift history in a more NPC/job-board style system.
- Admin company tools exist.

### Partial / fragmented

- Company hiring is split between `company_employees`, company shifts, general `jobs`/`player_employment`, and public storefronts.
- Company shifts are public browseable and worker/owner claimable, but not obviously tied to employment contracts, escrow, dispute resolution, block checks, or report queues.
- Company reputation exists as a number, storefront ratings exist, and reviews exist, but there is no verified-interaction weighting or abuse protection beyond uniqueness per reviewer/company.
- Services offered can be inferred through storefronts/shifts/producer profiles but not published as player-profile service offerings.

### Missing / risks

- No generalized job application workflow for player-run companies comparable to band applications.
- No contract-backed employment terms with escrow, task verification, cancellation, disputes, or safe defaults.
- No labor market analytics for average pay by role/city/skill.
- No protections against predatory offers, spam hiring, review manipulation, or block evasion.
- No company chat or company announcement/moderation role system identified as a first-class feature.

### Recommended Phase 1 foundations

1. Inventory and reconcile `jobs`/`player_employment`, `company_employees`, and `company_shifts` into a clear labor model.
2. Add company hiring profile/read-only service metadata before applications/contracts.
3. Use contracts/escrow only after permission, report, and audit foundations are in place.
4. Add verified-interaction gates for reviews/reputation.

## 7. Security, Privacy, Moderation, and Admin

### Implemented / present

- Many social tables enable RLS and restrict rows to participants/owners.
- `friendships` participant policies protect friendship rows from non-participants.
- `direct_messages` participant policies limit select/update/delete to sender/recipient roles.
- `social_invites` participant policies limit visibility and updates to sender/recipient.
- `player_inbox` restricts select/update/delete to the owning user, though insert is open by policy for system use.
- Twaater has moderation/admin pages and reports/notifications/conversation schemas.
- Admin dashboard includes many management pages, including players, bands, companies, Twaater, Twaater moderation, analytics, cron monitor, roles, and balance/config systems.

### Partial / fragmented

- RLS policies vary from strict participant checks to public reads. Public reads may be intended for discovery, but privacy-sensitive social expansion should not rely on raw public tables.
- Some policies permit broad insert/update in ways that are convenient but need abuse review, such as system inbox insert with `WITH CHECK (true)` and company/public review/comment tables.
- Moderation is strongest around Twaater and weakest around DMs/chat/invites/profile/company/band content.
- Admin tools are broad but not yet unified around social reports/evidence bundles.

### Missing / risks

- No repository-wide block/mute/report policy enforcement.
- No global rate-limit functions/triggers for DMs, friend requests, social invites, Twaater follows, mentions, chat, band invitations, applications, reviews, or gifts.
- No central audit log for social actions across profiles, relationships, messages, invites, bands, companies, and contracts.
- No privacy-safe API layer/RPC for public profile/search/discovery.
- No unified moderator queue with source entity, reporter, target, evidence, status, action, appeal, and SLA metrics.

### Recommended Phase 1 foundations

1. Create shared SQL helpers/RPCs for `profile_belongs_to_current_user`, block/mute checks, and public-safe profile visibility.
2. Add `social_reports`/`social_moderation_actions` before expanding message/group/community features.
3. Add rate-limit/audit hooks around write-heavy social actions.
4. Review public RLS policies and document intended exposure for every social table.

## 8. Admin Code Audit

### Existing admin coverage

- `src/pages/admin/PlayerManagement.tsx`: player management surface.
- `src/pages/admin/BandAdmin.tsx`: band administration.
- `src/pages/admin/CompanyAdmin.tsx`: company administration.
- `src/pages/admin/TwaaterAdmin.tsx` and `src/pages/admin/TwaaterModeration.tsx`: Twaater administration/moderation.
- `src/pages/admin/AdminUserRoles.tsx`: user roles.
- `src/pages/admin/Analytics.tsx`, `CronMonitor.tsx`, `DebugPanel.tsx`: operational/admin observability.
- Numerous balance/content admin pages for systems that social MMO features will touch indirectly.

### Gaps

- No unified social moderation queue for all entity types.
- No social audit log viewer.
- No block/mute/report management console.
- No profile privacy inspector/tester.
- No rate-limit/abuse dashboard.
- No evidence bundle view combining message, profile, invite, band/company, contract, and transaction context.

## 9. Readiness Matrix

| Capability | Current readiness | Notes |
|---|---:|---|
| Public player profiles | Medium | Rich profile data exists; privacy boundaries need work.
| Private profile data | Low | No explicit privacy matrix/public projection.
| Achievements | Medium | Tables/UI exist; social display rules need privacy controls.
| Career history | Low-Medium | Data exists across systems, not canonical.
| Current band | Medium | Membership joins and band pages exist.
| Employment/company info | Medium | Company/employment systems exist; profile integration partial.
| Music catalogue/genres | Medium | Songs/releases/charts exist; profile/social projection partial.
| Skills offered/services | Low | Skills exist; services offered are not first-class.
| Activity history | Low-Medium | Logs/feeds exist, no unified privacy-aware social timeline.
| Privacy controls | Low-Medium | First owner-managed profile privacy/contact settings slice exists; direct-message sends now enforce DM permission server-side. Profile/search/recruitment reads and other writes remain pending. |
| Friend requests/friendships | Medium | Request creation is now block-aware and server-authoritative; accept/decline/remove/block lifecycle writes and broader rate limiting remain partial.
| Removing friends | Medium | Delete/cancel flows exist.
| Blocking | Low-Medium | Dedicated safety primitives exist; direct-message sends, friend-request sends, and social invite sends/responses now use shared block guards. Other write surfaces still need migration. |
| Ignoring/muting | Low | Not global.
| Following | Medium for Twaater; low globally | Twaater follows only.
| Profile access | Low-Medium | Public access exists; relationship/privacy controls missing.
| Sending money/items | Low-Medium | Gifts/economy exist; general social transfer not unified.
| Viewing bands | Medium | Browser/search/profile links exist.
| Direct chat/DMs | Medium | DMs exist and new sends are privacy/block guarded through an RPC; rate limiting, report/evidence workflows, attachments, and broader moderation remain gaps. |
| Mail/inbox | Medium | System inbox exists; not player mail with attachments.
| Attachments | Low | Not general communication attachment system.
| Search | Medium for players/Twaater/bands; low for DMs/inbox | Needs unified discovery/search rules.
| Global/band chat | Medium | Realtime chat exists; safety controls need review.
| Company chat | Low | Not identified as first-class.
| Group conversations | Low-Medium | Band/global/Twaater DMs exist; general group DMs missing.
| Unread counts | Medium | Per-surface counts exist; not consolidated.
| Notifications | Medium | Multiple notification systems remain fragmented; friend-request and social-invite creation now include actionable deduped notifications.
| SSE/realtime | Medium | Supabase Realtime present; no explicit SSE layer.
| Moderation hooks | Low-Medium | Twaater strong; general social weak.
| Rate limiting | Low | Needs dedicated work.
| Online status | Low-Medium | Presence counts exist, not privacy-aware per-player status.
| Last active | Low | No clear public/private model.
| Looking-for states | Low | Band recruiting/storefront hiring partial; player availability missing.
| Player search/profile detail | Medium-High | Basic search and profile detail now use public-safe RPC/projection reads with block and profile-visibility checks; richer discovery filters remain pending.
| Recruitment search | Low-Medium | Band search exists; matching filters missing.
| Band creation | Medium | Implemented.
| Band invites | Medium | Partial; creation is guarded server-side with privacy/block/duplicate checks, while response/read policies still need review.
| Band applications | Medium | Guarded submission, response, and applicant withdrawal implemented; auditions, vacancies, cooldowns, richer history views, and matching missing.
| Auditions | Low | Not first-class.

## 10. Recommended Next PR Sequence

1. **Social permission design PR:** ✅ First slice implemented in `docs/social/implementation/PHASE_1_PR_01.md`, `src/features/social-privacy/*`, and `supabase/migrations/20260710120000_add_profile_privacy_settings.sql`. It adds owner-managed profile privacy/contact settings plus shared helper functions for owner checks, block checks, and DM eligibility. Remaining slices: migrate profile/search/DM/recruitment reads and writes to enforce these settings end-to-end.
2. **Safety schema PR:** Add shared block/mute/report/audit primitives with no major UI exposure.
3. **Profile projection PR:** ✅ Search and detail slices implemented via `public_safe_profiles`, `search_public_profiles`, and `get_public_profile_detail`. Remaining slice: migrate richer discovery/recruitment reads.
4. **Communication guard PR:** ✅ Direct-message send guards, friend-request send guards, and social-invite send/respond guards are implemented in Phase 1 PRs 03–05. Remaining slices: add broader rate limits and migrate Twaater DMs/follows, chat, remaining recruitment writes/responses, gifts, and friendship response/removal lifecycle operations.
5. **Recruitment metadata PR:** Add opt-in availability fields and band recruiting metadata behind privacy settings.
6. **Admin moderation PR:** Add unified social reports and evidence review console.
7. **Only after the above:** Add richer social features such as group conversations, attachments, auditions, job applications, reputation, and social recommendations.

## 11. Tiny Corrective Code Changes

None. This PR only adds this audit/planning document.

## Phase 3 PR 05 Recruitment Verification Update

Recruitment RLS now has a repeatable local Supabase SQL harness at `supabase/tests/recruitment_rls_harness.sql`. The harness verifies applicant-owned history visibility, current leader/founder manager visibility, ordinary/former/unrelated/anonymous denial, private message visibility boundaries, guarded RPC access, direct insert/update denial, membership idempotency, notification dedupe, and message-free notification metadata.

A verified RLS defect was corrected: the historical manager select policy on `band_applications` did not require active membership and used case-sensitive role checks. The corrective migration `20260711000000_tighten_band_application_select_policy.sql` now delegates manager visibility to `can_manage_band_invitations`, limiting private application history to current band leaders/founders.

Guarded RPC verification now covers `submit_band_application`, `respond_band_application`, and `withdraw_band_application` for eligible actors, unauthenticated users, ordinary members, former members, unrelated users, duplicate retries, direct-write attempts, block guards, invalid roles, overlong messages, final-state retries, and safe membership role defaults.

Route verification now has shared unit coverage for applicant notifications to band profile routes, manager stale `?tab=applications` normalization, final-state recruitment notifications, missing/deleted destination handling, and invitation-route preservation. Full authenticated browser navigation remains a P1 follow-up because the repository does not currently provide Playwright authenticated fixtures.

Confirmed remaining gaps are product decisions rather than security blockers: global one-band membership/application policy, role-specific vacancies, recruitment cooldowns, auditions, matching, applicant scoring, and recruitment rewards. Database tests are documented as a separate local Supabase command and are not yet wired into default CI.

## Phase 4 PR 01 Update — Band Contribution Tracking

- ✅ Added a dedicated `band_contribution_events` foundation for immutable, server-authoritative band participation history.
- ✅ Initial contribution sources are limited to completed band rehearsals, completed band recording sessions, and completed gig outcomes. Jam-session and songwriting contribution events remain unresolved until band-scoped authoritative source data is clearer.
- ✅ Contribution history is read-only to normal clients and visible only to authenticated current active members of the relevant band. Former/inactive members, unrelated users, and unauthenticated users are denied by default.
- ✅ Idempotency is enforced with a source-based unique constraint so repeated completion processing does not create duplicate contribution rows.
- ✅ The Band Management UI now exposes neutral recent contribution history and count summaries without XP, rewards, chemistry, achievements, leaderboards, or penalties.
- ✅ Unit/component coverage was added for display mapping, safe fallback labels, summaries, empty/loading/error states, and rendering recent contributions.
- ⚠️ Rehearsal and gig events currently credit active members at completion time because participant-level attendance records were not found. This is a shared-progression foundation, not a reward source yet.

## Phase 4 PR 02 Update — Contribution Source Accuracy

- ✅ Added a small server-side contribution-source adapter for completed band recording sessions.
- ✅ Recording participation now uses verified participant records where available: the session owner/profile plus distinct `production_tracks` uploaders for the completed band session.
- ✅ Contribution insertion now checks active band membership at the contribution time using `joined_at` where the schema supports it.
- ✅ The Contributions tab now labels verified participant-sourced events neutrally and states summaries are based on recorded participation.
- ⚠️ Rehearsal participation remains band-completion based because no authoritative rehearsal attendee, RSVP, invitation, or attendance-status table was found.
- ⚠️ Gig participation remains band-outcome based because no authoritative performer lineup or member attendance table was found.
- ⚠️ Jam participation remains excluded: `jam_session_outcomes` is participant-level, but jam sessions are not authoritatively tied to exactly one band.
- ⚠️ Songwriting contribution remains excluded: completed band-owned accepted co-author credit is not clearly represented by the audited schema.
- ✅ RLS/privacy posture is unchanged: contribution events remain read-only to normal clients and visible only to current active members of the band.


### Phase 4 PR 03 update — rehearsal attendance and gig lineup foundations

- Added private `band_rehearsal_participants` rows for future rehearsal bookings. Current gameplay has no RSVP flow, so active members are invited by default and only completion marks attendance.
- Added private `gig_performers` rows for future gig bookings. Current gameplay has no lineup editor, so active non-touring player members are selected by default and only gig outcome processing marks performance.
- Rehearsal contribution capture now reads attended participant rows instead of crediting every active member at completion.
- Gig contribution capture now reads performed lineup rows instead of crediting every active member at outcome insertion.
- RLS permits active band members to read operational participant/lineup data; no broad direct client mutation policies were added.
- Existing schedule records remain the schedule source; participant/lineup rows are evidence for contribution and future per-member schedule display.
- Test coverage now includes a database harness note for participant/lineup idempotency and contribution adapter cases; full execution requires local Supabase database tooling.

### Phase 4 PR 04 update — participant and lineup visibility

- ✅ Existing rehearsal cards now expose read-only participant status from `band_rehearsal_participants` with Expected, Attended, Missed, loading, error, empty, and older-event unavailable states. RSVP and attendance editing remain unresolved.
- ✅ Existing gig detail surfaces now expose read-only lineup status from `gig_performers` with Selected, Performed, Missed, loading, error, empty, and older-event unavailable states. Manager lineup editing, substitutes, and session musicians remain unresolved.
- ✅ Schedule integration remains detail-based: no duplicate schedule records were introduced and participant/lineup lists are not fetched for every schedule item.
- ✅ Contribution source clarity improved through neutral action labels for attended rehearsals and performed gigs, without rankings, rewards, XP, chemistry, goals, achievements, or leaderboards.
- ✅ Privacy posture remains current-active-band-member-only through the existing participant/performer RLS policies; no public gig lineup exposure or direct participant mutation policy was added.
- ✅ Automated coverage was added for shared status mapping, rehearsal/gig read-only UI states, no edit controls, safe unsupported status fallback, and contribution labels.


### Phase 4 PR 05 update — attendance and lineup rules design

- ✅ Added the canonical attendance and lineup product-rules document for rehearsal RSVP, attendance finalisation, gig lineup selection, performer confirmation, lock windows, contribution eligibility, privacy, disputes, audit, RLS/backend design, UI plan, anti-abuse analysis, and implementation sequencing.
- ✅ Repository verification confirms current participant/lineup rows are read-only to clients, have only `invited`/`attended`/`missed` and `selected`/`performed`/`missed` statuses, and currently auto-finalise still-provisional rows on completion/outcome capture.
- ⚠️ Mutation features remain incomplete by design: no RSVP RPC, lineup editor, substitution RPC, correction/dispute table, absence-reason field, or manager finalisation UI is marked complete.
- ⚠️ Identified permission needs before implementation: authoritative leader/founder/officer checks, own-row response checks, former-member historical self-read rules, denied-attempt logging, and admin/support override policy.
- ⚠️ Identified privacy/dispute gaps: optional private absence reasons, correction windows, dispute resolver conflict rules, contribution correction records, and notification privacy/deduplication are still unimplemented.
- 📌 Planned order is PR 06 rehearsal self-response, PR 07 rehearsal finalisation, PR 08 gig lineup management, PR 09 performer confirmation/lineup lock, and PR 10 correction/dispute review.


Phase 4 PR 06 status update: Rehearsal participant and gig lineup details are surfaced on existing pages. Rehearsal participants can now confirm or decline only their own provisional rehearsal row before the one-hour lock deadline; gig lineup response and manager finalisation controls remain absent.


## Phase 4 PR 07 audit update — rehearsal attendance finalisation

- Added guarded manager-owned rehearsal attendance finalisation through `finalise_rehearsal_attendance`. Current active leader/founder/co-leader/manager roles are allowed through existing manager helper semantics; ordinary, former, unrelated, and unauthenticated users are denied by the RPC.
- Attendance lifecycle now supports player RSVP before the deadline and manager finalisation after rehearsal end or source completion. `declined` remains read-only during manager finalisation, and final `attended`/`missed` rows cannot be reversed in this PR.
- Rehearsal contribution capture now creates `rehearsal_attendance` only for participant rows already finalised as `attended`; missed and declined rows do not contribute, and completion no longer silently marks invited rows attended.
- Missed participant notifications are deduped by rehearsal, participant, and final state. Attended notifications are intentionally suppressed.
- Audit coverage records successful rehearsal finalisation, participant attended/missed markings, and denied attempts for permission, timing, cancellation, invalid payload, wrong participant, and final/declined conflicts.
- RLS remains unchanged for direct participant mutation; clients use only the SECURITY DEFINER RPC with safe `search_path` and narrow authenticated execute grant.
- Participant DB harness documents PR 07 RPC coverage markers; full integration validation requires a running Supabase database.


### Phase 4 PR 08 implementation status — rehearsal attendance corrections

Rehearsal attendance correction requests are now implemented for final `attended` ↔ `missed` rows only. Affected participants can open one pending request within the 24-hour database-enforced correction window; authorised current managers or admin/support resolvers can approve or reject through guarded RPCs. The workflow preserves append-only audit history, keeps request reasons and resolution notes private, sends deduped resolver/requester notifications, and corrects rehearsal contribution eligibility by inserting missed-to-attended events idempotently or voiding attended-to-missed events without deleting the original contribution row. Gig lineup management, performer confirmation, gig disputes, absence reasons, rewards, penalties, XP, chemistry, reputation, attendance percentages, and reliability scoring remain out of scope.
