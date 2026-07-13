import { Link } from "react-router-dom";
import { Activity, Backpack, Heart, Palette, Sparkles, Trophy, User, Wallet, Zap } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";

const formatMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value ?? 0);

const StatCard = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Heart }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

const quickLinks = [
  { label: "Skills", path: "/skills", icon: Sparkles, description: "Review progression and unlocks." },
  { label: "Wellness", path: "/wellness", icon: Heart, description: "Manage health, energy and recovery." },
  { label: "Inventory", path: "/inventory", icon: Backpack, description: "Check items and owned stock." },
  { label: "Wardrobe", path: "/clothing-shop", icon: Palette, description: "Shop and maintain your look." },
];

export default function CharacterOverview() {
  const { user, loading: authLoading } = useAuth();
  const { profile, skillProgress, activityStatus, activities, xpWallet, loading, error, refetch } = useGameData();

  if (authLoading || loading) {
    return <PageLoadingState title="Loading Character Overview" description="Fetching your active character snapshot..." />;
  }

  if (!user) {
    return (
      <PageEmptyState
        title="Sign in to view your character"
        description="Character overview is available after you log in and choose an active character."
        action={<Button asChild><Link to="/auth">Sign in</Link></Button>}
      />
    );
  }

  if (error) {
    return <PageErrorState title="Character overview could not be loaded" description={error} onRetry={() => void refetch()} />;
  }

  if (!profile) {
    return (
      <PageEmptyState
        title="No active character found"
        description="Create or switch to a character before using Character tools."
        action={<Button asChild><Link to="/characters">Manage characters</Link></Button>}
      />
    );
  }

  const displayName = profile.display_name || profile.username || "Unknown Artist";
  const topSkills = [...(skillProgress ?? [])]
    .sort((a, b) => (b.current_level ?? 0) - (a.current_level ?? 0) || (b.current_xp ?? 0) - (a.current_xp ?? 0))
    .slice(0, 4);
  const recentEvents = (activities ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary/30">
              <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
              <AvatarFallback><User className="h-9 w-9" aria-hidden /></AvatarFallback>
            </Avatar>
            <div>
              <Badge variant="outline" className="mb-2">Character</Badge>
              <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
              <p className="text-sm text-muted-foreground">Overview of your artist status, progression and next actions.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/my-character">Edit character</Link></Button>
            <Button asChild><Link to="/wellness">Open Wellness</Link></Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Character status">
        <StatCard label="Health" value={`${profile.health ?? 100}%`} icon={Heart} />
        <StatCard label="Energy" value={`${profile.energy ?? 100}%`} icon={Zap} />
        <StatCard label="Money" value={formatMoney((profile as { money?: number | null }).money)} icon={Wallet} />
        <StatCard label="Level" value={profile.level ?? 1} icon={Trophy} />
        <StatCard label="XP" value={xpWallet?.xp_balance ?? 0} icon={Sparkles} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Current activity</CardTitle></CardHeader>
          <CardContent>
            {activityStatus ? (
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="font-medium">{activityStatus.status}</p>
                {activityStatus.started_at ? <p className="text-sm text-muted-foreground">Started {new Date(activityStatus.started_at).toLocaleString()}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No current activity is running.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick links</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Button key={link.path} asChild variant="ghost" className="h-auto justify-start gap-3 p-3 text-left">
                  <Link to={link.path}>
                    <Icon className="h-4 w-4 text-primary" aria-hidden />
                    <span><span className="block font-medium">{link.label}</span><span className="block text-xs text-muted-foreground">{link.description}</span></span>
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Skills summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {topSkills.length ? topSkills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{skill.skill_slug.replace(/[-_]/g, " ")}</span>
                <Badge variant="secondary">Level {skill.current_level ?? 0}</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">No skill progress has been recorded yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent events</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentEvents.length ? recentEvents.map((event) => (
              <div key={event.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{event.message}</p>
                {event.created_at ? <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p> : null}
              </div>
            )) : <p className="text-sm text-muted-foreground">No recent character events are available.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
