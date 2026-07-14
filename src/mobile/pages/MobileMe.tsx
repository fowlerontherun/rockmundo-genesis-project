import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Backpack, Shirt, Trophy, Settings, LogOut, Monitor } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { MCard } from "../components/MCard";
import { setMobileFlag } from "@/hooks/useIsMobileDevice";

export default function MobileMe() {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const displayName = profile?.display_name || profile?.username || "Player";
  const avatarUrl = (profile as any)?.avatar_url;

  const rows = [
    { title: "Character", icon: <User className="h-5 w-5" />, to: "/character" },
    { title: "Inventory", icon: <Backpack className="h-5 w-5" />, to: "/inventory" },
    { title: "Wardrobe", icon: <Shirt className="h-5 w-5" />, to: "/clothing-shop" },
    { title: "Achievements", icon: <Trophy className="h-5 w-5" />, to: "/achievements" },
    { title: "Settings", icon: <Settings className="h-5 w-5" />, to: "/character/profile/edit" },
  ];

  const toDesktop = () => {
    setMobileFlag(false);
    window.location.href = "/home?mobile=0";
  };

  return (
    <div className="space-y-3">
      <MCard className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 ring-2 ring-primary/40">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-bold text-lg leading-tight truncate">{displayName}</div>
            <div className="text-[12px] text-muted-foreground">@{profile?.username ?? "player"}</div>
          </div>
        </div>
      </MCard>

      <div className="grid gap-2">
        {rows.map((r) => (
          <MCard key={r.title} title={r.title} icon={r.icon} chevron onPress={() => navigate(r.to)} />
        ))}
      </div>

      <MCard
        title="Switch to desktop UI"
        subtitle="Use the full RockMundo interface"
        icon={<Monitor className="h-5 w-5" />}
        chevron
        onPress={toDesktop}
      />

      <MCard
        title="Sign out"
        icon={<LogOut className="h-5 w-5" />}
        onPress={() => navigate("/auth")}
      />
    </div>
  );
}
