# D7 — Player company job boards and hiring pipeline

## Purpose

D7 closes the player-company recruitment lifecycle around the existing vacancy, application, offer and employee records. It keeps recruitment server-authoritative, auditable and compatible with the existing Employment marketplace.

## Live database authority

All D7 database changes were applied directly to the live Supabase project. No migration file is included in this PR.

Authoritative tables remain `company_vacancies`, `company_job_applications`, and `company_employees`. D7 adds `company_recruitment_events` as immutable recruitment evidence. Authenticated clients now have SELECT-only table access; lifecycle writes go through narrow RPCs.

## Lifecycle

1. An authorised company manager creates and publishes a vacancy.
2. Requirements can include city, minimum skill levels and minimum verified reputation.
3. An eligible player applies through `apply_to_company_vacancy`.
4. A manager can shortlist, reject or make a seven-day offer.
5. The applicant can withdraw before hiring, decline an offer, or accept it.
6. Offer acceptance creates employment once, increments filled positions and closes a filled vacancy.
7. Employment and recruitment history are retained rather than deleting cancelled vacancies or applications.

Every authoritative mutation on vacancies, applications and employment is mirrored into `company_recruitment_events` with server-side before/after evidence.

## Safety and eligibility

Applications fail closed when the role is full or closed, the applicant is in the wrong city, minimum skills are not met, verified D9 reputation is below the vacancy requirement, the applicant already works for the company, or the relevant player/company relationship is blocked.

## Labour market analytics

`get_company_labor_market_analytics` exposes read-only wage, vacancy, application and recent-hire reference data. It cannot mutate salary or employment state.

## Player surfaces

Company Recruitment provides vacancy creation, requirements, shortlist/offer/reject controls, preserved history and labour-market reference analytics. The existing Employment marketplace remains the applicant surface for browse, apply, withdraw, offer acceptance and decline.
