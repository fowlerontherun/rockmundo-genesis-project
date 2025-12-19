import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/rockmundo-new-logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { ActivityStatusIndicator } from "@/components/ActivityStatusIndicator";
import { VersionHeader } from "@/components/VersionHeader";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PrisonStatusIndicator } from "@/components/prison/PrisonStatusIndicator";
import {
  Home,
  Users,
  Calendar,
  Music,
  Music4,
  TrendingUp,
  Settings,
  LogOut,
  ShoppingCart,
  Trophy,
  MapPin,
  User,
  Building2,
  Share2,
  Heart,
  HeartPulse,
  Play,
  Menu,
  X,
  Globe,
  Mic,
  GraduationCap,
  DollarSign,
  Plane,
  ListMusic,
  Megaphone,
  Store,
  Guitar,
  Award,
  Briefcase,
  Newspaper,
  Radio,
  Video,
  Disc,
  Target,
  Sparkles,
  Twitter,
  UserPlus,
  HandHeart,
  Handshake,
  Building,
  Star,
  BookOpen,
  Wrench,
  Bus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  search?: string;
};

type NavSection = {
  titleKey: string;
  items: NavItem[];
};

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { currentCity } = useGameData();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Desktop sidebar collapsed state with localStorage persistence
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
    const saved = localStorage.getItem('desktop-sidebar-collapsed');
    return saved === 'true';
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    home: true,
    music: true,
    band: true,
    performance: true,
    world: true,
    social: true,
    business: true,
    media: true,
    admin: true,
  });

  // Persist desktop sidebar state
  useEffect(() => {
    localStorage.setItem('desktop-sidebar-collapsed', isDesktopCollapsed.toString());
  }, [isDesktopCollapsed]);

  const toggleDesktopSidebar = () => {
    setIsDesktopCollapsed(prev => !prev);
  };

  const cityOverviewPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  const navSections: NavSection[] = [
    {
      titleKey: "nav.home",
      items: [
        { icon: Home, labelKey: "nav.dashboard", path: "/dashboard" },
        { icon: User, labelKey: "nav.avatar", path: "/avatar-designer" },
        { icon: ShoppingCart, labelKey: "nav.skinStore", path: "/skin-store" },
        { icon: Newspaper, labelKey: "nav.todaysNews", path: "/todays-news" },
        { icon: Guitar, labelKey: "nav.gear", path: "/gear" },
        { icon: HeartPulse, labelKey: "nav.wellness", path: "/wellness" },
        { icon: BookOpen, labelKey: "nav.statistics", path: "/statistics" },
      ],
    },
    {
      titleKey: "nav.music",
      items: [
        { icon: Music, labelKey: "nav.songwriting", path: "/songwriting" },
        { icon: GraduationCap, labelKey: "nav.education", path: "/education" },
        { icon: Disc, labelKey: "nav.recording", path: "/recording-studio" },
        { icon: Music4, labelKey: "nav.releaseManager", path: "/release-manager" },
        { icon: Radio, labelKey: "nav.streaming", path: "/streaming" },
        { icon: Video, labelKey: "nav.musicVideos", path: "/music-videos" },
        { icon: TrendingUp, labelKey: "nav.countryCharts", path: "/country-charts" },
      ],
    },
    {
      titleKey: "nav.band",
      items: [
        { icon: Users, labelKey: "nav.bandManager", path: "/band" },
        { icon: Sparkles, labelKey: "nav.bandChemistry", path: "/chemistry" },
        { icon: UserPlus, labelKey: "nav.bandCrew", path: "/band-crew" },
      ],
    },
    {
      titleKey: "nav.performance",
      items: [
        { icon: Calendar, labelKey: "nav.gigs", path: "/gigs" },
        { icon: Mic, labelKey: "nav.openMic", path: "/open-mic" },
        { icon: Music, labelKey: "nav.jamSessions", path: "/jam-sessions" },
        { icon: Music, labelKey: "nav.busking", path: "/busking" },
        { icon: Music, labelKey: "nav.rehearsals", path: "/rehearsals" },
        { icon: ListMusic, labelKey: "nav.setlists", path: "/setlists" },
        { icon: Calendar, labelKey: "nav.festivals", path: "/festivals" },
        { icon: Star, labelKey: "nav.eurovision", path: "/events/eurovision" },
        { icon: Wrench, labelKey: "nav.stageEquipment", path: "/stage-equipment" },
      ],
    },
    {
      titleKey: "nav.world",
      items: [
        { icon: Globe, labelKey: "nav.cities", path: "/cities" },
        { icon: Plane, labelKey: "nav.travel", path: "/travel" },
        { icon: Bus, labelKey: "nav.tours", path: "/tour-manager" },
        { icon: Building2, labelKey: "nav.currentCity", path: cityOverviewPath },
      ],
    },
    {
      titleKey: "nav.social",
      items: [
        { icon: Twitter, labelKey: "nav.twaater", path: "/twaater" },
        { icon: Video, labelKey: "nav.dikcok", path: "/dikcok" },
        { icon: Heart, labelKey: "nav.relationships", path: "/relationships" },
        { icon: HandHeart, labelKey: "nav.communityFeed", path: "/community/feed" },
      ],
    },
    {
      titleKey: "nav.business",
      items: [
        { icon: Briefcase, labelKey: "nav.employment", path: "/employment" },
        { icon: DollarSign, labelKey: "nav.finances", path: "/finances" },
        { icon: Megaphone, labelKey: "nav.pr", path: "/pr" },
        { icon: Store, labelKey: "nav.inventory", path: "/inventory" },
        { icon: ShoppingCart, labelKey: "nav.merchandise", path: "/merchandise" },
        { icon: Building2, labelKey: "nav.venues", path: "/venues" },
        { icon: Handshake, labelKey: "nav.sponsorships", path: "/sponsorships" },
        { icon: Building, labelKey: "nav.recordLabels", path: "/labels" },
      ],
    },
    {
      titleKey: "nav.media",
      items: [
        { icon: Radio, labelKey: "nav.radio", path: "/radio" },
        { icon: Radio, labelKey: "nav.radioStations", path: "/radio-stations" },
        { icon: Tv, labelKey: "nav.tvShows", path: "/media/tv-shows" },
        { icon: Newspaper, labelKey: "nav.newspapers", path: "/media/newspapers" },
        { icon: BookOpen, labelKey: "nav.magazines", path: "/media/magazines" },
        { icon: Mic, labelKey: "nav.podcasts", path: "/media/podcasts" },
        { icon: Film, labelKey: "nav.films", path: "/media/films" },
      ],
    },
    {
      titleKey: "nav.admin",
      items: [
        { icon: Settings, labelKey: "nav.adminPanel", path: "/admin" },
      ],
    },
  ];

  const mobileShortcuts = [
    { icon: Home, labelKey: "nav.home", path: "/dashboard" },
    { icon: Calendar, labelKey: "nav.gigs", path: "/gigs" },
    { icon: Music, labelKey: "nav.music", path: "/music-hub" },
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

  const isActive = (itemOrPath: NavItem | string) => {
    const path = typeof itemOrPath === "string" ? itemOrPath : itemOrPath.path;
    const search = typeof itemOrPath === "string" ? undefined : itemOrPath.search;

    if (location.pathname === path) {
      if (!search) {
        return true;
      }
      return location.search === search;
    }

    if (!path || path === "/") {
      return false;
    }

    return location.pathname.startsWith(`${path}/`);
  };

  const handleNavigation = (path: string, search?: string) => {
    if (search) {
      navigate({ pathname: path, search });
    } else {
      navigate(path);
    }
    setIsOpen(false);
  };

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Helper to get section key from titleKey
  const getSectionKey = (titleKey: string) => {
    return titleKey.replace('nav.', '');
  };

  interface NavigationContentProps {
    isMobile?: boolean;
    collapsed?: boolean;
  }

  const NavigationContent = ({ isMobile = false, collapsed = false }: NavigationContentProps) => (
    <>
      {/* Logo */}
      {!collapsed && (
        <div className={`${isMobile ? 'p-6' : 'p-6'} border-b border-sidebar-border/50`}>
          <div className="flex items-center justify-center">
            <img 
              src={logo} 
              alt="RockMundo - Live The Dream" 
              className="h-16 w-auto object-contain"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-2 overflow-y-auto`}>
        {navSections.map((section) => {
          const sectionKey = getSectionKey(section.titleKey);
          return (
            <Collapsible
              key={section.titleKey}
              open={collapsed ? false : openSections[sectionKey]}
              onOpenChange={() => !collapsed && toggleSection(sectionKey)}
            >
              {!collapsed && (
                <CollapsibleTrigger className="w-full group">
                  <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors">
                    <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">
                      {t(section.titleKey)}
                    </h3>
                    {openSections[sectionKey] ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform" />
                    )}
                  </div>
                </CollapsibleTrigger>
              )}
              <CollapsibleContent className={`${collapsed ? '' : 'space-y-1 pt-1'}`}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const label = t(item.labelKey);
                  return (
                    <Button
                      key={`${item.path}-${item.labelKey}`}
                      variant={isActive(item) ? "secondary" : "ghost"}
                      className={`${collapsed ? 'w-full justify-center p-2' : 'w-full justify-start gap-3'} ${
                        isActive(item)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                      onClick={() => handleNavigation(item.path, item.search)}
                      aria-current={isActive(item) ? "page" : undefined}
                      title={collapsed ? label : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      {!collapsed && label}
                    </Button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-sidebar-border`}>
        <Button
          variant="ghost"
          className={`w-full ${collapsed ? 'justify-center p-2' : 'justify-start gap-3'} text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive`}
          onClick={handleLogout}
          title={collapsed ? t('nav.logout') : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && t('nav.logout')}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <VersionHeader />
        <div className="flex items-center justify-between px-4 py-3">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 border-primary/50 hover:bg-primary/10"
                aria-label={t('nav.openMenu')}
              >
                <Menu className="h-6 w-6 text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-sidebar">
              <div className="flex flex-col h-full">
                <NavigationContent isMobile={true} />
              </div>
            </SheetContent>
          </Sheet>

          <img 
            src={logo} 
            alt="RockMundo" 
            className="h-8 w-auto object-contain"
          />
          
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

      {/* Desktop Sidebar with Hamburger Toggle */}
      <div className={`hidden lg:flex ${isDesktopCollapsed ? 'w-14' : 'w-64'} h-screen bg-sidebar border-r border-sidebar-border flex-col fixed left-0 top-0 transition-all duration-300`}>
        {!isDesktopCollapsed && <VersionHeader />}
        <div className={`${isDesktopCollapsed ? 'p-2' : 'p-4'} border-b border-sidebar-border/50 flex ${isDesktopCollapsed ? 'justify-center' : 'items-center justify-between'}`}>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-primary/50 hover:bg-primary/10"
            onClick={toggleDesktopSidebar}
            aria-label={t('nav.toggleMenu')}
          >
            <Menu className="h-5 w-5 text-primary" />
          </Button>
          {!isDesktopCollapsed && (
            <div className="flex items-center gap-1">
              <PrisonStatusIndicator />
              <NotificationBell />
              <ThemeSwitcher />
              <LanguageSwitcher />
              <HowToPlayDialog />
            </div>
          )}
        </div>
        <NavigationContent collapsed={isDesktopCollapsed} />
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-sidebar-border shadow-lg">
        <div className="flex justify-around items-center py-2">
          {mobileShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                className={`flex flex-col gap-1 h-12 px-2 ${
                  isActive(item.path)
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
                onClick={() => handleNavigation(item.path)}
                aria-current={isActive(item.path) ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-oswald">{t(item.labelKey)}</span>
              </Button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col gap-1 h-12 px-2 text-muted-foreground"
            onClick={() => setIsOpen(true)}
          >
            <Menu className="h-4 w-4" />
            <span className="text-xs font-oswald">{t('nav.more')}</span>
          </Button>
        </div>
      </div>
    </>
  );
};

export default Navigation;
