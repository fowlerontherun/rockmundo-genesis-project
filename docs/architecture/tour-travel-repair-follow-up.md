# Remaining Tour Manager migration

The page-level mutation bodies still need replacing with `useTourTravelRepair` in a follow-up that edits `src/pages/TourManager.tsx` only. This separation keeps the shared hook and its tests reviewable independently from the large legacy page diff.
