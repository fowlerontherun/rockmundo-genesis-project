import { describe, expect, it } from "vitest";
import type { InboxMessage } from "@/hooks/useInbox";
import { messagesRepresentSameEvent } from "@/hooks/useUnifiedInbox";

const baseMessage = (overrides: Partial<InboxMessage> = {}): InboxMessage => ({
  id: "inbox-1",
  user_id: "user-1",
  category: "gig_result",
  priority: "normal",
  title: "Gig complete: The Venue",
  message: "4 stars",
  metadata: { gig_id: "gig-1", outcome_id: "outcome-1" },
  action_type: "navigate",
  action_data: { route: "/gigs" },
  related_entity_type: "gig",
  related_entity_id: "gig-1",
  is_read: false,
  is_archived: false,
  expires_at: null,
  created_at: "2026-08-22T10:00:00.000Z",
  ...overrides,
});

describe("unified Inbox deduplication", () => {
  it("treats mirrored player_inbox and notifications rows as the same event", () => {
    const inboxMessage = baseMessage();
    const notificationMessage = baseMessage({
      id: "notification:notification-1",
      related_entity_type: null,
      related_entity_id: null,
      metadata: { gig_id: "gig-1", outcome_id: "outcome-1" },
    });

    expect(messagesRepresentSameEvent(inboxMessage, notificationMessage)).toBe(true);
  });

  it("does not collapse separate events that happen to share a category", () => {
    const first = baseMessage();
    const second = baseMessage({
      id: "notification:notification-2",
      title: "Gig complete: Another Venue",
      related_entity_type: null,
      related_entity_id: null,
      metadata: { gig_id: "gig-2", outcome_id: "outcome-2" },
    });

    expect(messagesRepresentSameEvent(first, second)).toBe(false);
  });

  it("requires matching event identity as well as title", () => {
    const first = baseMessage();
    const second = baseMessage({
      id: "notification:notification-3",
      related_entity_type: null,
      related_entity_id: null,
      metadata: { gig_id: "gig-2", outcome_id: "outcome-2" },
    });

    expect(messagesRepresentSameEvent(first, second)).toBe(false);
  });
});
