import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Coins,
  Users,
  Music2,
  Target,
  Bell,
  Trophy,
  Sparkles,
  ArrowRight,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface DashboardHeroProps {
  profile: any;
  userId?: string | null;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface NextBestAction {
  label: string;
  description: string;
  to: string;
  cta: string;
  icon: typeof Sparkles;
  tone?: "danger" | "warning" | "info" | "success";
}

function buildNextActions(profile: any, opts: {
  unread: number;
  unreadInbox: number;
  pendingGigsToday: number;
  pendingOffers: number;
  currentProject: any;
}): NextBestAction[] {
  const energy = profile?.energy ?? 100;
  const health = profile?.health ?? 100;
  const fame = profile?.fame ?? 0;
  const cash = profile?.cash ?? 0;
  const out: NextBestAction[] = [];

  if (health < 30) out.push({ label: "Rest up — health critical", description: "Sleep or visit a clinic.", to: "/wellness", cta: "Recover", icon: Flame, tone: "danger" });
  if (energy < 25) out.push({ label: "Refill energy", description: "Low energy hurts every action.", to: "/schedule", cta: "Sleep", icon: Flame, tone: "warning" });
  if (opts.pendingGigsToday > 0) out.push({ label: `${opts.pendingGigsToday} gig${opts.pendingGigsToday === 1 ? "" : "s"} today`, description: "Get to the venue and warm up.", to: "/gigs", cta: "Open gigs", icon: Music2, tone: "info" });
  if (opts.pendingOffers > 0) out.push({ label: `${opts.pendingOffers} pending offer${opts.pendingOffers === 1 ? "" : "s"}`, description: "Review and accept new bookings.", to: "/gig-booking", cta: "Review", icon: Bell, tone: "info" });
  if (opts.unreadInbox > 0) out.push({ label: `${opts.unreadInbox} unread message${opts.unreadInbox === 1 ? "" : "s"}`, description: "Check your inbox.", to: "/inbox", cta: "Open inbox", icon: Bell, tone: "info" });
  if (opts.unread > 0 && opts.unreadInbox === 0) out.push({ label: `${opts.unread} new alert${opts.unread === 1 ? "" : "s"}`, description: "Tap the bell for details.", to: "/inbox", cta: "View", icon: Bell, tone: "info" });
  if (opts.currentProject && (opts.currentProject.progress ?? 0) < 100) out.push({ label: `Continue "${opts.currentProject.title}"`, description: `${Math.round(opts.currentProject.progress ?? 0)}% complete.`, to: "/booking/songwriting", cta: "Resume", icon: Music2, tone: "success" });
  if (fame < 100) out.push({ label: "Book a gig", description: "Perform to grow fame.", to: "/gigs", cta: "Find gigs", icon: Sparkles, tone: "success" });
  if (cash < 500) out.push({ label: "Earn quick cash", description: "Take a side job to top up.", to: "/booking/work", cta: "Find work", icon: Coins, tone: "warning" });
  if (out.length === 0) out.push({ label: "Write a new hit", description: "Keep the momentum going.", to: "/booking/songwriting", cta: "Start writing", icon: Music2, tone: "success" });
  if (out.length < 3) {
    if (!out.find(a => a.to === "/rehearsal")) out.push({ label: "Rehearse with your band", description: "Boost chemistry and stage skill.", to: "/rehearsal", cta: "Schedule", icon: Music2, tone: "success" });
    if (!out.find(a => a.to === "/release-manager")) out.push({ label: "Plan a release", description: "Turn finished songs into income.", to: "/release-manager", cta: "Open", icon: Trophy, tone: "success" });
  }
  return out.slice(0, 4);
}

const toneRing: Record<NonNullable<NextBestAction["tone"]>, string> = {
  danger: "border-destructive/50 bg-destructive/10 text-destructive",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info: "border-primary/40 bg-primary/10 text-primary",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export const DashboardHero = ({ profile, userId }: DashboardHeroProps) => {
  const profileId = profile?.id;

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["dashboard-unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  const { data: unreadInbox = 0 } = useQuery({
    queryKey: ["dashboard-unread-inbox", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("player_inbox")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("is_archived", false);
      return count ?? 0;
    },
  });

  const { data: pendingGigsToday = 0 } = useQuery({
    queryKey: ["dashboard-gigs-today", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);
      const { data: bm } = await (supabase as any)
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      const bandIds = (bm ?? []).map((r: any) => r.band_id);
      if (bandIds.length === 0) return 0;
      const { count } = await (supabase as any)
        .from("gigs")
        .select("id", { count: "exact", head: true })
        .in("band_id", bandIds)
        .in("status", ["scheduled", "in_progress"])
        .gte("scheduled_date", start.toISOString())
        .lte("scheduled_date", end.toISOString());
      return count ?? 0;
    },
  });

  const { data: pendingOffers = 0 } = useQuery({
    queryKey: ["dashboard-pending-offers", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data: bm } = await (supabase as any)
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      const bandIds = (bm ?? []).map((r: any) => r.band_id);
      if (bandIds.length === 0) return 0;
      const { count } = await (supabase as any)
        .from("gig_offers")
        .select("id", { count: "exact", head: true })
        .in("band_id", bandIds)
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const { data: currentProject } = useQuery({
    queryKey: ["dashboard-current-project", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("songwriting_projects")
        .select("id, title, progress, status")
        .eq("profile_id", profileId)
        .in("status", ["in_progress", "active", "writing"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: recentAchievements = [] } = useQuery({
    queryKey: ["dashboard-recent-achievements", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("player_achievements")
        .select("id, unlocked_at, achievements(name, icon, rarity)")
        .eq("profile_id", profileId)
        .order("unlocked_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const nba = useMemo(
    () => computeNextBestAction(profile, unreadCount),
    [profile, unreadCount]
  );

  const cash = profile?.cash ?? 0;
  const fans = profile?.fans ?? 0;
  const fame = profile?.fame ?? 0;
  const level = profile?.level ?? 1;
  const experience = profile?.experience ?? 0;
  const xpForNext = Math.pow(level + 1, 2) * 100;
  const xpForCurrent = Math.pow(level, 2) * 100;
  const xpPct = Math.max(
    0,
    Math.min(100, ((experience - xpForCurrent) / (xpForNext - xpForCurrent)) * 100)
  );

  const goals = [
    {
      icon: Trophy,
      label: `Level ${level} → ${level + 1}`,
      value: xpPct,
      hint: `${compact.format(Math.max(0, experience - xpForCurrent))} / ${compact.format(xpForNext - xpForCurrent)} XP`,
    },
    {
      icon: Users,
      label: "Fans",
      value: Math.min(100, (fans / 1000) * 100),
      hint: `${compact.format(fans)} / 1K`,
    },
    {
      icon: Sparkles,
      label: "Fame",
      value: Math.min(100, (fame / 500) * 100),
      hint: `${compact.format(fame)} / 500`,
    },
  ];

  const Icon = nba.icon;

  return (
    <div className="space-y-4">
      {/* Next Best Action — dominant CTA */}
      <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <CardContent className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="rounded-xl bg-primary/20 p-3 text-primary flex-shrink-0">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Do This Next
                </p>
                <h2 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight truncate">
                  {nba.label}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{nba.description}</p>
              </div>
            </div>
            <Link to={nba.to} className="sm:flex-shrink-0">
              <Button size="lg" className="w-full sm:w-auto gap-2 shadow-lg">
                {nba.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Key stats — money, fans, current project, notifications */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={Coins}
          label="Cash"
          value={currency.format(cash)}
          tone="success"
        />
        <StatTile
          icon={Users}
          label="Fans"
          value={compact.format(fans)}
          tone="primary"
        />
        <StatTile
          icon={Music2}
          label="Project"
          value={currentProject?.title ?? "None"}
          subtle={
            currentProject?.progress != null
              ? `${Math.round(currentProject.progress)}%`
              : "Start one"
          }
          tone="accent"
          to={currentProject ? "/booking/songwriting" : "/booking/songwriting"}
        />
        <StatTile
          icon={Bell}
          label="Inbox"
          value={unreadCount > 0 ? `${unreadCount} new` : "Clear"}
          tone={unreadCount > 0 ? "warning" : "muted"}
          to="/inbox"
        />
      </div>

      {/* Active goals with progress */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Goals
            </h3>
          </div>
          <div className="space-y-3">
            {goals.map((goal) => {
              const GoalIcon = goal.icon;
              return (
                <div key={goal.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <GoalIcon className="h-3.5 w-3.5 text-primary" />
                      {goal.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{goal.hint}</span>
                  </div>
                  <Progress value={goal.value} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent achievements */}
      {recentAchievements.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Recent Wins
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {recentAchievements.map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border bg-card/50 p-2.5"
                >
                  <div className="text-2xl flex-shrink-0">{a.achievements?.icon ?? "🏆"}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {a.achievements?.name ?? "Achievement"}
                    </p>
                    {a.achievements?.rarity && (
                      <Badge variant="outline" className="mt-0.5 text-[10px] capitalize">
                        {a.achievements.rarity}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface StatTileProps {
  icon: typeof Coins;
  label: string;
  value: string;
  subtle?: string;
  tone?: "success" | "primary" | "accent" | "warning" | "muted";
  to?: string;
}

const toneClasses: Record<NonNullable<StatTileProps["tone"]>, string> = {
  success: "text-emerald-500 bg-emerald-500/10",
  primary: "text-primary bg-primary/10",
  accent: "text-purple-500 bg-purple-500/10",
  warning: "text-amber-500 bg-amber-500/10",
  muted: "text-muted-foreground bg-muted",
};

const StatTile = ({ icon: Icon, label, value, subtle, tone = "muted", to }: StatTileProps) => {
  const body = (
    <Card className={cn("h-full transition-colors", to && "hover:bg-accent/40 cursor-pointer")}>
      <CardContent className="p-3 sm:p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
          <div className={cn("rounded-md p-1.5", toneClasses[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div>
          <p className="text-base sm:text-lg font-bold tracking-tight truncate">{value}</p>
          {subtle && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
};

export default DashboardHero;
