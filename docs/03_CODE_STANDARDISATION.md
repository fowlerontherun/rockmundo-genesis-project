# Technical Debt Backlog

## Purpose

This is a practical backlog for reducing bugs and preparing RockMundo for beta.

Do not treat this as a rewrite plan. Treat it as a cleanup and stabilisation plan.

## Priority levels

| Priority | Meaning |
|---|---|
| P0 | Blocks beta or risks player data |
| P1 | High bug risk or major maintainability issue |
| P2 | Important but can wait until after closed beta |
| P3 | Nice to have |

## P0: Beta blockers

1. Create a beta feature map: list every route/page and mark Core, Basic, Hidden, Admin Only, or Post Beta.
2. Verify every route loads without a crash.
3. Add a global error boundary.
4. Add a route-level loading pattern.
5. Add a route-level empty state pattern.
6. Add a route-level failed-query pattern.
7. Remove or hide unfinished pages from main navigation.
8. Audit Supabase RLS policies for player-owned data.
9. Ensure no client-side-only updates can award money, XP, fame, or premium items without validation.
10. Add basic error logging.
11. Add a bug report workflow visible to testers.
12. Ensure character creation cannot produce incomplete profiles.
13. Ensure dashboard handles new players with no data.
14. Ensure music loop works from fresh account to first release.
15. Ensure no page relies on missing seed/reference data.

## P1: High impact cleanup

16. Centralise Supabase client access.
17. Standardise query hooks using React Query.
18. Extract repeated Supabase queries into service functions.
19. Extract repeated calculations into domain utility modules.
20. Create shared types for common entities.
21. Create shared constants for status values.
22. Standardise toast/error messages.
23. Standardise confirmation dialogs.
24. Standardise card layout.
25. Standardise page headers.
26. Standardise table/list empty states.
27. Standardise forms with validation.
28. Remove unused imports and dead components.
29. Identify components over 500 lines and split only where risk is high.
30. Identify duplicated component folders with overlapping purpose.
31. Review packages and remove unused heavy dependencies where safe.
32. Fix lint warnings that indicate bugs.
33. Add smoke tests for core routes.
34. Add integration tests for character creation and first-song loop.
35. Add migration verification in CI.

## P1: Database debt

36. Count and document all migrations.
37. Create a clean beta baseline schema dump for new environments.
38. Keep old migrations in archive if needed, but make beta setup simple.
39. Document tables used by beta core features.
40. Add missing indexes on common `profile_id`, `user_id`, `created_at`, and `status` filters.
41. Add constraints for health/energy values.
42. Add constraints for money/XP where valid.
43. Audit foreign keys for core beta tables.
44. Add seed data checks.
45. Document RLS policy assumptions.

## P1: UI debt

46. Reduce sidebar width or add compact mode.
47. Reduce hero/header height on dense pages.
48. Make dashboard action-led rather than stats-led.
49. Add “next best action” panel.
50. Add a clear new-player checklist.
51. Make cards more informative: status, progress, action, reward.
52. Remove duplicate hub pages where they add an extra click without value.
53. Ensure health/energy critical states are visually obvious.
54. Group pages by player intent, not internal feature names.
55. Improve mobile navigation.

## P2: Maintainability improvements

56. Introduce `src/domains/music` for music calculations and service orchestration.
57. Introduce `src/domains/economy` for money calculations.
58. Introduce `src/domains/progression` for XP and skill calculations.
59. Introduce `src/domains/social` for relationships/social interactions.
60. Introduce `src/domains/world` for world/city/reference data.
61. Create feature README files only for complex domains.
62. Create ADRs for major decisions.
63. Create a “how to add a feature” checklist.
64. Add Storybook or isolated component previews later if useful.
65. Add bundle analysis.
66. Add query performance logging.
67. Add analytics events for core actions.
68. Add admin view for failed jobs/events.
69. Add safe maintenance mode.
70. Add feature flags.

## P2: Monetisation readiness

71. Create premium feature policy: never sell power.
72. Add premium page placeholder.
73. Add cosmetic inventory model if not already reliable.
74. Add entitlement table or service.
75. Add audit trail for purchases.
76. Add refund/admin adjustment plan.
77. Add price testing plan.
78. Add beta founder pack plan.
79. Add opt-in analytics consent if needed.
80. Add legal/privacy review checklist.

## P3: Later polish

81. Dashboard personality/manager tone.
82. Animated state changes.
83. Richer onboarding story.
84. More advanced notifications.
85. Better charts/graphs.
86. More advanced AI recommendations.
87. Seasonal events.
88. Advanced live ops tooling.
89. Public roadmap page.
90. Community voting.

## Practical 30-day beta cleanup sprint

### Week 1: Inventory and safety

- Route inventory
- Migration inventory
- RLS audit
- Hide unfinished pages
- Global error boundary

### Week 2: Core loop stability

- Character creation
- Dashboard
- First song/release loop
- XP/money validation
- Empty/loading/error states

### Week 3: UI standardisation

- Page headers
- Cards
- Sidebar/nav
- Dashboard actions
- Mobile fixes

### Week 4: Testing and beta release

- Smoke tests
- First-player journey tests
- Build/lint/test CI
- Beta checklist
- Invite testers

## Definition of done for debt tasks

A debt task is complete only when:

- code is changed
- tests or manual verification are added
- relevant docs are updated
- no new warnings are introduced
- beta checklist is updated if affected
