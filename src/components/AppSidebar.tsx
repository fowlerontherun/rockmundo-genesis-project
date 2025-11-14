import { NavLink, useLocation } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
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
  BedDouble,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { currentCity } = useGameData();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const collapsed = state === "collapsed";
  const cityOverviewPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (!path || path === "/") return false;
    return location.pathname.startsWith(`${path}/`);
  };

  const navSections = [
    {
      label: "Home",
      items: [
        { icon: Home, label: "Dashboard", path: "/dashboard" },
        { icon: User, label: "Character", path: "/my-character" },
        { icon: Guitar, label: "Gear", path: "/gear" },
        { icon: Calendar, label: "Schedule", path: "/schedule" },
      ],
    },
    {
      label: "Music",
      items: [
        { icon: Music, label: "Music Hub", path: "/music" },
        { icon: GraduationCap, label: "Education", path: "/education" },
        { icon: Target, label: "Skills", path: "/skills" },
      ],
    },
    {
      label: "Performance",
      items: [
        { icon: Mic, label: "Perform", path: "/performance" },
        { icon: Calendar, label: "Gigs", path: "/gigs" },
        { icon: ListMusic, label: "Setlists", path: "/setlists" },
        { icon: Wrench, label: "Stage Equipment", path: "/stage-equipment" },
        { icon: HardHat, label: "Band Crew", path: "/band-crew" },
        { icon: Calendar, label: "Festivals", path: "/festivals" },
        { icon: Award, label: "Awards", path: "/awards" },
      ],
    },
    {
      label: "World",
      items: [
        { icon: Globe, label: "Cities", path: "/cities" },
        { icon: Plane, label: "Travel", path: "/travel" },
        { icon: Building2, label: "Current City", path: cityOverviewPath },
        { icon: TrendingUp, label: "World Pulse", path: "/world-pulse" },
        { icon: Map, label: "Tours", path: "/tours" },
      ],
    },
    {
      label: "Social",
      items: [
        { icon: Users, label: "Band", path: "/band" },
        { icon: Megaphone, label: "PR", path: "/pr" },
        { icon: Share2, label: "Social", path: "/social" },
        { icon: HeartHandshake, label: "Relationships", path: "/relationships" },
      ],
    },
    {
      label: "Lifestyle",
      items: [
        { icon: BedDouble, label: "Homes", path: "/lifestyle/homes" },
      ],
    },
    {
      label: "Business",
      items: [
        { icon: Briefcase, label: "Employment", path: "/employment" },
        { icon: DollarSign, label: "Finances", path: "/finances" },
        { icon: Store, label: "Gear Shop", path: "/gear-shop" },
        { icon: Package, label: "Inventory", path: "/inventory" },
        { icon: ShoppingCart, label: "Merch", path: "/merchandise" },
        { icon: Disc, label: "Record Labels", path: "/labels" },
        { icon: Building2, label: "Venues", path: "/venues" },
      ],
    },
    {
      label: "Admin",
      items: [
        { icon: Settings, label: "Admin", path: "/admin" },
        { icon: Wrench, label: "Stage Equipment", path: "/admin/stage-equipment" },
        { icon: HardHat, label: "Crew Catalog", path: "/admin/crew" },
      ],
    },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
    toast({
      title: "Signed out",
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
            <div className="flex items-center gap-2 p-2">
              <ThemeSwitcher />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex-1 justify-start gap-2"
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>Logout</span>}
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
