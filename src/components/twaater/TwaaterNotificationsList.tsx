import { useTwaaterNotifications } from "@/hooks/useTwaaterNotifications";
import { Button } from "@/components/ui/button";
import { Loader2, Heart, Repeat2, MessageCircle, UserPlus, Quote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface TwaaterNotificationsListProps {
  accountId: string;
}

export const TwaaterNotificationsList = ({ accountId }: TwaaterNotificationsListProps) => {
  const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount } = useTwaaterNotifications(accountId);
  const navigate = useNavigate();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like": return <Heart className="h-4 w-4 text-red-500" />;
      case "retwaat": return <Repeat2 className="h-4 w-4 text-green-500" />;
      case "reply": return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case "follow": return <UserPlus className="h-4 w-4 text-purple-500" />;
      case "quote": return <Quote className="h-4 w-4 text-yellow-500" />;
      case "mention": return <MessageCircle className="h-4 w-4 text-cyan-500" />;
      default: return null;
    }
  };

  const getNotificationText = (notification: any) => {
    const account = notification.source_account;
    switch (notification.type) {
      case "like": return `@${account.handle} liked your twaat`;
      case "retwaat": return `@${account.handle} retwaated your twaat`;
      case "reply": return `@${account.handle} replied to your twaat`;
      case "follow": return `@${account.handle} followed you`;
      case "quote": return `@${account.handle} quoted your twaat`;
      case "mention": return `@${account.handle} mentioned you`;
      default: return "New notification";
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    
    if (notification.type === "follow") {
      navigate(`/twaater/${notification.source_account.handle}`);
    } else if (notification.related_twaat_id) {
      navigate("/twaater");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-h-[600px] overflow-y-auto">
      <div className="sticky top-0 bg-background border-b p-3 flex items-center justify-between">
        <h3 className="font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllAsRead()}>
            Mark all read
          </Button>
        )}
      </div>

      {!notifications || notifications.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <p>No notifications yet</p>
        </div>
      ) : (
        <div>
          {notifications.map((notification: any) => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`w-full p-3 border-b hover:bg-accent/50 transition-colors text-left ${
                !notification.read_at ? "bg-accent/20" : ""
              }`}
            >
              <div className="flex gap-3">
                <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{getNotificationText(notification)}</p>
                  {notification.related_twaat?.body && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      "{notification.related_twaat.body}"
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};