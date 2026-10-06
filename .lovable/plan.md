# Translation review and mobile character switching

- Check all nine maintained languages against the English translation keys and repair missing copy found by the review.
- Translate the mobile top bar, bottom navigation, quick actions and character menu, and add a language selector to mobile.
- Put character switching in the mobile top bar, reusing the existing account-owned character menu. Keep players in the mobile experience after switching, show progress and prevent repeated clicks.
- Preserve character ownership, revival and slot limits; no changes to game rules or account permissions.
- Test translation coverage, language changes and mobile character selection, including failure recovery.
- Update the banner and version history to **1.1.766**.

## Technical details
- Reuse `CharacterSwitcher` and its existing mutation rather than adding a second switching implementation.
- Maintain translated shell and character copy for every supported locale, with English fallback for legacy language preferences.
- Verify the preview and focused tests; report any account-specific verification limits.