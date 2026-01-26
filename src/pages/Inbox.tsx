import { useState, useMemo } from "react";
import { Inbox as InboxIcon, CheckCheck, Settings } from "lucide-react";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInbox, useUnreadInboxCount, type InboxCategory, type InboxMessage as InboxMessageType } from "@/hooks/useInbox";
import { InboxMessage } from "@/components/inbox/InboxMessage";
import { InboxFilters } from "@/components/inbox/InboxFilters";
import { InboxEmptyState } from "@/components/inbox/InboxEmptyState";

type DateGroup = 'today' | 'yesterday' | 'this_week' | 'older';

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  if (isThisWeek(date)) return 'this_week';
  return 'older';
}

const dateGroupLabels: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  older: 'Older',
};

export default function InboxPage() {
  const [activeFilter, setActiveFilter] = useState<InboxCategory | 'all'>('all');
  const { messages, isLoading, markAsRead, markAllAsRead, archiveMessage, deleteMessage } = useInbox(activeFilter);
  const { data: unreadCount } = useUnreadInboxCount();

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: Record<DateGroup, InboxMessageType[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      older: [],
    };

    messages.forEach((msg) => {
      const group = getDateGroup(msg.created_at);
      groups[group].push(msg);
    });

    return groups;
  }, [messages]);

  // Count messages per category for filter badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((msg) => {
      counts[msg.category] = (counts[msg.category] || 0) + 1;
    });
    return counts;
  }, [messages]);

  const hasMessages = messages.length > 0;
  const hasUnread = (unreadCount || 0) > 0;

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <InboxIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-oswald">Inbox</h1>
            {hasUnread && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnread && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead()}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <InboxFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={categoryCounts}
      />

      {/* Messages */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !hasMessages ? (
        <InboxEmptyState filter={activeFilter} />
      ) : (
        <div className="space-y-6">
          {(Object.keys(dateGroupLabels) as DateGroup[]).map((group) => {
            const groupMessages = groupedMessages[group];
            if (groupMessages.length === 0) return null;

            return (
              <div key={group} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {dateGroupLabels[group]}
                </h3>
                <div className="space-y-2">
                  {groupMessages.map((message) => (
                    <InboxMessage
                      key={message.id}
                      message={message}
                      onMarkAsRead={markAsRead}
                      onArchive={archiveMessage}
                      onDelete={deleteMessage}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
