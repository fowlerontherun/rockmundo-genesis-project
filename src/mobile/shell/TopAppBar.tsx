import { useNavigate, useLocation } from "react-router-dom";
import { Inbox as InboxIcon, MessageSquare, Sparkles } from "lucide-react";
import { CharacterSwitcher } from "@/components/character/CharacterSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnifiedInboxUnreadCount } from "@/hooks/useUnifiedInbox";

const titleFor = (pathname: string, search: string, t: (key: string) => string) => {
  if (pathname === "/mobile") {
    const view = new URLSearchParams(search).get("view");
    if (view === "book") return t("playerControls.bookActivity");
    return t("nav.schedule");
  }
  if (pathname === "/mobile/inbox") return t("nav.inbox");
  if (pathname === "/mobile/chat") return t("playerControls.gameChat");
  if (pathname === "/mobile/progression") return t("playerControls.progression");
  return "RockMundo Mobile";
};

export const TopAppBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useUnifiedInboxUnreadCount();
  return <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border" style={{ paddingTop: "var(--m-safe-t)" }}>
    <div className="flex items-center gap-1.5 px-3" style={{ height: "var(--m-appbar-h)" }}>
      <CharacterSwitcher mobile />
      <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">RockMundo</div><div className="font-bold text-[16px] leading-tight truncate">{titleFor(location.pathname, location.search, t)}</div></div>
      <LanguageSwitcher />
      <Button variant="ghost" size="icon" onClick={() => navigate("/mobile/progression")} className="rm-tap h-9 w-9 shrink-0 flex items-center justify-center rounded-full hover:bg-muted" aria-label={t("playerControls.spendPoints")}><Sparkles className="h-5 w-5" /></Button>
      <Button variant="ghost" size="icon" onClick={() => navigate("/mobile/chat")} className="rm-tap h-9 w-9 shrink-0 flex items-center justify-center rounded-full hover:bg-muted" aria-label={t("playerControls.gameChat")}><MessageSquare className="h-5 w-5" /></Button>
      <Button variant="ghost" size="icon" onClick={() => navigate("/mobile/inbox")} className="rm-tap relative h-9 w-9 shrink-0 flex items-center justify-center rounded-full hover:bg-muted" aria-label={`${t("nav.inbox")}${unreadCount ? `, ${unreadCount} ${t("playerControls.unread")}` : ""}`}>
        <InboxIcon className="h-5 w-5" />{unreadCount > 0 && <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </Button>
    </div>
  </header>;
};
