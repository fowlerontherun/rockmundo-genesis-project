import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Zap, Heart, Smile, Music4, Plane, PenLine, MessageSquare,
  Twitter, Moon, Utensils, Briefcase, ShoppingBag, RefreshCw,
} from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import { MCard } from "../components/MCard";
import { StatCard } from "../components/StatCard";
import { QuickActionCard } from "../components/QuickActionCard";
import { NotificationCard } from "../components/NotificationCard";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/SkeletonCard";

export default function MobileHome() {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const { notifications, markRead, isLoading } = useNotificationsFeed();
  const [params] = useSearchParams();
  const qc = useQueryClient();

  const displayName = profile?.display_name || profile?.username || "Player";
  const p: any = profile ?? {};
  // Best-effort vitals; the wellness page owns the authoritative view.
  const energy = Math.max(0, Math.min(100, Number(p.energy ?? p.health ?? 80)));
  const mood = Math.max(0, Math.min(100, Number(p.mood ?? p.happiness ?? 70)));
  const health = Math.max(0, Math.min(100, Number(p.health ?? 85)));

  const filter = params.get("tab");
  const shown = filter === "notifications" ? notifications : notifications.slice(0, 5);

  const quickActions = [
    { label: "Practice", icon: <Zap className="h-5 w-5" />, to: "/skills" },
    { label: "Write Song", icon: <PenLine className="h-5 w-5" />, to: "/songwriting" },
    { label: "Travel", icon: <Plane className="h-5 w-5" />, to: "/travel" },
    { label: "Jam", icon: <Music4 className="h-5 w-5" />, to: "/jams" },
    { label: "Message", icon: <MessageSquare className="h-5 w-5" />, to: "/social/messages" },
    { label: "Twaater", icon: <Twitter className="h-5 w-5" />, to: "/twaater" },
    { label: "Sleep", icon: <Moon className="h-5 w-5" />, to: "/wellness" },
    { label: "Eat", icon: <Utensils className="h-5 w-5" />, to: "/wellness" },
    { label: "Work", icon: <Briefcase className="h-5 w-5" />, to: "/employment" },
    { label: "Shop", icon: <ShoppingBag className="h-5 w-5" />, to: "/gear-shop" },
  ];

  const refresh = () => {
    qc.invalidateQueries();
  };

  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 5 ? "Late night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{greet}</div>
          <div className="font-bold text-xl leading-tight">{displayName}</div>
        </div>
        <button
          onClick={refresh}
          aria-label="Refresh"
          className="rm-tap h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Energy" value={energy} icon={<Zap className="h-4 w-4" />} color="hsl(var(--primary))" />
        <StatCard label="Mood" value={mood} icon={<Smile className="h-4 w-4" />} color="hsl(var(--primary))" />
        <StatCard label="Health" value={health} icon={<Heart className="h-4 w-4" />} color="hsl(var(--destructive))" />
      </div>

      {/* Objectives / today */}
      <MCard
        title="What's next?"
        subtitle="Your recommended action right now"
        onPress={() => navigate("/skills")}
        chevron
        icon={<Zap className="h-5 w-5" />}
      />

      {/* Quick actions */}
      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="font-bold text-[15px]">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => (
            <QuickActionCard key={a.label} label={a.label} icon={a.icon} to={a.to} />
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="font-bold text-[15px]">Notifications</h2>
          <button onClick={() => navigate("/inbox")} className="text-[12px] text-primary font-semibold">
            Inbox
          </button>
        </div>
        <div className="space-y-2">
          {isLoading && <SkeletonCard />}
          {!isLoading && shown.length === 0 && (
            <EmptyState title="All caught up" message="New activity will appear here." />
          )}
          {shown.map((n) => (
            <NotificationCard key={n.id} n={n} onRead={markRead} />
          ))}
        </div>
      </section>
    </div>
  );
}
