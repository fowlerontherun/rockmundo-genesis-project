import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/rockmundo-new-logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { ActivityStatusIndicator } from "@/components/ActivityStatusIndicator";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PrisonStatusIndicator } from "@/components/prison/PrisonStatusIndicator";
import { useUnreadInboxCount } from "@/hooks/useInbox";
import { RMRadioButton } from "@/components/radio/RMRadioPlayer";
import { VersionHeader } from "@/components/VersionHeader";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Home, Users, Calendar, Music, Music4, TrendingUp, Settings, LogOut,
  ShoppingCart, Trophy, MapPin, User, Building2, Share2, Heart, HeartPulse,
  Play, Menu, Globe, Mic, GraduationCap, DollarSign, Plane, ListMusic,
  Megaphone, Store, Guitar, Award, Briefcase, Newspaper, Radio, History,
  Video, Disc, Target, Sparkles, Twitter, UserPlus, HandHeart, Handshake,
  Building, Star, BookOpen, Wrench, Bus, Tv, Film, Inbox,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  search?: string;
  badge?: number;
};

type NavSection = {
  titleKey: string;
  items: NavItem[];
};

const HorizontalNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { currentCity } = useGameData();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: unreadInboxCount } = useUnreadInboxCount();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cityOverviewPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  const navSections: NavSection[] = [
    {
      titleKey: "nav.home",
      items: [
        { icon: Home, labelKey: "nav.dashboard", path: "/dashboard" },
        { icon: Inbox, labelKey: "nav.inbox", path: "/inbox", badge: unreadInboxCount || undefined },
        { icon: Calendar, labelKey: "nav.schedule", path: "/schedule" },
        { icon: Newspaper, labelKey: "nav.todaysNews", path: "/todays-news" },
        { icon: BookOpen, labelKey: "nav.journal", path: "/journal" },
      ],
    },
    {
      titleKey: "nav.character",
      items: [
        { icon: User, labelKey: "nav.avatar", path: "/avatar-designer" },
        { icon: ShoppingCart, labelKey: "nav.skinStore", path: "/skin-store" },
        { icon: Guitar, labelKey: "nav.gear", path: "/gear" },
        { icon: HeartPulse, labelKey: "nav.wellness", path: "/wellness" },
        { icon: History, labelKey: "nav.statistics", path: "/statistics" },
        { icon: BookOpen, labelKey: "nav.legacy", path: "/legacy" },
      ],
    },
    {
      titleKey: "nav.music",
      items: [
        { icon: Music, labelKey: "nav.songwriting", path: "/songwriting" },
        { icon: GraduationCap, labelKey: "nav.education", path: "/education" },
        { icon: Disc, labelKey: "nav.recording", path: "/recording-studio" },
        { icon: Music4, labelKey: "nav.releaseManager", path: "/release-manager" },
        { icon: Radio, labelKey: "nav.streaming", path: "/streaming-platforms" },
        { icon: Video, labelKey: "nav.musicVideos", path: "/music-videos" },
        { icon: TrendingUp, labelKey: "nav.countryCharts", path: "/country-charts" },
        { icon: Store, labelKey: "nav.songMarket", path: "/song-market" },
        { icon: Trophy, labelKey: "nav.songRankings", path: "/song-rankings" },
      ],
    },
    {
      titleKey: "nav.band",
      items: [
        { icon: Users, labelKey: "nav.bandManager", path: "/band" },
        { icon: Sparkles, labelKey: "nav.bandChemistry", path: "/chemistry" },
        { icon: Globe, labelKey: "nav.bandFinder", path: "/bands/finder" },
        { icon: Trophy, labelKey: "nav.bandRankings", path: "/band-rankings" },
        { icon: UserPlus, labelKey: "nav.bandCrew", path: "/band-crew" },
        { icon: Bus, labelKey: "nav.bandVehicles", path: "/band-vehicles" },
        { icon: Target, labelKey: "nav.bandRiders", path: "/band-riders" },
      ],
    },
    {
      titleKey: "nav.live",
      items: [
        { icon: Calendar, labelKey: "nav.gigs", path: "/gigs" },
        { icon: Mic, labelKey: "nav.openMic", path: "/open-mic" },
        { icon: Music, labelKey: "nav.jamSessions", path: "/jam-sessions" },
        { icon: Music, labelKey: "nav.busking", path: "/busking" },
        { icon: Music, labelKey: "nav.rehearsals", path: "/rehearsals" },
        { icon: ListMusic, labelKey: "nav.setlists", path: "/setlists" },
        { icon: Wrench, labelKey: "nav.stageEquipment", path: "/stage-equipment" },
      ],
    },
    {
      titleKey: "nav.events",
      items: [
        { icon: Calendar, labelKey: "nav.festivals", path: "/festivals" },
        { icon: Award, labelKey: "nav.awards", path: "/awards" },
        { icon: Star, labelKey: "nav.eurovision", path: "/events/eurovision" },
      ],
    },
    {
      titleKey: "nav.world",
      items: [
        { icon: Globe, labelKey: "nav.cities", path: "/cities" },
        { icon: Plane, labelKey: "nav.travel", path: "/travel" },
        { icon: Bus, labelKey: "nav.tours", path: "/tour-manager" },
        { icon: Building2, labelKey: "nav.currentCity", path: cityOverviewPath },
        { icon: Globe, labelKey: "nav.worldPulse", path: "/world-pulse" },
      ],
    },
    {
      titleKey: "nav.social",
      items: [
        { icon: Twitter, labelKey: "nav.twaater", path: "/twaater" },
        { icon: Video, labelKey: "nav.dikcok", path: "/dikcok" },
        { icon: Heart, labelKey: "nav.relationships", path: "/relationships" },
        { icon: HandHeart, labelKey: "nav.gettit", path: "/gettit" },
        { icon: UserPlus, labelKey: "nav.playerSearch", path: "/players/search" },
        { icon: Sparkles, labelKey: "nav.underworld", path: "/underworld" },
      ],
    },
    {
      titleKey: "nav.career",
      items: [
        { icon: Briefcase, labelKey: "nav.employment", path: "/employment" },
        { icon: DollarSign, labelKey: "nav.finances", path: "/finances" },
        { icon: Building2, labelKey: "nav.myCompanies", path: "/my-companies" },
        { icon: Handshake, labelKey: "nav.sponsorships", path: "/sponsorships" },
        { icon: Disc, labelKey: "nav.recordLabels", path: "/labels" },
        { icon: Sparkles, labelKey: "nav.modeling", path: "/modeling" },
        { icon: Megaphone, labelKey: "nav.pr", path: "/pr" },
        { icon: Handshake, labelKey: "nav.offers", path: "/offers-dashboard" },
        { icon: Building, labelKey: "nav.venues", path: "/venues" },
      ],
    },
    {
      titleKey: "nav.commerce",
      items: [
        { icon: Store, labelKey: "nav.inventory", path: "/inventory" },
        { icon: ShoppingCart, labelKey: "nav.merchandise", path: "/merchandise" },
      ],
    },
    {
      titleKey: "nav.media",
      items: [
        { icon: Radio, labelKey: "nav.radio", path: "/media/radio" },
        { icon: Tv, labelKey: "nav.tvShows", path: "/media/tv-shows" },
        { icon: Newspaper, labelKey: "nav.newspapers", path: "/media/newspapers" },
        { icon: BookOpen, labelKey: "nav.magazines", path: "/media/magazines" },
        { icon: Mic, labelKey: "nav.podcasts", path: "/media/podcasts" },
        { icon: Film, labelKey: "nav.films", path: "/media/films" },
        { icon: Globe, labelKey: "nav.websites", path: "/media/websites" },
      ],
    },
    {
      titleKey: "nav.admin",
      items: [
        { icon: Settings, labelKey: "nav.adminPanel", path: "/admin" },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (!path || path === "/") return false;
    return location.pathname.startsWith(`${path}/`);
  };

  const sectionHasActive = (section: NavSection) => {
    return section.items.some((item) => isActive(item.path));
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpenDropdown(null);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
    toast({ title: t('auth.logoutSuccess'), description: t('auth.loggedOutMessage') });
  };

  const handleMouseEnter = (key: string) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setOpenDropdown(key);
  };

  const handleMouseLeave = () => {
    dropdownTimeout.current = setTimeout(() => setOpenDropdown(null), 250);
  };

  const handleToggle = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-nav-dropdown]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <>
      {/* Desktop horizontal nav */}
      <div className="hidden lg:block fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        {/* Top bar with logo and utilities */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border/50">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RockMundo" className="h-7 w-auto object-contain cursor-pointer" onClick={() => handleNavigation("/dashboard")} />
            <VersionHeader />
          </div>
          <div className="flex items-center gap-1">
            <RMRadioButton />
            <PrisonStatusIndicator />
            <ActivityStatusIndicator />
            <NotificationBell />
            <ThemeSwitcher />
            <LanguageSwitcher />
            <HowToPlayDialog />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleLogout} title={t('nav.logout')}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Horizontal nav sections */}
        <div className="flex items-center px-2 h-10 relative z-[9999]">
          {navSections.map((section) => {
            const sectionKey = section.titleKey;
            const isOpen = openDropdown === sectionKey;
            const hasActive = sectionHasActive(section);

            return (
              <div
                key={sectionKey}
                className="relative"
                data-nav-dropdown
                onMouseEnter={() => handleMouseEnter(sectionKey)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors whitespace-nowrap ${
                    hasActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  onClick={(e) => handleToggle(sectionKey, e)}
                >
                  {t(section.titleKey)}
                </button>

                {/* Dropdown */}
                {isOpen && (
                  <div
                    className="absolute top-full left-0 mt-0.5 min-w-[200px] bg-popover border border-border rounded-md shadow-lg py-1 z-[9999]"
                    data-nav-dropdown
                    onMouseEnter={() => handleMouseEnter(sectionKey)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <button
                          key={item.path}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-accent text-accent-foreground"
                              : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                          }`}
                          onClick={() => handleNavigation(item.path)}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{t(item.labelKey)}</span>
                          {item.badge && item.badge > 0 && (
                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: use sheet-based nav (same as sidebar) */}
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
                {navSections.map((section) => (
                  <div key={section.titleKey} className="mb-3">
                    <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider px-3 py-1">
                      {t(section.titleKey)}
                    </h3>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <Button
                          key={item.path}
                          variant={active ? "secondary" : "ghost"}
                          className={`w-full justify-start gap-3 ${
                            active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
                          }`}
                          onClick={() => handleNavigation(item.path)}
                        >
                          <Icon className="h-4 w-4" />
                          {t(item.labelKey)}
                          {item.badge && item.badge > 0 && (
                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                ))}
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
            <RMRadioButton />
            <PrisonStatusIndicator />
            <ActivityStatusIndicator />
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Mobile bottom nav shortcuts */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-sidebar-border shadow-lg safe-area-bottom">
        <div className="flex justify-around items-center py-1.5 px-1">
          {[
            { icon: Home, labelKey: "nav.home", path: "/dashboard" },
            { icon: Music, labelKey: "nav.music", path: "/songwriting" },
            { icon: Users, labelKey: "nav.band", path: "/band" },
            { icon: Calendar, labelKey: "nav.schedule", path: "/gigs" },
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
