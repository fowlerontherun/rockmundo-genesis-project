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
}

function computeNextBestAction(profile: any, unread: number): NextBestAction {
  const energy = profile?.energy ?? 100;
  const health = profile?.health ?? 100;
  const fame = profile?.fame ?? 0;

  if (health < 30) {
    return {
      label: "Recover Your Health",
      description: "You're burnt out. Rest before your career stalls.",
      to: "/hub/character",
      cta: "Rest now",
      icon: Flame,
    };
  }
  if (energy < 25) {
    return {
      label: "Refill Your Energy",
      description: "Low energy means weak performances. Grab some sleep.",
      to: "/schedule",
      cta: "Schedule rest",
      icon: Flame,
    };
  }
  if (unread > 0) {
    return {
      label: `${unread} New Message${unread === 1 ? "" : "s"}`,
      description: "Opportunities are waiting in your inbox.",
      to: "/inbox",
      cta: "Open inbox",
      icon: Bell,
    };
  }
  if (fame < 100) {
    return {
      label: "Book Your Next Gig",
      description: "Build fame by performing live. Find a stage tonight.",
      to: "/gigs",
      cta: "Find gigs",
      icon: Sparkles,
    };
  }
  return {
    label: "Write Your Next Hit",
    description: "Keep momentum going — head to the studio.",
    to: "/booking/songwriting",
    cta: "Start writing",
    icon: Music2,
  };
}

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
        .eq("read", false);
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
      label: "Grow Your Fanbase",
      value: Math.min(100, (fans / 1000) * 100),
      hint: `${compact.format(fans)} / 1K fans`,
    },
    {
      icon: Sparkles,
      label: "Build Fame",
      value: Math.min(100, (fame / 500) * 100),
      hint: `${compact.format(fame)} / 500 fame`,
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
                  Next Best Action
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
          label="Current Project"
          value={currentProject?.title ?? "None"}
          subtle={
            currentProject?.progress != null
              ? `${Math.round(currentProject.progress)}%`
              : "Start writing"
          }
          tone="accent"
          to={currentProject ? "/booking/songwriting" : "/booking/songwriting"}
        />
        <StatTile
          icon={Bell}
          label="Notifications"
          value={unreadCount > 0 ? `${unreadCount} new` : "All clear"}
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
              Active Goals
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
                Recent Achievements
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
