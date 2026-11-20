# Project rules

- Festival invitation withdrawals use authenticated server actions with band/organiser permission checks, version locks and audit history; never mutate invitation rows from the browser.
- Annual-edition preparation belongs to current artist bookings, not legacy contracts; private authenticated actions validate ownership, version and dates before saving without inventing rewards.
- Mobile festival details reuse the public ticket/check-in page so character, wallet and scheduling guards remain identical.
- Resolve full parent-scoped JSX route paths before festival certification comparisons so mobile and desktop destinations are not mistaken for duplicates.

- Reuse the shared character switcher in both shells with a shell-specific return destination; this keeps ownership and switching behavior consistent.
- Keep mobile shell and character-control translations in the typed playerControls locale catalogue merged into i18n; this ensures all supported languages expose the same controls.

- Luthiery shape and component variants must preserve existing selection IDs and use materials accepted by the authoritative crafting catalogue, so saved instruments and inventory remain compatible.
- TV performance camera paths and restrained performer motion are pure replay-time presentation helpers bounded by shared studio geometry; this preserves seeking, export consistency and gameplay isolation.
- Define luthiery body outlines once for both workshop SVG previews and stage geometry so the crafted silhouette cannot drift between views.
- Judge migration status by live schema objects (scripts/supabase/classify-migrations-against-live.mjs), never by history versions or fake history rows; repo and live versions largely diverge. Catch-up work is new forward-only migrations.
- Uploaded garment GLBs live in the private curated-garments bucket, referenced by render_config.uploadedAssets per frame, and are published only via the admin RPC after client-side rule checks; this keeps unvalidated geometry out of the game.
- Resolve curated trouser donors through the shared clothing resolver and paint textile patterns on skinned UVs, not detached panels; creator, previews and stage must use the same fitted garment.
- Keep guitar fittings named and individually material-owned in the shared stage builder so saved hardware finishes cannot recolour strings or unrelated parts.
- Render instrument store stills with the shared stage instrument builder, releasing WebGL resources after capture; product pictures must match equipped visuals.
- Validate static hub responses as images and fall back to destination icons on load failure; SPA HTML fallback responses must never be treated as artwork.
- University completion uses the saved enrollment deadline and an atomic, unique completion receipt independently of daily attendance; this prevents stuck courses and duplicate completion rewards.

- Band chat stores the account UUID in user_id and the author character UUID in profile_id; never infer a legacy author from sibling characters.
- Social room and scene caches include the active character, and shared social updates combine cleaned-up realtime listeners with visible-page polling for tables without publication.
- Personal roleplay recap drafts carry the character identity and contain no private scene title, guests or dialogue; publishing stays in the normal Twaater composer.
- Room access policies validate the active character through a private helper; write triggers lock open scenes so ended scenes cannot accept messages or interactions.
- Festival founding and annual setup share a five-step shell; edition branding uses version-checked private actions and atomic annual-plan saves, so cosmetic choices cannot alter gameplay or bypass locks.
