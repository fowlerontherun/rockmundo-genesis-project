
# v1.0.618 — Delete Unused Edge Functions and Deploy AI Avatar

## Overview

Delete 6 confirmed-unused edge functions to free up deployment slots, then deploy the `generate-photo-avatar` function that was blocked by the function limit. Bump version to 1.0.618.

## Step 1: Delete Unused Edge Functions

The following 6 functions have **zero references** in the frontend (`src/`) and are **not listed** in `supabase/config.toml`. They are fully orphaned:

| Function | Reason for removal |
|---|---|
| `generate-character-sprite` | Replaced by `generate-photo-avatar` (v1.0.617) |
| `generate-gig-commentary` | No frontend or backend callers |
| `manual-complete-gig` | Superseded by `complete-gig` |
| `complete-festival-performance` | No frontend or backend callers |
| `create-inbox-message` | No external callers found |
| `grant-vip` | No frontend or stripe-webhook callers |

**Actions:**
- Delete the code folders for all 6 functions from `supabase/functions/`
- Call the Supabase delete tool to remove deployed versions from the platform

## Step 2: Deploy `generate-photo-avatar`

Once slots are freed, deploy the edge function that was created in v1.0.617 but failed due to the function limit.

## Step 3: Version Bump to 1.0.618

- Update `src/components/VersionHeader.tsx` version string to `1.0.618`
- Add a changelog entry in `src/pages/VersionHistory.tsx` documenting:
  - Cleanup of 6 unused edge functions
  - Successful deployment of the AI Photo Avatar generator

## Files to Delete

- `supabase/functions/generate-character-sprite/` (entire directory)
- `supabase/functions/generate-gig-commentary/` (entire directory)
- `supabase/functions/manual-complete-gig/` (entire directory)
- `supabase/functions/complete-festival-performance/` (entire directory)
- `supabase/functions/create-inbox-message/` (entire directory)
- `supabase/functions/grant-vip/` (entire directory)

## Files to Modify

- `src/components/VersionHeader.tsx` — version to `1.0.618`
- `src/pages/VersionHistory.tsx` — add changelog entry
