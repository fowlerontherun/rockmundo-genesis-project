# ADR 0001 — Festival as a company type

Date: 2026-07-23
Status: Accepted

## Context

Festivals need year-round balance, upgrades, staff and finances that
already exist for the company system. Building a parallel entity would
duplicate ownership, taxation, employees and transactions.

## Decision

A festival is a **new company type** ("festival") layered on the existing
company aggregate. The festival-specific state (upgrades, editions,
stages, applications, contracts, tickets, history) lives in
`festival_company_*` tables that FK to `companies.id`.

## Consequences

- Reuses company ownership, transactions, taxation and permissions.
- Personal→company transfers are the standard company transfer flow.
- Company balance is the festival's operating balance.
- Requires a `company_type` value and small UI branching in the company
  console to surface festival-specific tabs.
