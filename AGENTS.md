# Project rules

- Reuse the shared character switcher in both shells with a shell-specific return destination; this keeps ownership and switching behavior consistent.
- Keep mobile shell and character-control translations in the typed playerControls locale catalogue merged into i18n; this ensures all supported languages expose the same controls.

- Luthiery shape and component variants must preserve existing selection IDs and use materials accepted by the authoritative crafting catalogue, so saved instruments and inventory remain compatible.
- Define luthiery body outlines once for both workshop SVG previews and stage geometry so the crafted silhouette cannot drift between views.
