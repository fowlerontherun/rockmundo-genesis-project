import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Inbox as InboxIcon, LogOut, Menu } from "lucide-react";
import { CharacterSwitcher } from "@/components/character/CharacterSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth-context";
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
  if (pathname === "/mobile/education") return "Education";
  if (pathname.startsWith("/mobile/university/")) return "University";
  return "RockMundo Mobile";
};

export const TopAppBar = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useUnifiedInboxUnreadCount();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Could not sign out of mobile companion:", error);
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur" style={{ paddingTop: "var(--m-safe-t)" }}>
      <div className="flex min-w-0 items-center gap-1.5 px-2 sm:px-3" style={{ height: "var(--m-appbar-h)" }}>
        <CharacterSwitcher mobile />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] uppercase leading-none tracking-wider text-muted-foreground">RockMundo · Companion</div>
          <div className="truncate text-[16px] font-bold leading-tight">{titleFor(location.pathname, location.search, t)}</div>
        </div>
        <LanguageSwitcher />
        <Button variant="ghost" size="icon" onClick={() => navigate("/mobile/inbox")} className="rm-tap relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted" aria-label={`${t("nav.inbox")}${unreadCount ? `, ${unreadCount} ${t("playerControls.unread")}` : ""}`}>
          <InboxIcon className="h-5 w-5" />
          {unreadCount > 0 && <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" disabled={signingOut} aria-label="Account menu" className="rm-tap h-10 w-10 shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>RockMundo Mobile Companion</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={signingOut} onSelect={() => void handleLogout()} className="min-h-11 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />{signingOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
