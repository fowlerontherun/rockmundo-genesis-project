import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, CheckCircle, AlertTriangle, Info, Gift, Loader2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationsFeed, type PersistedNotification } from "@/hooks/useNotificationsFeed";
import { normalizeNotification, type NotificationPriority } from "@/lib/notificationModels";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
  achievement: Gift,
  offer: Bell,
};

const PRIORITY_BADGE: Record<NotificationPriority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-warning/15 text-warning border-warning/30",
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
};

const COLOR_MAP: Record<string, string> = {
  success: "text-green-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
  achievement: "text-purple-500",
  offer: "text-primary",
};

const HIDDEN_METADATA = new Set([
  "priority",
  "band_id",
  "profile_id",
  "user_id",
  "gig_id",
  "activity_id",
  "source_activity_id",
  "band_application_id",
  "band_invitation_id",
]);

const humanizeKey = (key: string) => key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ");
  return null;
};

const OutcomeDetails = ({ notification }: { notification: PersistedNotification }) => {
  const details = Object.entries(notification.metadata ?? {})
    .filter(([key]) => !HIDDEN_METADATA.has(key))
    .map(([key, value]) => ({ key, value: formatValue(value) }))
    .filter((item): item is { key: string; value: string } => Boolean(item.value));

  if (details.length === 0) {
    return <p className="text-xs text-muted-foreground">No additional outcome details were recorded for this update.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      {details.map(({ key, value }) => (
        <div key={key} className="rounded-md border bg-background/60 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{humanizeKey(key)}</p>
          <p className="mt-0.5 text-xs font-medium break-words">{value}</p>
        </div>
      ))}
    </div>
  );
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, error, refetch, markAllRead, dismiss, clearAll, markRead } = useNotificationsFeed();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (n: PersistedNotification) => {
    const next = expandedId === n.id ? null : n.id;
    setExpandedId(next);
    if (next && !n.read_at) markRead(n.id);
  };

  const openAction = (n: PersistedNotification) => {
    const display = normalizeNotification(n);
    if (!n.read_at) markRead(n.id);
    if (display.routePath) {
      setOpen(false);
      navigate(display.routePath);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(96vw,28rem)] p-0" align="end">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <div>
            <h4 className="font-semibold">Inbox & outcomes</h4>
            <p className="text-xs text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You're up to date"}</p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={() => markAllRead()} className="text-xs h-7">Mark all read</Button>}
            {notifications.length > 0 && <Button variant="ghost" size="sm" onClick={() => clearAll()} className="text-xs h-7">Clear all</Button>}
          </div>
        </div>
        <ScrollArea className="h-[440px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-70" />
              <p className="text-sm font-medium">Loading your world updates</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm font-medium text-foreground">Inbox unavailable</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>Retry</Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">Nothing new yet</p>
              <p className="text-xs">Practice, rehearsals, gigs, PR, random events and world updates will appear here.</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notifications.map((n) => {
                const display = normalizeNotification(n);
                const Icon = ICON_MAP[n.type] ?? ICON_MAP[n.category] ?? Info;
                const colorClass = COLOR_MAP[n.type] ?? COLOR_MAP[n.category] ?? "text-blue-500";
                const expanded = expandedId === n.id;
                return (
                  <div key={n.id} className={cn("rounded-lg border transition-colors", display.isRead ? "bg-muted/20" : "bg-muted/60 border-primary/20")}>
                    <div className="flex items-start gap-3 p-3">
                      <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", colorClass)} />
                      <button type="button" onClick={() => toggleExpanded(n)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm leading-tight">{n.title}</p>
                          {!display.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" aria-label="Unread" />}
                        </div>
                        <p className={cn("text-xs text-muted-foreground mt-1 break-words", expanded ? "" : "line-clamp-2")}>{display.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{display.categoryLabel}</Badge>
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] capitalize", PRIORITY_BADGE[display.priority])}>{display.priority}</Badge>
                          <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                          <span className="inline-flex items-center gap-0.5">{expanded ? "Less" : "Details"}{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</span>
                        </div>
                      </button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => dismiss(n.id)}><X className="h-3 w-3" /></Button>
                    </div>
                    {expanded && (
                      <div className="border-t px-3 pb-3 pt-3 ml-8">
                        <OutcomeDetails notification={n} />
                        {display.actionLabel && display.routePath && (
                          <Button size="sm" variant="link" className="mt-2 h-auto p-0 text-xs" onClick={() => openAction(n)}>
                            {display.actionLabel}<ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
