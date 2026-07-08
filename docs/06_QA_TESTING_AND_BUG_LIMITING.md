# UI/UX Standardisation Plan

## Purpose

Improve the existing RockMundo UI for beta without redesigning everything.

The current UI has a strong visual identity. The beta task is not to replace it; it is to make it clearer, more consistent, and more action-led.

## Core UI problem

Many screens look good, but too many elements compete equally for attention.

For beta, every page should answer:

1. Where am I?
2. What matters here?
3. What should I do next?
4. What happens if I click this?

## Beta UI principles

### 1. The dashboard should guide the player

The dashboard should not just show stats. It should tell the player what to do next.

Add:

- today’s recommended action
- urgent warnings
- active projects
- upcoming events
- recent progress
- new messages

### 2. Cards must be useful

Avoid cards that only show an image, title, and open button.

Every feature card should include at least two of:

- current status
- progress
- time remaining
- reward
- risk
- recommended action
- locked/unlocked state

### 3. Reduce empty hubs

If a hub page only adds a click, simplify it.

For beta, prefer:

```text
Music → Songwriting
Music → Recording
Music → Releases
```

rather than:

```text
Music → Music Hub → Recording
```

### 4. Visual priority

Every screen should have one primary action.

Examples:

- Write Song
- Record Song
- Release Single
- Rest
- Rehearse
- Respond to Message

Secondary actions should be visually quieter.

### 5. State should feel alive

If health is critically low, the UI should show it.

Examples:

- warning card
- red/critical badge
- blocked risky activities
- manager/doctor notification

## Standard page layout

```text
Page Header
- title
- short explanation
- primary action

Status Strip
- key stats relevant to the page

Main Content
- active project/current state
- available actions
- history/recent activity

Help/Guidance
- what to do next
```

## Standard dashboard layout

```text
Top Status Bar

Today's Briefing
- recommended action
- urgent warnings

Current Career Focus
- song/album/gig/project progress

Messages & Notifications

Quick Actions

Recent Changes

Upcoming Events
```

## Navigation recommendations

For beta, use fewer top-level sections:

- Dashboard
- Character
- Music
- Band
- World
- Social
- Career
- Store

Hide unstable features from the main nav.

## Sidebar improvements

- Add compact/collapsed mode.
- Group related links clearly.
- Avoid long lists of equal-weight items.
- Use badges only when they represent meaningful action.
- Avoid exposing unfinished systems.

## Hero/banner improvements

Current hero sections look strong but can consume too much vertical space.

Beta standard:

- reduce large hero heights by 25–40%
- put action summary above the fold
- avoid purely decorative space on functional pages

## Standard components

Create or standardise:

### `PageHeader`

Fields:

- title
- subtitle
- icon
- primary action
- secondary action

### `ActionCard`

Fields:

- title
- description
- status
- progress
- reward
- risk
- primary action

### `StatusCard`

Fields:

- label
- value
- trend
- state
- explanation

### `EmptyState`

Fields:

- icon
- title
- explanation
- primary action

### `ErrorState`

Fields:

- title
- friendly explanation
- retry action
- report bug action

## Empty state examples

Bad:

> No songs found.

Good:

> You have not written your first song yet. Start with songwriting to create a track you can record and release.

Button:

> Write First Song

## Beta onboarding UI

Add a simple checklist:

- Create character
- Choose starting genre
- Write first song
- Record first song
- Release first song
- Check chart/reaction
- Improve skill
- Join or create band

## Mobile requirements

For beta:

- top status bar must not overflow
- sidebar must collapse
- cards must stack cleanly
- primary action must remain visible
- tables need mobile alternatives

## UI bug checklist

For every page:

- loading state exists
- empty state exists
- error state exists
- mobile layout checked
- no horizontal overflow
- primary action obvious
- destructive actions confirm
- invalid actions disabled or explained
- badges mean something

## UI acceptance criteria for beta

A new tester should be able to log in and understand within 60 seconds:

- who their character is
- current health/energy/money/fame
- what they are working on
- what they should do next
- where to go for music progress
- where to report a bug
