import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/rockmundo-new-logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/components/ui/use-toast";
import {
  Home,
  Users,
  Calendar,
  Music,
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
  PenSquare,
  DollarSign,
  Plane,
  ListMusic,
  Megaphone,
  Store,
  Guitar,
  Handshake,
} from "lucide-react";

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { currentCity } = useGameData();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const cityOverviewPath = currentCity?.id ? `/cities/${currentCity.id}` : "/cities";

  const navSections = [
    {
      title: "Overview & Wellness",
      items: [
        { icon: Home, label: "Dashboard", path: "/dashboard" },
        { icon: User, label: "My Character", path: "/my-character" },
        { icon: Calendar, label: "Schedule", path: "/schedule" },
        { icon: Trophy, label: "Achievements", path: "/achievements" },
        { icon: HeartPulse, label: "Health", path: "/health" },
      ],
    },
    {
      title: "Creative Studio",
      items: [
        { icon: Music, label: "Music Studio", path: "/music" },
        { icon: Play, label: "Music Creation", path: "/create" },
        { icon: PenSquare, label: "Songwriting", path: "/songwriting" },
        { icon: ListMusic, label: "Song Manager", path: "/songs" },
        { icon: GraduationCap, label: "Education", path: "/education" },
      ],
    },
    {
      title: "Live Performance & Touring",
      items: [
        { icon: Calendar, label: "Gig Booking", path: "/gigs" },
        { icon: MapPin, label: "Tour Manager", path: "/tours" },
        { icon: ListMusic, label: "Setlist Designer", path: "/setlists" },
        { icon: Calendar, label: "Festivals", path: "/festivals" },
        { icon: Building2, label: "Venue Management", path: "/venues" },
        { icon: Settings, label: "Stage Setup", path: "/stage-setup" },
        { icon: MapPin, label: "City Overview", path: cityOverviewPath },
        { icon: Globe, label: "World Map", path: "/world-map" },
        { icon: Mic, label: "Street Busking", path: "/busking" },
        { icon: Plane, label: "Travel Planner", path: "/travel" },
        { icon: Globe, label: "Tour System", path: "/tours-system" },
      ],
    },
    {
      title: "Community & Audience",
      items: [
        { icon: Handshake, label: "Friends Hub", path: "/friends" },
        { icon: Users, label: "Band Manager", path: "/band" },
        { icon: Heart, label: "Band Chemistry", path: "/chemistry" },
        { icon: Share2, label: "Social Media", path: "/social" },
        { icon: Megaphone, label: "Public Relations", path: "/pr" },
        { icon: Users, label: "Fan Management", path: "/fans" },
        { icon: TrendingUp, label: "World Pulse", path: "/charts" },
        { icon: Trophy, label: "Competitive Charts", path: "/charts-competitive" },
        { icon: Users, label: "Enhanced Band", path: "/band-enhanced" },
        { icon: HeartPulse, label: "Enhanced Fans", path: "/fans-enhanced" },
      ],
    },
    {
      title: "Business & Operations",
      items: [
        { icon: Guitar, label: "My Gear", path: "/gear" },
        { icon: ShoppingCart, label: "Equipment Store", path: "/equipment" },
        { icon: Store, label: "Inventory", path: "/inventory" },
        { icon: DollarSign, label: "Finances", path: "/finances" },
        { icon: ShoppingCart, label: "Merchandise", path: "/merchandise" },
        { icon: DollarSign, label: "Underworld", path: "/underworld" },
        { icon: Building2, label: "Record Label", path: "/labels" },
        { icon: Play, label: "Streaming", path: "/streaming" },
        { icon: Store, label: "Enhanced Store", path: "/equipment-enhanced" },
        { icon: Globe, label: "World Events", path: "/world" },
        { icon: TrendingUp, label: "Statistics", path: "/statistics" },
        { icon: Settings, label: "Admin Panel", path: "/admin" },
      ],
    },
  ];

  const mobileShortcuts = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Calendar, label: "Gigs", path: "/gigs" },
    { icon: ListMusic, label: "Setlists", path: "/setlists" },
    { icon: Mic, label: "Busking", path: "/busking" },
    { icon: Plane, label: "Travel", path: "/travel" },
    { icon: Megaphone, label: "PR", path: "/pr" },
    { icon: User, label: "My Character", path: "/my-character" },
    { icon: DollarSign, label: "Underworld", path: "/underworld" },
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

  const isActive = (path: string) => {
    if (location.pathname === path) {
      return true;
    }

    if (!path || path === "/") {
      return false;
    }

    return location.pathname.startsWith(`${path}/`);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
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
      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h3 className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={`${item.path}-${item.label}`}
                    variant={isActive(item.path) ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-3 ${
                      isActive(item.path)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                    onClick={() => handleNavigation(item.path)}
                    aria-current={isActive(item.path) ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>
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

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 h-screen bg-sidebar border-r border-sidebar-border flex-col">
        <NavigationContent />
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-sidebar-border">
        <div className="flex justify-around items-center py-2">
          {mobileShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={`${item.path}-${item.label}`}
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
                <span className="text-xs font-oswald">{item.label.split(' ')[0]}</span>
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
            <span className="text-xs font-oswald">More</span>
          </Button>
        </div>
      </div>
    </>
  );
};

export default Navigation;