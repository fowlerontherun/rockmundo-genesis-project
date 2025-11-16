import { NavLink, useLocation } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { Twitter } from "lucide-react";
import logo from "@/assets/rockmundo-new-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import {
  Home,
  Bot,
  User,
  Guitar,
  Music,
  GraduationCap,
  Mic,
  Calendar,
  ListMusic,
  Award,
  Globe,
  Plane,
  Building2,
  Users,
  Megaphone,
  Share2,
  Briefcase,
  DollarSign,
  Store,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Disc,
  Wrench,
  HardHat,
  HeartHandshake,
  Target,
  TrendingUp,
  Map,
  Crown,
  Video,
  Radio as RadioIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { currentCity } = useGameData();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const collapsed = state === "collapsed";
  const cityOverviewPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (!path || path === "/") return false;
    return location.pathname.startsWith(`${path}/`);
  };

  const navSections = [
    {
      label: t('home'),
      items: [
        { icon: Home, label: t('dashboard'), path: "/dashboard" },
        { icon: Bot, label: t('advisor'), path: "/advisor" },
        { icon: User, label: t('character'), path: "/my-character" },
        { icon: Guitar, label: t('gear'), path: "/gear" },
        { icon: Crown, label: t('legacy'), path: "/legacy" },
        { icon: Calendar, label: t('schedule'), path: "/schedule" },
      ],
    },
    {
      label: "Music",
      items: [
        { icon: Music, label: "Songwriting", path: "/songwriting" },
        { icon: Disc, label: "Song Catalog", path: "/song-manager" },
        { icon: Disc, label: "Streaming", path: "/streaming-platforms" },
        { icon: Music, label: "Song Market", path: "/song-market" },
        { icon: Package, label: "Releases", path: "/release-manager" },
        { icon: Music, label: "Recording", path: "/recording-studio" },
        { icon: Video, label: "Music Videos", path: "/music-videos" },
        { icon: Music, label: "Radio", path: "/radio" },
      ],
    },
    {
      label: "Performance",
      items: [
        { icon: Mic, label: "Gigs", path: "/gig-booking" },
        { icon: Music, label: "Jam Sessions", path: "/jam-sessions" },
        { icon: Mic, label: "Busking", path: "/busking" },
        { icon: ListMusic, label: "Setlists", path: "/setlists" },
        { icon: Wrench, label: "Stage Equipment", path: "/stage-equipment" },
        { icon: HardHat, label: "Band Crew", path: "/band-crew" },
        { icon: Calendar, label: "Festivals", path: "/festivals" },
        { icon: Award, label: "Awards", path: "/awards" },
      ],
    },
    {
      label: "Education",
      items: [
        { icon: GraduationCap, label: "Education", path: "/education" },
        { icon: Target, label: "Skills", path: "/skills" },
      ],
    },
    {
      label: t('world'),
      items: [
        { icon: Globe, label: t('cities'), path: "/cities" },
        { icon: Plane, label: t('travel'), path: "/travel" },
        { icon: Building2, label: t('currentCity'), path: cityOverviewPath },
        { icon: TrendingUp, label: t('worldPulse'), path: "/world-pulse" },
        { icon: Map, label: t('tours'), path: "/tours" },
      ],
    },
    {
      label: t('social'),
      items: [
        { icon: Users, label: t('band'), path: "/band" },
        { icon: RadioIcon, label: "Band Chemistry", path: "/chemistry" },
        { icon: Twitter, label: "Twaater", path: "/twaater" },
        { icon: Video, label: "DikCok", path: "/dikcok" },
        { icon: Megaphone, label: t('pr'), path: "/pr" },
        { icon: HeartHandshake, label: t('relationships'), path: "/relationships" },
      ],
    },
    {
      label: t('business'),
      items: [
        { icon: Briefcase, label: t('employment'), path: "/employment" },
        { icon: DollarSign, label: t('finances'), path: "/finances" },
        { icon: Package, label: t('inventory'), path: "/inventory" },
        { icon: ShoppingCart, label: t('merch'), path: "/merchandise" },
        { icon: Disc, label: "Record Labels", path: "/labels" },
        { icon: Building2, label: t('venues'), path: "/venues" },
      ],
    },
    {
      label: t('admin'),
      items: [
        { icon: Settings, label: t('admin'), path: "/admin" },
        { icon: Wrench, label: t('stageEquipment'), path: "/admin/stage-equipment" },
        { icon: HardHat, label: "Crew Catalog", path: "/admin/crew" },
      ],
    },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
    toast({
      title: t('logout'),
      description: "You have been logged out.",
    });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-center p-2">
          <img 
            src={logo} 
            alt="RockMundo" 
            className={collapsed ? "h-8 w-auto" : "h-12 w-auto"}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={active} tooltip={collapsed ? item.label : undefined}>
                        <NavLink to={item.path}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>{t('logout')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
