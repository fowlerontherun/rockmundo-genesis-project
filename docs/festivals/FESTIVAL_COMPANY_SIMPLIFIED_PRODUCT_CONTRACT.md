# Simplified Company-Owned Festival Product Contract

Status: **Authoritative product direction**

This document supersedes any player-facing Festival design that resembles professional event-management software.

## Core identity

A Festival is a **player-owned company type**. The company is the permanent gameplay object and owns:

- its company balance and transaction history;
- reputation and licence progression;
- the agreed eleven upgrade categories;
- staff relationships and company permissions;
- the Festival name, identity, vibe and default location preferences;
- the history of every annual Festival it has run.

An annual edition is a lightweight yearly event owned by that company. It exists so dates, line-ups, results and history are not overwritten, but it is not a second business-management game.

## Main player loop

1. Found or open the Festival company.
2. Fund it through the normal company-finance system.
3. Improve the Festival through its eleven upgrade categories.
4. Plan the next annual Festival using a small number of high-impact choices.
5. Select or approve the line-up and set the artist budget.
6. Set the standard ticket price and tickets available.
7. Launch the Festival.
8. The game automatically creates the operational detail, running order and outcome.
9. Revenue, costs, reputation, fans and history are applied to the Festival company.

## Annual Festival decisions

The owner should make only decisions that are meaningful in a music-management game:

- Festival dates or preferred month;
- city and broad site approach;
- Festival type, vibe and genre identity;
- licensed size/scale and duration;
- headline and line-up strategy;
- total artist budget;
- standard ticket price and tickets available;
- marketing emphasis;
- whether to launch when readiness is sufficient.

The game derives detailed operating requirements from these choices, company upgrades, licence tier, reputation, city conditions and random events.

## Eleven upgrade categories

The existing categories remain the long-term company progression system:

1. Site Infrastructure
2. Stages and Production
3. Security and Crowd Control
4. Medical and Welfare
5. Sanitation and Utilities
6. Artist and Backstage Facilities
7. Audience Facilities
8. Camping and Accommodation
9. Transport and Access
10. Marketing and Media
11. Sustainability and Technology

Players buy upgrades from the Festival company's funds. Upgrade levels influence capacity, quality, operating cost, risk, reputation, artist attraction, audience satisfaction and revenue. Players do not manually administer the underlying operational detail.

## Player-facing screens

The intended owner journey is deliberately small:

- **Festival company** — balance, reputation, licence, current annual Festival and company actions.
- **Upgrades** — the eleven upgrade categories and licence progression.
- **Plan** — dates, place, vibe, size and readiness summary.
- **Line-up** — line-up approach, artist budget, applications/invitations and confirmed acts.
- **Tickets & budget** — standard price, available tickets and a simple forecast.
- **Run Festival** — launch/readiness and the live outcome.
- **Results** — immutable annual history.

Detailed schedule, contracts, supplier, staffing, permit and settlement workspaces must not appear in the normal owner navigation.

## Internal simulation, not player administration

The simulation may still calculate:

- stage count and running order;
- security, medical, sanitation and transport requirements;
- staff and supplier costs;
- artist agreements and fallback NPC acts;
- weather, congestion, technical and safety risks;
- ticket demand, attendance, food/drink/merchandise revenue and final settlement.

These are generated from the owner's high-level choices and upgrades. They should be surfaced as concise readiness warnings, costs and outcomes rather than multi-step administration forms.

## Annual automation rules

- The game creates the running order automatically from confirmed acts, billing importance, stage capacity and available Festival hours.
- Empty line-up spaces are filled with suitable NPC acts when allowed.
- Operational costs are calculated automatically before launch.
- The owner sees blockers and warnings, but does not build shift rosters, supplier tenders or permit records.
- Launch freezes the annual plan.
- Completion performs server-authoritative settlement and creates immutable history.

## Compatibility policy

Existing detailed Festival tables and RPCs may remain temporarily as internal implementation machinery. They must not dictate the product experience.

Legacy or detailed owner URLs should redirect to the nearest simplified company-owned screen. New work must extend the simplified company loop rather than adding new operational workspaces.

## Explicit non-goals

The normal Festival owner will not:

- edit a minute-by-minute stage timetable;
- configure stage opening and curfew rows;
- create technical stage specifications;
- build staff departments or individual shifts;
- compare supplier tenders;
- manage permits or insurance records;
- negotiate multi-revision legal-style contracts;
- configure multiple ticket-product release phases;
- manually execute settlement batches.

Those systems may be represented by automatic calculations, events and concise choices only.
