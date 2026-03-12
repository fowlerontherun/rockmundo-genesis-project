

## Fix Company System, Inter-Company Transfers, and Player Survey (v1.1.033)

### Issues Found

**1. DB constraint mismatch for company types**
The database CHECK constraint allows: `holding, subsidiary, label, venue_management, security, factory, studio, rehearsal, logistics`
The frontend sends: `venue` and `recording_studio`
This means creating a Venue or Recording Studio company will fail with a constraint violation. Fix: update the DB CHECK constraint to match the frontend values (`venue`, `recording_studio`), and remove the unused `subsidiary` and `venue_management` and `studio` values.

**2. No inter-company fund transfers**
The `CompanyFinanceDialog` only moves money between the player's personal cash and a single company. There's no way to transfer money between a holding company and its subsidiaries. Fix: add a "Transfer Between Companies" tab to the `CompanyFinanceDialog`, allowing transfers between any two companies the player owns.

**3. Player survey not appearing when enabled**
The survey integration in Dashboard.tsx looks correct. The config is currently `enabled: false`. However, there's a potential issue: when `surveyConfig` is `null` (query returns no config or config not yet fetched), `shouldShowSurvey` returns `false`. The logic itself is sound but the `surveyConfig` query returns `null` when `config_value` is falsy. The actual problem is likely an RLS or caching issue. Looking more carefully — the `hasCompleted` query is `enabled: !!user && !!surveyConfig?.round`, but `surveyConfig` starts as `undefined` (not `null`), and `hasCompleted` also starts as `undefined`. Since `shouldShowSurvey` checks `hasCompleted === false` (strict equality), when `hasCompleted` is `undefined` (loading), the survey won't show — which is correct. But if the config query fails silently or returns `null`, the completion query never runs, `hasCompleted` stays `undefined`, and the survey never shows. Fix: add a fallback and ensure the flow works correctly. Also add a `refetchOnMount` to ensure fresh config on login.

### Plan

#### 1. Database migration: Fix company_type CHECK constraint
Drop the old constraint and add a new one with correct values: `holding, label, security, factory, logistics, venue, rehearsal, recording_studio`.

#### 2. Add inter-company fund transfer
- Add a new `useTransferBetweenCompanies` mutation in `src/hooks/useCompanyFinance.ts`
- Add a "Transfer" tab to `CompanyFinanceDialog.tsx` that shows a dropdown of the player's other companies and allows transferring funds between them
- Record transactions on both sides (transfer_out on source, transfer_in on destination)

#### 3. Fix player survey visibility
- In `usePlayerSurvey.ts`, add `refetchOnMount: 'always'` to the config query so it always fetches fresh data on Dashboard load
- Ensure `shouldShowSurvey` handles the loading states correctly — only block when explicitly completed, not when still loading

#### 4. Version bump to v1.1.033

### Files to Change

1. **DB Migration** — Fix `companies_company_type_check` constraint
2. `src/hooks/useCompanyFinance.ts` — Add `useTransferBetweenCompanies` mutation
3. `src/components/company/CompanyFinanceDialog.tsx` — Add "Transfer" tab with company selector
4. `src/hooks/usePlayerSurvey.ts` — Fix config query refetch behavior
5. `src/components/VersionHeader.tsx` — v1.1.033
6. `src/pages/VersionHistory.tsx` — Changelog

