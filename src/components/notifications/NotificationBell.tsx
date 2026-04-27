import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, CheckCircle, AlertTriangle, Info, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationsFeed, type PersistedNotification } from "@/hooks/useNotificationsFeed";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
  achievement: Gift,
  offer: Bell,
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
  const { notifications, unreadCount, markAllRead, dismiss, clearAll, markRead } =
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
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notifications.map((n) => {
                const Icon = ICON_MAP[n.type] ?? Info;
                const colorClass = COLOR_MAP[n.type] ?? "text-blue-500";
                const isRead = !!n.read_at;
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
                        <p className="font-medium text-sm">{n.title}</p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 break-words">
                            {n.message}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
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
