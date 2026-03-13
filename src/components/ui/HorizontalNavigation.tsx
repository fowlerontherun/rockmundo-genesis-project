import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/rockmundo-new-logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useUserRole } from "@/hooks/useUserRole";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { ActivityStatusIndicator } from "@/components/ActivityStatusIndicator";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PrisonStatusIndicator } from "@/components/prison/PrisonStatusIndicator";
import { useUnreadInboxCount } from "@/hooks/useInbox";
import { RMRadioButton } from "@/components/radio/RMRadioPlayer";
import { VersionHeader } from "@/components/VersionHeader";
import { CharacterSwitcher } from "@/components/character/CharacterSwitcher";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Home, Users, Music, Settings, LogOut, Menu, Globe, Briefcase, User,
  Inbox, History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type HubLink = {
  icon: LucideIcon;
  labelKey: string;
  path: string;
};

const HorizontalNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: unreadInboxCount } = useUnreadInboxCount();
  const { isAdmin } = useUserRole();
  const [mobileOpen, setMobileOpen] = useState(false);

  const hubLinks: HubLink[] = [
    { icon: Home, labelKey: "nav.home", path: "/dashboard" },
    { icon: Music, labelKey: "nav.music", path: "/hub/music" },
    { icon: Users, labelKey: "nav.bandLive", path: "/hub/band-live" },
    { icon: Globe, labelKey: "nav.worldSocial", path: "/hub/world-social" },
    { icon: Briefcase, labelKey: "nav.careerBusiness", path: "/hub/career-business" },
    { icon: User, labelKey: "nav.character", path: "/hub/character" },
  ];

  const adminLink: HubLink = { icon: Settings, labelKey: "nav.admin", path: "/admin" };

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (!path || path === "/") return false;
    return location.pathname.startsWith(`${path}/`);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
    toast({ title: t('auth.logoutSuccess'), description: t('auth.loggedOutMessage') });
  };

  const allLinks = isAdmin() ? [...hubLinks, adminLink] : hubLinks;

  return (
    <>
      {/* Desktop horizontal nav */}
      <div className="hidden lg:block fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        {/* Top bar with logo and utilities */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border/50">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RockMundo" className="h-10 w-auto object-contain cursor-pointer" onClick={() => handleNavigation("/dashboard")} />
            <VersionHeader />
          </div>
          <div className="flex items-center gap-1">
            <CharacterSwitcher />
            <PrisonStatusIndicator />
            <ActivityStatusIndicator />
            <NotificationBell />
            <RMRadioButton />
            <ThemeSwitcher />
            <LanguageSwitcher />
            <HowToPlayDialog />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleLogout} title={t('nav.logout')}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Horizontal nav - headings only, no dropdowns */}
        <div className="flex items-center justify-center px-2 h-10 gap-1">
          {allLinks.map((link) => (
            <button
              key={link.path}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors whitespace-nowrap ${
                link.path === "/dashboard"
                  ? `text-yellow-400 ${isActive(link.path) ? "bg-primary/10" : "hover:bg-accent"}`
                  : isActive(link.path)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              onClick={() => handleNavigation(link.path)}
            >
              {t(link.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-3 py-2 h-12">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5 text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-sidebar overflow-y-auto">
              <div className="p-4 border-b border-sidebar-border/50 flex items-center justify-between">
                <img src={logo} alt="RockMundo" className="h-10 w-auto object-contain" />
                <div className="flex items-center gap-1">
                  <ThemeSwitcher />
                  <LanguageSwitcher />
                </div>
              </div>
              <nav className="p-3 space-y-1">
                {allLinks.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.path);
                  return (
                    <Button
                      key={link.path}
                      variant={active ? "secondary" : "ghost"}
                      className={`w-full justify-start gap-3 ${
                        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                      onClick={() => handleNavigation(link.path)}
                    >
                      <Icon className="h-4 w-4" />
                      {t(link.labelKey)}
                    </Button>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-sidebar-border">
                <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <img src={logo} alt="RockMundo" className="h-7 w-auto object-contain" />
          
          <div className="flex items-center gap-0.5">
            <CharacterSwitcher />
            <PrisonStatusIndicator />
            <ActivityStatusIndicator />
            <NotificationBell />
            <RMRadioButton />
          </div>
        </div>
      </div>

      {/* Mobile bottom nav shortcuts - keep as-is */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-sidebar-border shadow-lg safe-area-bottom">
        <div className="flex justify-around items-center py-1.5 px-1">
          {[
            { icon: Home, labelKey: "nav.home", path: "/dashboard" },
            { icon: Music, labelKey: "nav.music", path: "/hub/music" },
            { icon: Users, labelKey: "nav.band", path: "/hub/band-live" },
            { icon: Globe, labelKey: "nav.world", path: "/hub/world-social" },
          ].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                className={`flex flex-col gap-0.5 h-11 px-3 min-w-0 ${active ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                onClick={() => handleNavigation(item.path)}
              >
                <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''} transition-transform`} />
                <span className="text-[10px] font-oswald truncate">{t(item.labelKey)}</span>
              </Button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-0.5 h-11 px-3 min-w-0 text-muted-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-oswald">{t('nav.more')}</span>
          </Button>
        </div>
      </div>
    </>
  );
};

export default HorizontalNavigation;
