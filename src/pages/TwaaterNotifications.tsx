import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterNotifications } from "@/hooks/useTwaaterNotifications";
import { TwaaterLogo } from "@/components/twaater/TwaaterLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, Repeat2, MessageCircle, UserPlus, Quote, CheckCheck, Bell, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const notificationIcons: Record<string, typeof Heart> = {
  like: Heart,
  retwaat: Repeat2,
  reply: MessageCircle,
  follow: UserPlus,
  quote: Quote,
  mention: MessageCircle,
};

const notificationColors: Record<string, string> = {
  like: "text-red-500",
  retwaat: "text-green-500",
  reply: "text-[hsl(var(--twaater-purple))]",
  follow: "text-blue-500",
  quote: "text-orange-500",
  mention: "text-yellow-500",
};

export default function TwaaterNotifications() {
  const { profile } = useGameData();
  const navigate = useNavigate();
  const { account, isLoading: accountLoading } = useTwaaterAccount("persona", profile?.id);
  const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount } = useTwaaterNotifications(account?.id);

  if (!profile || accountLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "hsl(var(--twaater-bg))" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const filterNotifications = (type?: string) => {
    if (!type || type === "all") return notifications;
    return notifications?.filter((n: any) => n.type === type);
  };

  const renderNotification = (notification: any) => {
    const Icon = notificationIcons[notification.type] || Bell;
    const colorClass = notificationColors[notification.type] || "text-muted-foreground";

    return (
      <div
        key={notification.id}
        className={`flex items-start gap-3 p-4 border-b cursor-pointer transition-colors hover:bg-[hsl(var(--twaater-purple)_/_0.05)] ${
          !notification.read_at ? "bg-[hsl(var(--twaater-purple)_/_0.1)]" : ""
        }`}
        style={{ borderColor: "hsl(var(--twaater-border))" }}
        onClick={() => {
          if (!notification.read_at) markAsRead(notification.id);
          if (notification.related_twaat_id) {
            navigate(`/twaater/twaat/${notification.related_twaat_id}`);
          } else if (notification.source_account?.handle) {
            navigate(`/twaater/profile/${notification.source_account.handle}`);
          }
        }}
      >
        <div className={`p-2 rounded-full bg-background ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-[hsl(var(--twaater-purple)_/_0.2)]">
                {notification.source_account?.display_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm">
              {notification.source_account?.display_name || "Someone"}
            </span>
            <span className="text-xs text-muted-foreground">
              @{notification.source_account?.handle}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {notification.type === "like" && "liked your twaat"}
            {notification.type === "retwaat" && "retwaated your twaat"}
            {notification.type === "reply" && "replied to your twaat"}
            {notification.type === "follow" && "followed you"}
            {notification.type === "quote" && "quoted your twaat"}
            {notification.type === "mention" && "mentioned you"}
          </p>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </span>
        </div>
        {!notification.read_at && (
          <div className="h-2 w-2 rounded-full bg-[hsl(var(--twaater-purple))]" />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(var(--twaater-bg))" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-50 border-b px-4 py-3 flex items-center gap-4" style={{ backgroundColor: "hsl(var(--twaater-bg))", borderColor: "hsl(var(--twaater-border))" }}>
          <Button variant="ghost" size="icon" onClick={() => navigate("/twaater")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <TwaaterLogo size="sm" />
          <h1 className="font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="ml-auto text-[hsl(var(--twaater-purple))]"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-5" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">All</TabsTrigger>
            <TabsTrigger value="like" className="text-xs data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">Likes</TabsTrigger>
            <TabsTrigger value="reply" className="text-xs data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">Replies</TabsTrigger>
            <TabsTrigger value="retwaat" className="text-xs data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">Retwaats</TabsTrigger>
            <TabsTrigger value="follow" className="text-xs data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">Follows</TabsTrigger>
          </TabsList>

          {["all", "like", "reply", "retwaat", "follow"].map((type) => (
            <TabsContent key={type} value={type} className="mt-0">
              <Card style={{ backgroundColor: "hsl(var(--twaater-card))", border: "none", borderRadius: 0 }}>
                <CardContent className="p-0">
                  {filterNotifications(type)?.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No {type === "all" ? "" : type} notifications yet</p>
                    </div>
                  ) : (
                    filterNotifications(type)?.map(renderNotification)
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}