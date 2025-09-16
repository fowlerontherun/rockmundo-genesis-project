import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  Play
} from "lucide-react";

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

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
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src="/src/assets/rockmundo-logo.png" 
              alt="RockMundo Logo"
              className="h-12 w-auto"
            />
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
      <nav className="flex-1 p-4 space-y-2">
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
              onClick={() => navigate(item.path)}
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
    </div>
  );
};

export default Navigation;