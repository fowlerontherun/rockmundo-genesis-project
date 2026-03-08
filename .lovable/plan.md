

## Plan: Fix Character Slot Purchase + Add Daily Inbox Notifications (v1.1.025)

### Problem 1: Character Slot Checkout Edge Function Error

The `create-slot-checkout` edge function has **incomplete CORS headers**. It's missing the newer Supabase client headers that are sent automatically:

```
Current:  authorization, x-client-info, apikey, content-type
Required: authorization, x-client-info, apikey, content-type, 
          x-supabase-client-platform, x-supabase-client-platform-version,
          x-supabase-client-runtime, x-supabase-client-runtime-version
```

The preflight OPTIONS request fails, blocking the actual POST. Same fix needed in `fulfill-slot-purchase`.

**Fix**: Update CORS headers in both edge functions.

---

### Problem 2: No Daily Inbox Notifications

The `process-daily-updates` function runs ~15 daily systems but sends **zero** inbox messages. Players have no idea what happened overnight.

**Add inbox notifications for these daily events** (inserted into `player_inbox` during processing):

| Event | Category | Priority | Condition |
|-------|----------|----------|-----------|
| Rent charged | `financial` | low | Always when rent collected |
| Rent defaulted (evicted) | `financial` | urgent | When player can't afford rent |
| Modeling contract completed | `financial` | normal | When payout awarded |
| NPC label offer received | `record_label` | high | When a label scouts the band |
| Equipment condition critical | `system` | high | Any item drops below 20% |
| Significant fan loss | `social` | normal | Band lost >50 fans from decay |
| Band can't afford salaries | `financial` | high | Morale penalty applied |
| Investment growth summary | `financial` | low | Daily, if investments grew |
| Daily fame/fans summary | `system` | low | Per-player, daily digest |

**Implementation**: Add `player_inbox` inserts at each relevant point inside `process-daily-updates/index.ts`. Each insert needs the `user_id` of the affected player (already available in the processing loops). We'll need to look up band leader user_ids for band-level notifications.

---

### Files to Change

1. **`supabase/functions/create-slot-checkout/index.ts`** — Fix CORS headers
2. **`supabase/functions/fulfill-slot-purchase/index.ts`** — Fix CORS headers
3. **`supabase/functions/process-daily-updates/index.ts`** — Add ~9 inbox notification inserts at relevant processing points
4. **`src/components/VersionHeader.tsx`** — Bump to v1.1.025
5. **`src/pages/VersionHistory.tsx`** — Add changelog entry

