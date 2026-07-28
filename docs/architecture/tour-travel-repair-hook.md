# Authoritative tour travel repair hook

`useTourTravelRepair` centralises cache invalidation, success messaging and database error handling for the two transactional travel repair RPCs.

This prepares Tour Manager to replace its legacy browser-side write loops without duplicating repair behaviour in the page component.
