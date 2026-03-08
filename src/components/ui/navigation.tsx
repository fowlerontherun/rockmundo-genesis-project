import { useState } from "react";
import { CharacterSwitcher } from "@/components/character/CharacterSwitcher";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/rockmundo-new-logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useUserRole } from "@/hooks/useUserRole";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { ActivityStatusIndicator } from "@/components/ActivityStatusIndicator";
import { VersionHeader } from "@/components/VersionHeader";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PrisonStatusIndicator } from "@/components/prison/PrisonStatusIndicator";
import { useUnreadInboxCount } from "@/hooks/useInbox";
import { RMRadioPlayer } from "@/components/radio/RMRadioPlayer";
import {
  Home, Users, Music, Settings, LogOut, Menu, Globe, Briefcase, User,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type HubLink = {
  icon: LucideIcon;
  labelKey: string;
  path: string;
};

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [radioOpen, setRadioOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { data: unreadInboxCount } = useUnreadInboxCount();

  const hubLinks: HubLink[] = [
    { icon: Home, labelKey: "nav.home", path: "/dashboard" },
    { icon: Music, labelKey: "nav.music", path: "/hub/music" },
    { icon: Users, labelKey: "nav.bandLive", path: "/hub/band-live" },
    { icon: Globe, labelKey: "nav.worldSocial", path: "/hub/world-social" },
    { icon: Briefcase, labelKey: "nav.careerBusiness", path: "/hub/career-business" },
    { icon: User, labelKey: "nav.character", path: "/hub/character" },
  ];

  const adminLink: HubLink = { icon: Settings, labelKey: "nav.admin", path: "/admin" };

  const mobileShortcuts = [
    { icon: Home, labelKey: "nav.home", path: "/dashboard" },
    { icon: Music, labelKey: "nav.music", path: "/hub/music" },
    { icon: Users, labelKey: "nav.band", path: "/hub/band-live" },
    { icon: Globe, labelKey: "nav.world", path: "/hub/world-social" },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
    toast({
      title: t('auth.logoutSuccess'),
      description: t('auth.loggedOutMessage'),
    });
    setIsOpen(false);
  };

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (!path || path === "/") return false;
    return location.pathname.startsWith(`${path}/`);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const allLinks = isAdmin() ? [...hubLinks, adminLink] : hubLinks;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border/50 flex items-center justify-between">
        <img src={logo} alt="RockMundo" className="h-10 w-auto object-contain" />
        <div className="flex items-center gap-1">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>

      {/* Hub links - headings only */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {allLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.path);
          return (
            <Button
              key={link.path}
              variant={active ? "secondary" : "ghost"}
              className={`w-full justify-start gap-3 ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              onClick={() => handleNavigation(link.path)}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {t(link.labelKey)}
            </Button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border/50 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => { navigate('/version-history'); setIsOpen(false); }}
        >
          <History className="h-4 w-4 mr-1" />
          v1.1.002
        </Button>
        <HowToPlayDialog />
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-3 py-2 h-12">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('nav.openMenu')}>
                <Menu className="h-5 w-5 text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-sidebar">
              <div className="flex flex-col h-full">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>

          <img src={logo} alt="RockMundo" className="h-7 w-auto object-contain" />
          
          <div className="flex items-center gap-0.5">
            <CharacterSwitcher />
            <PrisonStatusIndicator />
            <ActivityStatusIndicator />
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Desktop Header Bar */}
      <div className="hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-2 h-14 w-full">
          <div className="flex items-center gap-3">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('nav.openMenu')}>
                  <Menu className="h-5 w-5 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 bg-sidebar">
                <div className="flex flex-col h-full">
                  <SidebarContent />
                </div>
              </SheetContent>
            </Sheet>
            <img src={logo} alt="RockMundo" className="h-8 w-auto object-contain" />
          </div>
          
          <div className="flex items-center gap-1">
            <PrisonStatusIndicator />
            <ActivityStatusIndicator />
            <NotificationBell />
            <ThemeSwitcher />
            <LanguageSwitcher />
            <HowToPlayDialog />
          </div>
        </div>
      </div>

      {/* Desktop Bottom Navigation */}
      <div className="hidden lg:flex fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-sidebar-border shadow-lg">
        <div className="flex justify-around items-center py-2 px-4 w-full max-w-4xl mx-auto">
          {mobileShortcuts.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                className={`flex flex-col gap-1 h-14 px-6 ${
                  active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => handleNavigation(item.path)}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''} transition-transform`} />
                <span className="text-xs font-medium">{t(item.labelKey)}</span>
              </Button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-14 px-6 text-muted-foreground hover:text-foreground"
            onClick={() => setIsOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs font-medium">{t('nav.more')}</span>
          </Button>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-sidebar-border shadow-lg safe-area-bottom">
        <div className="flex justify-around items-center py-1.5 px-1">
          {mobileShortcuts.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                className={`flex flex-col gap-0.5 h-11 px-3 min-w-0 ${
                  active ? "text-primary bg-primary/10" : "text-muted-foreground"
                }`}
                onClick={() => handleNavigation(item.path)}
                aria-current={active ? "page" : undefined}
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
            onClick={() => setIsOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-oswald">{t('nav.more')}</span>
          </Button>
        </div>
      </div>
      <RMRadioPlayer open={radioOpen} onOpenChange={setRadioOpen} />
    </>
  );
};

export default Navigation;
