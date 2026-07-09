import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, CheckCircle, AlertTriangle, Info, Gift, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, error, refetch, markAllRead, dismiss, clearAll, markRead } =
    useNotificationsFeed();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      setTimeout(() => markAllRead(), 1500);
    }
  };

  const handleClick = (n: PersistedNotification) => {
    if (!n.read_at) markRead(n.id);
    if (n.action_path) {
      setOpen(false);
      navigate(n.action_path);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearAll()} className="text-xs h-7">
              Clear all
            </Button>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-70" />
              <p className="text-sm font-medium">Loading notifications</p>
              <p className="text-xs">Checking for new player updates...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm font-medium text-foreground">Notifications unavailable</p>
              <p className="text-xs mb-3">Try refreshing the feed.</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No notifications yet</p>
              <p className="text-xs">Important gigs, offers, milestones, and social updates will appear here.</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notifications.map((n) => {
                const display = normalizeNotification(n);
                const Icon = ICON_MAP[n.type] ?? ICON_MAP[n.category] ?? Info;
                const colorClass = COLOR_MAP[n.type] ?? COLOR_MAP[n.category] ?? "text-blue-500";
                const isRead = display.isRead;
                return (
                  <div key={n.id}>
                    <div
                      onClick={() => handleClick(n)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        isRead ? "bg-muted/30" : "bg-muted/70 hover:bg-muted"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", colorClass)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm leading-tight">{n.title}</p>
                          {!isRead && <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-2">
                          {display.body}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{display.categoryLabel}</Badge>
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] capitalize", PRIORITY_BADGE[display.priority])}>{display.priority}</Badge>
                          <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                          <span>{isRead ? "Read" : "Unread"}</span>
                        </div>
                        {display.actionLabel && (
                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                            {display.actionLabel}<ExternalLink className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
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
