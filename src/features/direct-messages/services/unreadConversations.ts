/**
 * Collect unread totals from all conversation pages. The D4 RPC may cap
 * p_page_limit below our requested size: short pages are not exhaustion.
 * The first fetch synchronises current band/company/tour/festival membership.
 */
export interface UnreadConversationPage {
  unread_count: number;
  last_message_at: string | null;
}

export async function countUnreadConversations(
  fetchPage: (options: {
    limit: number;
    cursor: string | null;
    skipContextSync: boolean;
  }) => Promise<ReadonlyArray<UnreadConversationPage>>,
  verifyActiveProfile: () => Promise<void>,
): Promise<number> {
  let total = 0;
  let cursor: string | null = null;
  await verifyActiveProfile();

  for (let page = 0; page < 100; page++) {
    const conversations = await fetchPage({ limit: 100, cursor, skipContextSync: page > 0 });
    await verifyActiveProfile();
    if (conversations.length === 0) return total;
    total += conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0);
    const nextCursor: string | null = conversations[conversations.length - 1]?.last_message_at ?? null;
    if (!nextCursor) {
      // Current D4 permits 100 rows per page. A short final page can contain
      // empty threads (no last_message_at), which have no activity cursor.
      // Never silently truncate when a full page lacks a usable cursor.
      if (conversations.length < 100 && conversations[conversations.length - 1]?.unread_count === 0) return total;
      throw new Error("Cannot paginate unread conversations safely");
    }
    if (nextCursor === cursor) {
      throw new Error("Cannot paginate unread conversations safely");
    }
    cursor = nextCursor;
  }
  throw new Error("Unread conversations exceed the supported scan limit");
}
