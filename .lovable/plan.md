

## Improve Release Promotion Across Twaater, DikCok, and PR (v1.1.029)

### Current State

**What exists:**
- **Twaater**: Can link releases to twaats with auto-generated promo text. The outcome engine gives small sales bumps (+0-3) for linked release twaats, but does NOT boost the release's `hype_score`.
- **DikCok**: No way to link a video to a release at all. The `dikcok_videos` table has `track_id` (song) but no `release_id`.
- **Promotional Campaigns**: Pay-to-launch passive campaigns from Release Detail page (Social Media Blitz, Radio Push, etc.) that boost hype.
- **Promo Tours**: Multi-day active promo tours with health/energy drain and hype rewards.
- **PR/Media**: Media submissions (newspapers, magazines, podcasts, websites) exist but have no release linkage — you submit "about your band" generically.
- **Release Detail Promotion tab**: Only shows Promo Tour + Promotional Campaigns. No quick-links to Twaater/DikCok/PR.

### Gaps Identified

1. **Twaater release-linked posts don't boost hype_score** — the outcome engine updates sentiment/morale but never touches the release's hype.
2. **DikCok has no release linking** — can't create a promo video for an upcoming release.
3. **PR/Media submissions can't target a specific release** — no "promote my new album" option.
4. **No centralized promotion hub** — the Release Detail promotion tab doesn't guide players to all available promo channels.

### Plan

#### 1. Twaater: Release-linked posts boost hype (Edge Function update)
Update `twaater-outcome-engine` to detect when `linked_type` is `"album"` or `"single"` and apply a hype boost (+5 to +15, scaled by engagement outcome) to the linked release's `hype_score`.

**File:** `supabase/functions/twaater-outcome-engine/index.ts`

#### 2. DikCok: Add release linking to video creation
- **Migration:** Add `release_id` (nullable FK to releases) on `dikcok_videos` table.
- **UI:** Add a "Link to Release" select dropdown in `DikCokCreateDialog.tsx` showing user's releases. When a DikCok video is linked to a release, apply a hype boost (+10-25 based on views/virality) on creation.
- **Files:** `DikCokCreateDialog.tsx`, `useDikCokVideos.ts`

#### 3. PR/Media: Add release selection to media submissions
- Update `MediaSubmissionDialog.tsx` to accept an optional release selector. When a submission is approved (or created), the linked release gets a hype boost.
- Add `linked_release_id` to the four submission tables (newspaper, magazine, podcast, website submissions).
- **Files:** `MediaSubmissionDialog.tsx`, migration for submission tables

#### 4. Release Detail: Promotion Hub with cross-links
Expand the Release Detail promotion tab to include quick-action cards:
- "Post on Twaater" — opens Twaater with the release pre-linked
- "Create DikCok Video" — opens DikCok create dialog with release pre-selected
- "Submit to Media" — links to PR/media pages
- "Book PR Interview" — links to media offers
- Show current hype score prominently with the `HypeMeter` component

**File:** `src/pages/ReleaseDetail.tsx`

#### 5. Version bump
- `VersionHeader.tsx` → v1.1.029
- `VersionHistory.tsx` → changelog entry

### Files to Change

1. `supabase/functions/twaater-outcome-engine/index.ts` — Add hype_score boost for release-linked twaats
2. **DB Migration** — Add `release_id` to `dikcok_videos`, add `linked_release_id` to 4 media submission tables
3. `src/components/dikcok/DikCokCreateDialog.tsx` — Add release selector dropdown
4. `src/hooks/useDikCokVideos.ts` — Pass release_id, apply hype boost on creation
5. `src/components/media/MediaSubmissionDialog.tsx` — Add optional release selector
6. `src/pages/ReleaseDetail.tsx` — Expand Promotion tab with cross-channel quick actions + HypeMeter
7. `src/components/VersionHeader.tsx` — Bump to v1.1.029
8. `src/pages/VersionHistory.tsx` — Add changelog

