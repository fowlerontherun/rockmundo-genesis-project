import { useNavigate, useLocation } from "react-router-dom";
import { Inbox as InboxIcon, MessageSquare, Sparkles } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useGameData } from "@/hooks/useGameData";
import { useUnifiedInboxUnreadCount } from "@/hooks/useUnifiedInbox";

const titleFor = (pathname: string, search: string) => {
  if (pathname === "/mobile") {
    const view = new URLSearchParams(search).get("view");
    if (view === "book") return "Book Activity";
    return "Schedule";
  }
  if (pathname === "/mobile/inbox") return "Inbox";
  if (pathname === "/mobile/chat") return "Game Chat";
  if (pathname === "/mobile/progression") return "XP & AP";
  return "RockMundo Mobile";
};

export const TopAppBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useGameData();
  const unreadCount = useUnifiedInboxUnreadCount();
  const displayName = profile?.display_name || profile?.username || "Player";
  const avatarUrl = profile?.avatar_url ?? undefined;
  return <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border" style={{ paddingTop: "var(--m-safe-t)" }}>
    <div className="flex items-center gap-1.5 px-3" style={{ height: "var(--m-appbar-h)" }}>
      <button onClick={() => navigate("/mobile")} className="rm-tap flex items-center gap-2 min-w-0" aria-label="Open schedule">
        <Avatar className="h-9 w-9 ring-1 ring-border"><AvatarImage src={avatarUrl} alt={displayName} /><AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
      </button>
      <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">RockMundo</div><div className="font-bold text-[16px] leading-tight truncate">{titleFor(location.pathname, location.search)}</div></div>
      <button onClick={() => navigate("/mobile/progression")} className="rm-tap h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted" aria-label="Spend XP and AP"><Sparkles className="h-5 w-5" /></button>
      <button onClick={() => navigate("/mobile/chat")} className="rm-tap h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted" aria-label="Game chat"><MessageSquare className="h-5 w-5" /></button>
      <button onClick={() => navigate("/mobile/inbox")} className="rm-tap relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted" aria-label={`Inbox${unreadCount ? `, ${unreadCount} unread` : ""}`}>
        <InboxIcon className="h-5 w-5" />{unreadCount > 0 && <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
    </div>
  </header>;
};
