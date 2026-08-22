import { useNavigate, useLocation } from "react-router-dom";
import { Bell, MessageSquare, Search } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useGameData } from "@/hooks/useGameData";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";

const DETAIL_TITLES: Record<string, string> = {
  "/mobile/career/band": "Band",
  "/mobile/career/songs": "Songs",
  "/mobile/career/songwriting": "Songwriting",
  "/mobile/career/recording": "Recording",
  "/mobile/career/rehearsals": "Rehearsals",
  "/mobile/career/setlists": "Setlists",
  "/mobile/career/gigs": "Gigs",
  "/mobile/career/tours": "Tours",
  "/mobile/career/releases": "Releases",
  "/mobile/career/streaming": "Streaming",
  "/mobile/career/charts": "Charts",
  "/mobile/career/awards": "Awards",
  "/mobile/social/chat": "Live chat",
  "/mobile/social/messages": "Messages",
  "/mobile/social/friends": "Friends",
  "/mobile/social/requests": "Friend requests",
  "/mobile/social/twaater": "Twaater",
  "/mobile/social/notifications": "Notifications",
  "/mobile/world/travel": "Travel",
  "/mobile/world/venues": "Venues",
  "/mobile/world/companies": "Companies",
  "/mobile/world/jobs": "Jobs",
  "/mobile/world/marketplace": "Marketplace",
  "/mobile/world/shops": "Shops",
  "/mobile/world/charts": "Charts",
  "/mobile/world/festivals": "Festivals",
  "/mobile/world/events": "Events",
  "/mobile/world/city": "City",
  "/mobile/me/wellness": "Wellness",
  "/mobile/me/inventory": "Inventory",
  "/mobile/me/wardrobe": "Wardrobe",
  "/mobile/me/skills": "Skills",
  "/mobile/me/education": "Education",
  "/mobile/me/achievements": "Achievements",
  "/mobile/me/settings": "Settings",
};

const titleFor = (pathname: string, search: string) => {
  if (pathname === "/mobile") return new URLSearchParams(search).get("view") === "day" ? "My Day" : "Today";
  if (DETAIL_TITLES[pathname]) return DETAIL_TITLES[pathname];
  if (pathname.startsWith("/mobile/career")) return "Career";
  if (pathname.startsWith("/mobile/social")) return "Social";
  if (pathname.startsWith("/mobile/world")) return "World";
  if (pathname.startsWith("/mobile/me")) return "Me";
  return "RockMundo";
};

export const TopAppBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useGameData();
  const { unreadCount } = useNotificationsFeed();
  const displayName = profile?.display_name || profile?.username || "Player";
  const avatarUrl = (profile as any)?.avatar_url;
  const title = titleFor(location.pathname, location.search);

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
          onClick={() => navigate("/mobile/world/travel")}
          className="rm-tap h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted"
          aria-label="Search cities"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate("/mobile/social/messages")}
          className="rm-tap relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted"
          aria-label="Messages"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate("/mobile/social/notifications")}
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
