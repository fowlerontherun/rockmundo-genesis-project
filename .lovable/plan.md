
# Player Inbox System

## Version: 1.0.511

## Overview
Create a new dedicated Inbox page at the top of navigation that consolidates all player-relevant messages, offers, and notifications into a persistent, organized interface. Messages will be stored in the database so they persist across sessions.

---

## Features

### Message Categories
The inbox will organize messages into these categories:
1. **Random Events** - Event outcomes and pending decisions
2. **Gig Results** - Performance outcomes, earnings, reputation changes
3. **PR & Media** - Media appearance invites and results
4. **Record Labels** - Contract offers and negotiations
5. **Sponsorships** - Brand deal offers and payments
6. **Financial** - Daily streaming revenue, record sales, ticket sales summaries
7. **Social** - Friend requests, band invitations, Twaater mentions
8. **Achievements** - Unlocked achievements and milestones

### Inbox Features
- Unread count badge in navigation
- Filter by category
- Mark as read / Mark all as read
- Archive/delete functionality
- Quick action buttons (Accept/Decline/View)
- Date grouping (Today, Yesterday, This Week, Older)

---

## Implementation Plan

### Phase 1: Database Schema

**New Migration: Create `player_inbox` table**

```sql
CREATE TYPE inbox_category AS ENUM (
  'random_event', 'gig_result', 'pr_media', 'record_label', 
  'sponsorship', 'financial', 'social', 'achievement', 'system'
);

CREATE TYPE inbox_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE player_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category inbox_category NOT NULL,
  priority inbox_priority NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  action_type text, -- 'accept_decline', 'view_details', 'navigate', null
  action_data jsonb, -- { route: '/gigs', offerId: 'xxx', etc }
  related_entity_type text, -- 'gig', 'sponsorship', 'contract', etc
  related_entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_inbox_user_unread ON player_inbox(user_id, is_read) WHERE is_archived = false;
CREATE INDEX idx_player_inbox_user_category ON player_inbox(user_id, category) WHERE is_archived = false;

-- RLS policies
ALTER TABLE player_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inbox" ON player_inbox
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own inbox" ON player_inbox
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert inbox messages" ON player_inbox
  FOR INSERT WITH CHECK (true);
```

### Phase 2: Create Inbox Page

**New File: `src/pages/Inbox.tsx`**

Features:
- Header with unread count and "Mark all read" button
- Category filter tabs (All, Events, Gigs, Financial, Social, etc.)
- Message list with:
  - Category icon and color coding
  - Priority indicator for urgent items
  - Title and preview text
  - Timestamp (relative: "2 hours ago")
  - Action buttons based on `action_type`
  - Read/unread visual state
- Empty state with helpful message
- Archive/delete actions

### Phase 3: Create Inbox Hook

**New File: `src/hooks/useInbox.ts`**

```typescript
export function useInbox() {
  // Fetch all inbox messages for user
  // Provide filtering by category
  // Mark as read mutations
  // Archive/delete mutations
  // Real-time subscription for new messages
}

export function useUnreadInboxCount() {
  // Lightweight query for just the unread count
  // Used in navigation badge
}
```

### Phase 4: Update Navigation

**File: `src/components/ui/navigation.tsx`**

Add Inbox at the top of the Home section with unread badge:
```typescript
{
  titleKey: "nav.home",
  items: [
    { icon: Inbox, labelKey: "nav.inbox", path: "/inbox", badge: unreadCount },
    { icon: Home, labelKey: "nav.dashboard", path: "/dashboard" },
    // ... rest
  ],
}
```

### Phase 5: Create Inbox Message Population

**New Edge Function: `supabase/functions/create-inbox-message/index.ts`**

Helper function that other edge functions can call to create inbox messages. This centralizes message creation logic.

**Update Existing Edge Functions to Create Inbox Messages:**

| Edge Function | Inbox Message Type |
|---------------|-------------------|
| `complete-gigs` | Gig result with earnings, reputation change |
| `process-daily-updates` | Daily financial summary (streams, sales, tickets) |
| `generate-gig-offers` | New gig offer notification |
| `generate-sponsorship-offers` | New sponsorship offer |
| `process-random-events` | Event triggered, outcome applied |
| `choose-event-option` | Outcome message when applied |

### Phase 6: Daily Financial Summary Message

**Update: `supabase/functions/process-daily-updates/index.ts`**

At the end of daily processing, create a summary inbox message per player:
- Total streaming revenue earned
- Physical/digital sales
- Ticket sales for upcoming gigs
- Any significant changes

Example message:
> **Daily Earnings Summary**
> Streaming: $45.23 (12,450 streams)
> Record Sales: $150.00 (10 CDs, 2 vinyl)
> Ticket Sales: 47 tickets sold for upcoming gigs

### Phase 7: Inbox Message Components

**New File: `src/components/inbox/InboxMessage.tsx`**
- Message card component with category styling
- Action buttons (Accept/Decline/View)
- Read/unread states
- Archive action

**New File: `src/components/inbox/InboxFilters.tsx`**
- Category filter tabs
- Date range filter
- Priority filter

**New File: `src/components/inbox/InboxEmptyState.tsx`**
- Friendly empty state when no messages

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx_create_inbox.sql` | CREATE | New inbox table with RLS |
| `src/pages/Inbox.tsx` | CREATE | Main inbox page |
| `src/hooks/useInbox.ts` | CREATE | Inbox data hook |
| `src/components/inbox/InboxMessage.tsx` | CREATE | Message item component |
| `src/components/inbox/InboxFilters.tsx` | CREATE | Filter tabs component |
| `src/components/inbox/InboxEmptyState.tsx` | CREATE | Empty state component |
| `src/components/ui/navigation.tsx` | MODIFY | Add inbox link with badge |
| `supabase/functions/create-inbox-message/index.ts` | CREATE | Helper for creating messages |
| `supabase/functions/complete-gigs/index.ts` | MODIFY | Add inbox message on completion |
| `supabase/functions/process-daily-updates/index.ts` | MODIFY | Add daily summary message |
| `supabase/functions/choose-event-option/index.ts` | MODIFY | Add outcome message |
| `src/App.tsx` | MODIFY | Add route for /inbox |
| `src/components/VersionHeader.tsx` | MODIFY | Update to v1.0.511 |
| `src/pages/VersionHistory.tsx` | MODIFY | Add changelog entry |

---

## UI Design

### Inbox Page Layout

```text
┌─────────────────────────────────────────────────┐
│ 📥 Inbox                     [Mark all read] ⚙️  │
├─────────────────────────────────────────────────┤
│ [All] [Events] [Gigs] [Money] [Social] [Labels] │
├─────────────────────────────────────────────────┤
│ TODAY                                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🎲 Random Event               2 hours ago   │ │
│ │ Equipment Malfunction                       │ │
│ │ Your amp blew a fuse during practice...     │ │
│ │                    [Make a Choice →]        │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ 💰 Daily Summary              This morning  │ │
│ │ Yesterday's Earnings                        │ │
│ │ Streaming: $45 • Sales: $150 • 47 tickets   │ │
│ │                    [View Details →]         │ │
│ └─────────────────────────────────────────────┘ │
│ YESTERDAY                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🎸 Gig Result                    ✓ Read     │ │
│ │ Great show at The Roxy!                     │ │
│ │ Earned $1,200 • +15 reputation • 450 fans   │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Category Icons & Colors
| Category | Icon | Color |
|----------|------|-------|
| Random Events | 🎲 Dice | Yellow |
| Gig Results | 🎸 Guitar | Green |
| PR/Media | 📺 TV | Blue |
| Record Labels | 💿 Disc | Purple |
| Sponsorships | 🤝 Handshake | Teal |
| Financial | 💰 Money | Green |
| Social | 👥 Users | Pink |
| Achievements | 🏆 Trophy | Gold |

---

## Version History Entry

**v1.0.511**
- NEW: Inbox page - centralized hub for all player messages and notifications
- Inbox: Random event outcomes and pending decisions
- Inbox: Gig results with earnings and reputation changes
- Inbox: PR and media appearance invites
- Inbox: Sponsorship and contract offers
- Inbox: Daily financial summary (streaming, sales, tickets)
- Inbox: Friend requests and band invitations
- Inbox: Filter messages by category
- Inbox: Mark as read and archive functionality
- Inbox: Unread count badge in navigation
