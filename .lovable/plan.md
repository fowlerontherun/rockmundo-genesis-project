

## Fix Plan: Character Creation & Slot Purchase

### Root Causes Found

1. **"unlock_cost" column error** — The column was removed from the `profiles` table at some point, but the user wants it back for compatibility with older DB functions referenced in migrations. Adding it back as `integer NOT NULL DEFAULT 0`.

2. **"duplicate key value violates unique constraint profiles_user_id_key"** — This is the **real** error blocking character creation (visible in the session replay). The `profiles` table has a `UNIQUE(user_id)` constraint, which prevents creating a second profile for the same user. This must be dropped for multi-character support.

3. **Edge function 404 on slot purchase** — Both `create-slot-checkout` and `fulfill-slot-purchase` return 404 (not deployed). They exist in the codebase and `config.toml` has entries. They need to be redeployed — a no-op touch to the files should trigger auto-deploy.

### Changes

**1. SQL Migration** — Single migration to:
- Add `unlock_cost integer NOT NULL DEFAULT 0` column back to `profiles`
- Drop the `UNIQUE(user_id)` constraint (`profiles_user_id_key`) to allow multiple character profiles per account

**2. Edge Functions** — Touch/redeploy `create-slot-checkout` and `fulfill-slot-purchase` by adding a minor comment to trigger auto-deploy.

**3. Version bump** — v1.1.040 with changelog entries.

### Files to Edit
- New SQL migration (via migration tool)
- `supabase/functions/create-slot-checkout/index.ts` (minor touch for redeploy)
- `supabase/functions/fulfill-slot-purchase/index.ts` (minor touch for redeploy)
- `src/components/VersionHeader.tsx`
- `src/pages/VersionHistory.tsx`

