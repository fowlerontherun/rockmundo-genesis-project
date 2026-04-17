
# World Parliament, Political Parties & Politics Career

A new pillar that elevates the existing city governance into a global political arena. Mayors meet in a **World Parliament**, players form **Political Parties** as a new company type, **elections** become a multi-week campaign with nominations/seconding/spending/news coverage, and **Politics skills** gate everything. Mayor pay is set by parliamentary vote.

## 1. New tables

- **`political_parties`** — extends companies (`company_type='political_party'`). Fields: `company_id`, `description`, `colour_hex` (UNIQUE), `logo_url`, `belief_1..5` (text), `founded_at`, `dissolved_at`, `total_strength` (cached).
- **`party_memberships`** — `party_id`, `profile_id`, `role` (founder/officer/member), `joined_at`, unique on profile (one party at a time). Trigger blocks duplicate-colour parties and updates strength.
- **`world_parliament_motions`** — `id`, `proposer_mayor_id`, `title`, `body`, `motion_type` (resolution/policy/budget/mayor_pay/treaty), `payload jsonb`, `status` (open/passed/rejected/expired), `voting_opens_at`, `voting_closes_at`, `yes_votes`, `no_votes`, `abstain_votes`, `created_at`.
- **`world_parliament_votes`** — `motion_id`, `mayor_id`, `vote` (yes/no/abstain), `voted_at`, unique(motion_id, mayor_id). Only current mayors can vote (RLS via `city_mayors.is_current`).
- **`mayor_pay_settings`** — singleton row holding `weekly_salary_per_mayor`, last-updated motion id. Updated only by passed `mayor_pay` motion.
- **`election_candidacies`** extends existing `city_candidates` with: `nominator_profile_id`, `seconder_profile_id`, `nominated_at`, `seconded_at`, `party_id` (nullable = independent), `campaign_article` (text), `campaign_spend_total` (cents).
- **`campaign_expenditures`** — `candidate_id`, `category` (ads/rallies/staff/media), `amount_cents`, `effect_value`, `created_at`. Funded from candidate's personal cash or party treasury.
- **`election_news_articles`** — `election_id`, `candidate_id`, `headline`, `body`, `published_at` — written by candidates, surfaced in TodaysNews.
- **`mayor_salary_payments`** — audit trail of weekly mayor pay.
- **`skill_definitions`** seed: confirm Politics family. Add 2 more: `professional_party_management`, `master_oratory`.

All tables: RLS enabled. Mayors can vote/propose; party founders can edit party; members read; world reads parties/motions/news.

## 2. Political Party company type

Add `'political_party'` to `CompanyType` (`src/types/company.ts`) with creation cost 250k, no weekly ops cost initially. Party treasury = company balance. Player can:

- Create party (only one founded per player) → wizard: name, 5 beliefs, logo (existing logo upload), colour picker (DB-validated unique), description
- Recruit/accept members; appoint officers
- Spend party treasury on member campaigns

New page `src/pages/PoliticalParty.tsx` + `PartyManagementDialog`. Listed in `MyCompanies`.

## 3. Elections overhaul (campaign + nomination + seconding)

Rework `CityElection.tsx` + `useCityElections.ts`:

- **Phase: nomination** — any player can nominate another player (button on PlayerProfile). Nominee accepts. A second player must "second" the nomination within X days, otherwise it lapses. Self-nomination disabled.
- **Phase: campaign** (new, ~7 game days before voting) — accepted candidates write a `campaign_article` (markdown), choose party affiliation, and spend cash on `campaign_expenditures`. Spending grants weighted vote bonus modulated by `professional_campaign_strategy` skill.
- **Phase: voting** — same as today but vote weight slightly boosted by voter's party loyalty / news exposure.
- **Daily news integration**: new component `src/components/news/ElectionCoverage.tsx` listed inside `TodaysNews.tsx` showing candidate articles, polling snapshots, top spenders, party strength rankings.

## 4. World Parliament UI

New page `src/pages/WorldParliament.tsx` with tabs:

- **Floor** — open motions, vote/abstain (gated to current mayors)
- **Propose Motion** — typed motion form (mayor only, costs AP, requires `basic_governance`)
- **Mayor Pay** — current weekly salary, history of pay motions, "propose new salary" button
- **Members** — list of all sitting mayors w/ city, party badge (colour dot), approval rating
- **History** — passed/rejected motions archive

Public-readable summary widget on `WorldMap` and `CityGovernanceSection`.

## 5. Mayor pay loop

- Existing `process-weekly-band-pay`-style cron → new edge function `pay-mayor-salaries` (weekly): inserts `mayor_salary_payments`, debits `city_treasury`, credits player `profiles.cash`.
- Salary defaults to a sane base; only changes via a passed mayor-pay motion.
- High salaries vs city budget → approval penalty per existing law-effects helper.

## 6. Politics skills

Extend `useMayorPolitics` + `POLITICS_SKILLS` with two new skills. SXP awarded for: nominating/seconding (tiny), writing campaign article, proposing motion, voting in parliament, winning election, holding office (passive weekly), founding/leading party. Non-mayors can train via existing mentors/books.

Skill effects:
- `professional_campaign_strategy` → boosts candidate vote count (already wired)
- `professional_party_management` → reduces party weekly ops cost, raises member cap
- `master_oratory` → boosts campaign article reach in news + parliament motion persuasion (passive yes-vote nudge from undecided NPC mayors)

## 7. Politics as a career path (expansion ideas)

Surface inside the new "Politics Career" hub tile under `/hub/career`:

1. **Career ladder**: Activist → Party Officer → City Councillor (mini-role on districts) → Mayor → Party Leader → World Parliament Speaker (elected by mayors)
2. **Lobbying**: companies (labels, venues, factories) can pay parties to push favourable parliament motions; reputation hit if exposed
3. **Scandals**: random events targeting politicians (corruption, affairs, plagiarised speeches) tied into existing Twaater/news drama generator
4. **Inter-party debates**: scheduled live events at major venues (revenue split with venue), boosts campaign metrics
5. **Coalitions & treaties**: parties can ally; mayors of allied parties get vote-trade bonuses on parliament motions
6. **Referendums**: high-statecraft mayors can put a motion to all citizens (not just mayors) for global laws (e.g., universal alcohol age, max ticket price cap)
7. **Diplomatic missions**: travel + diplomacy skill grant inter-city trade-deal bonuses already scaffolded
8. **Political journalism subcareer**: players publish endorsement articles in TodaysNews, earn fame via party affiliation
9. **Term limits & retirement**: ex-mayors gain "Statesman" passive trait (income from speaking gigs)
10. **Achievements**: 25+ new political achievements (first nomination, found a party, win a parliament vote, 365-day mayor, world speaker)

## 8. News integration (TodaysNews)

Add three new section components in `src/components/news/`:

- `ElectionCoverage.tsx` — candidate articles + spend leaderboard (during campaign phase)
- `ParliamentDigest.tsx` — recent passed/rejected motions, current pay rate
- `PartyPowerRankings.tsx` — top 10 parties by `total_strength` (members + mayors held)

## 9. Files to create / modify

**New**
- Migration: tables 1–9, RLS, triggers (unique colour, strength recalc, motion auto-tally, candidacy phase enforcement, mayor-vote eligibility)
- `src/types/political-party.ts`, `src/types/parliament.ts`
- `src/hooks/useParties.ts`, `useParliament.ts`, `useElectionCampaign.ts`, `useNominations.ts`
- `src/pages/WorldParliament.tsx`, `src/pages/PoliticalParty.tsx`, `src/pages/PoliticsCareer.tsx`
- `src/components/parties/{PartyCreateWizard,PartyMembersTab,PartyTreasuryTab,JoinPartyDialog,ColourPicker}.tsx`
- `src/components/parliament/{MotionsList,ProposeMotionDialog,MayorPayPanel,VoteButtons}.tsx`
- `src/components/elections/{NominateButton,SecondNominationDialog,CampaignArticleEditor,CampaignSpendDialog,CampaignTrail}.tsx`
- `src/components/news/{ElectionCoverage,ParliamentDigest,PartyPowerRankings}.tsx`
- Edge functions: `pay-mayor-salaries`, `tally-parliament-motions`, `advance-election-phases`, `recompute-party-strength`
- Cron schedules: hourly motion tally / phase advance, weekly salary payout

**Modified**
- `src/types/company.ts` — add `political_party` type, costs, info, icon, colour
- `src/hooks/useCompanies.ts` + `MyCompanies.tsx` — render parties separately
- `src/hooks/useCityElections.ts` — nomination/seconding flow, campaign phase, party FK
- `src/pages/CityElection.tsx` — phase-aware UI showing campaign trail + party badges
- `src/pages/MayorDashboard.tsx` — link to Parliament + show pending votes
- `src/pages/TodaysNews.tsx` — wire 3 new sections
- `src/pages/SkillsPage.tsx` — Politics family auto-renders new skills
- `src/components/AppSidebar.tsx` (or hub) — add Parliament + Politics Career tiles
- `src/components/VersionHeader.tsx`, `src/pages/VersionHistory.tsx` — bump to **v1.1.214**

## 10. Open questions for build phase

- Should party founding require a city HQ + minimum politics skill? (default: yes, `basic_governance ≥ 100`)
- Mayor pay range bounds & default? (default: $5k–$50k weekly, default $15k)
- Campaign spending cap per candidate to prevent pay-to-win? (default: 3× tier base, per `mem://constraints/financial-numeric-limits`)
- Should parliament include NPC mayors of unmanned cities (auto-vote based on city stats) so quorums are reachable? (default: yes — NPC mayors auto-vote)
