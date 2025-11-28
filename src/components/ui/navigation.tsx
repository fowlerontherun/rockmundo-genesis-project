import { useState } from "react";
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
  label: string;
  path: string;
  search?: string;
};

type NavSection = {
  title: string;
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Home: true,
    Music: true,
    Performance: true,
    World: true,
    Social: true,
    Community: true,
    Business: true,
    Admin: true,
  });

  const cityOverviewPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  const navSections: NavSection[] = [
    {
      title: "Home",
      items: [
        { icon: Home, label: "Dashboard", path: "/dashboard" },
        { icon: Newspaper, label: "Today's News", path: "/todays-news" },
        { icon: Guitar, label: "Gear", path: "/gear" },
        { icon: HeartPulse, label: "Wellness", path: "/wellness" },
        { icon: BookOpen, label: "Statistics", path: "/statistics" },
      ],
    },
    {
      title: "Music",
      items: [
        { icon: Music, label: "Songwriting", path: "/songwriting" },
        { icon: GraduationCap, label: "Education", path: "/education" },
        { icon: Disc, label: "Recording", path: "/recording-studio" },
        { icon: Music4, label: "Release Manager", path: "/release-manager" },
        { icon: Radio, label: "Streaming", path: "/streaming" },
        { icon: Video, label: "Music Videos", path: "/music-videos" },
        { icon: Radio, label: "Radio", path: "/radio" },
      ],
    },
    {
      title: "Performance",
      items: [
        { icon: Calendar, label: "Gigs", path: "/gigs" },
        { icon: Music, label: "Jam Sessions", path: "/jam-sessions" },
        { icon: Music, label: "Busking", path: "/busking" },
        { icon: Music, label: "Rehearsals", path: "/rehearsals" },
        { icon: ListMusic, label: "Setlists", path: "/setlists" },
        { icon: Calendar, label: "Festivals", path: "/festivals" },
        { icon: Star, label: "Eurovision", path: "/events/eurovision" },
        { icon: Wrench, label: "Stage Equipment", path: "/stage-equipment" },
      ],
    },
    {
      title: "World",
      items: [
        { icon: Globe, label: "Cities", path: "/cities" },
        { icon: Plane, label: "Travel", path: "/travel" },
        { icon: Bus, label: "Tours", path: "/tour-manager" },
        { icon: Building2, label: "Current City", path: cityOverviewPath },
      ],
    },
    {
      title: "Social",
      items: [
        { icon: Users, label: "Band", path: "/band" },
        { icon: Sparkles, label: "Band Chemistry", path: "/chemistry" },
        { icon: UserPlus, label: "Band Crew", path: "/band-crew" },
        { icon: Twitter, label: "Twaater", path: "/twaater" },
        { icon: Video, label: "DikCok", path: "/dikcok" },
        { icon: Heart, label: "Relationships", path: "/relationships" },
      ],
    },
    {
      title: "Community",
      items: [
        { icon: HandHeart, label: "Community Feed", path: "/community/feed" },
      ],
    },
    {
      title: "Business",
      items: [
        { icon: Briefcase, label: "Employment", path: "/employment" },
        { icon: DollarSign, label: "Finances", path: "/finances" },
        { icon: Store, label: "Inventory", path: "/inventory" },
        { icon: ShoppingCart, label: "Merchandise", path: "/merchandise" },
        { icon: Building2, label: "Venues", path: "/venues" },
        { icon: Handshake, label: "Sponsorships", path: "/sponsorships" },
        { icon: Building, label: "Record Labels", path: "/labels" },
      ],
    },
    {
      title: "Admin",
      items: [
        { icon: Settings, label: "Admin Panel", path: "/admin" },
      ],
    },
  ];

  const mobileShortcuts = [
    { icon: Home, label: t('home'), path: "/dashboard" },
    { icon: Calendar, label: t('gigs'), path: "/gigs" },
    { icon: Music, label: t('music'), path: "/music" },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
    toast({
      title: "Signed out",
      description: "You have been logged out of Rockmundo.",
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

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  interface NavigationContentProps {
    isMobile?: boolean;
  }

  const NavigationContent = ({ isMobile = false }: NavigationContentProps) => (
    <>
      {/* Logo */}
      <div className={`${isMobile ? 'p-6' : 'p-6'} border-b border-sidebar-border/50`}>
        <div className="flex items-center justify-center">
          <img 
            src={logo} 
            alt="RockMundo - Live The Dream" 
            className="h-16 w-auto object-contain"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navSections.map((section) => (
          <Collapsible
            key={section.title}
            open={openSections[section.title]}
            onOpenChange={() => toggleSection(section.title)}
          >
            <CollapsibleTrigger className="w-full group">
              <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors">
                <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
                {openSections[section.title] ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={`${item.path}-${item.label}`}
                    variant={isActive(item) ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-3 ${
                      isActive(item)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                    onClick={() => handleNavigation(item.path, item.search)}
                    aria-current={isActive(item) ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-background/95 to-background/90 backdrop-blur-md border-b border-primary/20">
        <div className="flex items-center justify-between p-4">
          <img 
            src={logo} 
            alt="RockMundo" 
            className="h-8 w-auto object-contain"
          />
          
          <div className="flex items-center gap-2">
            <ActivityStatusIndicator />
            <ThemeSwitcher />
            <LanguageSwitcher />
            <HowToPlayDialog />
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 bg-sidebar">
                <div className="flex flex-col h-full">
                  <NavigationContent isMobile={true} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 h-screen bg-sidebar border-r border-sidebar-border flex-col fixed left-0 top-0">
        <NavigationContent />
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
                <span className="text-xs font-oswald">{item.label}</span>
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
            <span className="text-xs font-oswald">{t('more')}</span>
          </Button>
        </div>
      </div>
    </>
  );
};

export default Navigation;