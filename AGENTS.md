# Project rules

- Festival invitation withdrawals use authenticated server actions with band/organiser permission checks, version locks and audit history; never mutate invitation rows from the browser.

- Reuse the shared character switcher in both shells with a shell-specific return destination; this keeps ownership and switching behavior consistent.
- Keep mobile shell and character-control translations in the typed playerControls locale catalogue merged into i18n; this ensures all supported languages expose the same controls.

- Luthiery shape and component variants must preserve existing selection IDs and use materials accepted by the authoritative crafting catalogue, so saved instruments and inventory remain compatible.
- TV performance camera paths and restrained performer motion are pure replay-time presentation helpers bounded by shared studio geometry; this preserves seeking, export consistency and gameplay isolation.
- Define luthiery body outlines once for both workshop SVG previews and stage geometry so the crafted silhouette cannot drift between views.
- Judge migration status by live schema objects (scripts/supabase/classify-migrations-against-live.mjs), never by history versions or fake history rows; repo and live versions largely diverge. Catch-up work is new forward-only migrations.
- Uploaded garment GLBs live in the private curated-garments bucket, referenced by render_config.uploadedAssets per frame, and are published only via the admin RPC after client-side rule checks; this keeps unvalidated geometry out of the game.
