import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Mail, Search } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useGameData } from "@/hooks/useGameData";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";

const TITLES: Record<string, string> = {
  "/mobile": "Today",
  "/mobile/career": "Career",
  "/mobile/social": "Social",
  "/mobile/world": "World",
  "/mobile/me": "Me",
  "/career": "Career",
  "/social": "Social",
  "/world": "World",
  "/me": "Me",
  "/character": "Me",
};

export const TopAppBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useGameData();
  const { unreadCount } = useNotificationsFeed();
  const displayName = profile?.display_name || profile?.username || "Player";
  const avatarUrl = (profile as any)?.avatar_url;
  const title = TITLES[location.pathname] ?? "RockMundo";

  return (
    <header
      className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border"
      style={{ paddingTop: "var(--m-safe-t)" }}
    >
      <div className="flex items-center gap-3 px-3" style={{ height: "var(--m-appbar-h)" }}>
        <button
          onClick={() => navigate("/mobile/me")}
          className="rm-tap flex items-center gap-2 min-w-0"
          aria-label="Open profile"
        >
          <Avatar className="h-9 w-9 ring-1 ring-border">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">RockMundo</div>
          <div className="font-bold text-[16px] leading-tight truncate">{title}</div>
        </div>
        <button
          onClick={() => navigate("/mobile/world")}
          className="rm-tap h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate("/inbox")}
          className="rm-tap relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted"
          aria-label="Inbox"
        >
          <Mail className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate("/mobile?tab=notifications")}
          className="rm-tap relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
