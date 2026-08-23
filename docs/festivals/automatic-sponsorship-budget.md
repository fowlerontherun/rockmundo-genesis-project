# Simplified Festival sponsorship and budget

Festival owners do not manage a separate sponsorship workflow in the simplified Festival system.

The game calculates sponsorship automatically from:

- planned Festival capacity
- annual-plan marketing demand
- Festival company reputation
- the active Marketing & Media upgrade

Sponsorship is capped so it can materially help an event without underwriting the entire operating cost.

The Tickets & budget screen combines the current ticket forecast with the same food, drink and merchandise assumptions used by the simplified runtime. It shows projected total revenue, operating cost and net result before the Festival is run.

When the Festival completes, the same server-side sponsorship authority is included in the final settlement. Sponsorship therefore contributes to real Festival revenue, company profit/loss and the owner Results screen.

The internal sponsorship calculation is not executable by authenticated browser clients. Owners access only the authorised `get_festival_edition_budget_forecast` RPC, which checks Festival-company manager authority.
