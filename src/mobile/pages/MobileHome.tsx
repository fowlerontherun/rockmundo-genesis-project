import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Zap, Heart, Smile, Plane, MessageSquare, Twitter, Moon, RefreshCw, CalendarDays,
} from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useScheduledActivities } from "@/hooks/useScheduledActivities";
import { StatCard } from "../components/StatCard";
import { QuickActionCard } from "../components/QuickActionCard";
import { NotificationCard } from "../components/NotificationCard";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/SkeletonCard";
import { MobileEntityCard, MobileErrorState, MobileSectionCard, MobileStatusBadge } from "../components/MobilePrimitives";
import { MobileInstallPrompt, MobileNotificationGroups, MobileOfflineState, MobileReturningBriefing, MobileUpdateBanner } from "../components/MobileOnboarding";

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function MobileHome() {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const { userId } = useActiveProfile();
  const { notifications, markRead, isLoading } = useNotificationsFeed();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const today = useScheduledActivities(new Date(), userId ?? undefined);

  const displayName = profile?.display_name || profile?.username || "Player";
  const p: any = profile ?? {};
  const energy = Math.max(0, Math.min(100, Number(p.energy ?? p.health ?? 80)));
  const mood = Math.max(0, Math.min(100, Number(p.mood ?? p.happiness ?? 70)));
  const health = Math.max(0, Math.min(100, Number(p.health ?? 85)));

  const filter = params.get("tab");
  const shown = filter === "notifications" ? notifications : notifications.slice(0, 5);

  // Mobile is intentionally a companion experience: plan/check the day and perform
  // lightweight actions. Deep creation and management remain desktop-only.
  const quickActions = [
    { label: "My Day", icon: <CalendarDays className="h-5 w-5" />, to: "/mobile/career/practice" },
    { label: "Practice", icon: <Zap className="h-5 w-5" />, to: "/mobile/career/practice" },
    { label: "Travel", icon: <Plane className="h-5 w-5" />, to: "/mobile/world/travel" },
    { label: "Message", icon: <MessageSquare className="h-5 w-5" />, to: "/mobile/social/messages" },
    { label: "Twaater", icon: <Twitter className="h-5 w-5" />, to: "/mobile/social/twaater" },
    { label: "Recover", icon: <Moon className="h-5 w-5" />, to: "/mobile/me/wellness" },
  ];

  const refresh = () => qc.invalidateQueries();
  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 5 ? "Late night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{greet}</div>
          <div className="font-bold text-xl leading-tight">{displayName}</div>
        </div>
        <button onClick={refresh} aria-label="Refresh" className="rm-tap h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      <MobileOfflineState />
      <MobileUpdateBanner />
      <MobileReturningBriefing notifications={notifications} />

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Energy" value={energy} icon={<Zap className="h-4 w-4" />} color="hsl(var(--primary))" />
        <StatCard label="Mood" value={mood} icon={<Smile className="h-4 w-4" />} color="hsl(var(--primary))" />
        <StatCard label="Health" value={health} icon={<Heart className="h-4 w-4" />} color="hsl(var(--destructive))" />
      </div>

      <MobileSectionCard title="Today" subtitle="Your authoritative schedule and completed outcomes for today.">
        {today.isLoading ? <SkeletonCard /> : today.isError ? (
          <MobileErrorState message="Today's schedule could not be loaded." onRetry={() => today.refetch()} />
        ) : today.data?.length ? (
          <div className="space-y-2">
            {today.data.slice(0, 8).map((activity) => (
              <MobileEntityCard
                key={`${activity.activity_type}-${activity.id}`}
                title={activity.title}
                subtitle={`${formatTime(activity.scheduled_start)}–${formatTime(activity.scheduled_end)}${activity.location ? ` • ${activity.location}` : ""}`}
                icon={<CalendarDays className="h-5 w-5" />}
                meta={<MobileStatusBadge tone={activity.status === "completed" ? "success" : activity.status === "in_progress" ? "info" : "neutral"}>{activity.status.replace("_", " ")}</MobileStatusBadge>}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing scheduled today" message="Use the mobile companion to plan lightweight activities, then check back here for progress and outcomes." />
        )}
      </MobileSectionCard>

      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="font-bold text-[15px]">Quick actions</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((a) => <QuickActionCard key={a.label} label={a.label} icon={a.icon} to={a.to} />)}
        </div>
      </section>

      <MobileSectionCard title="Desktop gameplay" subtitle="Deep management stays on desktop by design.">
        <p className="text-sm text-muted-foreground">
          Song creation, detailed band management, releases, equipment, business management and other configuration-heavy systems are intentionally not duplicated on mobile.
        </p>
      </MobileSectionCard>

      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="font-bold text-[15px]">Notifications</h2>
          <button onClick={() => navigate("/mobile/social/mail")} className="text-[12px] text-primary font-semibold">Mail</button>
        </div>
        <div className="space-y-2">
          {isLoading && <SkeletonCard />}
          {!isLoading && shown.length === 0 && <EmptyState title="All caught up" message="New activity will appear here." />}
          {filter === "notifications" ? (
            <MobileNotificationGroups notifications={shown} onOpen={(n) => { markRead(n.id); if (n.action_path?.startsWith("/mobile/")) navigate(n.action_path); }} />
          ) : shown.map((n) => <NotificationCard key={n.id} n={n} onRead={markRead} />)}
        </div>
      </section>

      <MobileInstallPrompt />
    </div>
  );
}
