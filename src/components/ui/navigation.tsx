import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { 
  Home, 
  Users, 
  Calendar, 
  Music, 
  TrendingUp, 
  Settings, 
  LogOut,
  Guitar,
  ShoppingCart,
  Trophy,
  MapPin,
  User,
  Building2,
  Share2,
  Heart,
  Play,
  Menu,
  X
} from "lucide-react";

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Band", path: "/band" },
    { icon: Heart, label: "Chemistry", path: "/chemistry" },
    { icon: Calendar, label: "Gigs", path: "/gigs" },
    { icon: MapPin, label: "Venues", path: "/venues" },
    { icon: Music, label: "Studio", path: "/music" },
    { icon: Play, label: "Streaming", path: "/streaming" },
    { icon: TrendingUp, label: "Charts", path: "/charts" },
    { icon: Building2, label: "Labels", path: "/labels" },
    { icon: Share2, label: "Social", path: "/social" },
    { icon: Calendar, label: "Schedule", path: "/schedule" },
    { icon: ShoppingCart, label: "Equipment", path: "/equipment" },
    { icon: Users, label: "Fans", path: "/fans" },
    { icon: Trophy, label: "Achievements", path: "/achievements" },
    { icon: MapPin, label: "Tours", path: "/tours" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
    setIsOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const NavigationContent = ({ isMobile = false }) => (
    <>
      {/* Logo */}
      <div className={`${isMobile ? 'p-6' : 'p-6'} border-b border-sidebar-border`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg">
              <Guitar className="h-6 w-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bebas tracking-wider text-foreground">
              ROCKMUNDO
            </h1>
            <p className="text-xs text-sidebar-foreground font-oswald">LIVE THE DREAM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.path}
              variant={isActive(item.path) ? "secondary" : "ghost"}
              className={`w-full justify-start gap-3 ${
                isActive(item.path) 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              onClick={() => handleNavigation(item.path)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-sidebar-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg">
              <Guitar className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bebas tracking-wider text-foreground">
              ROCKMUNDO
            </h1>
          </div>
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
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
          {navItems.slice(0, 5).map((item) => {
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
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-oswald">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Navigation;