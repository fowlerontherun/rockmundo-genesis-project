import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Award, Trophy, Lock, Search, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Achievement = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  rarity: string | null;
  requirements: Record<string, any> | null;
  rewards: Record<string, any> | null;
};

type PlayerAchievement = {
  id: string;
  achievement_id: string;
  unlocked_at: string | null;
  progress: Record<string, any> | null;
};

const rarityStyles: Record<string, string> = {
  common: "bg-secondary/60 text-secondary-foreground border-secondary",
  uncommon: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  rare: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  legendary: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  mythic: "bg-gradient-to-r from-pink-500/20 to-indigo-500/20 text-white border-pink-500/30",
};

function extractProgress(a: Achievement, pa?: PlayerAchievement): { current: number; target: number } | null {
  const req = a.requirements ?? {};
  const prog = pa?.progress ?? {};
  // Try common shapes: { target: N } / { count: N } / first numeric value
  const targetKey = Object.keys(req).find((k) => typeof req[k] === "number");
  if (!targetKey) return null;
  const target = Number(req[targetKey]) || 0;
  if (target <= 0) return null;
  const current =
    Number(prog[targetKey]) ||
    Number(prog.current) ||
    Number(prog.value) ||
    (pa?.unlocked_at ? target : 0);
  return { current: Math.min(current, target), target };
}

export default function AchievementsProgress() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const { data: allAchievements, isLoading: loadingAll } = useQuery({
    queryKey: ["achievements-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("category")
        .order("rarity");
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
  });

  const { data: earned, isLoading: loadingEarned } = useQuery({
    queryKey: ["player-achievements", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_achievements")
        .select("id, achievement_id, unlocked_at, progress")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as PlayerAchievement[];
    },
  });

  const earnedMap = useMemo(() => {
    const m = new Map<string, PlayerAchievement>();
    (earned ?? []).forEach((e) => m.set(e.achievement_id, e));
    return m;
  }, [earned]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (allAchievements ?? []).forEach((a) => a.category && set.add(a.category));
    return ["all", ...Array.from(set).sort()];
  }, [allAchievements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allAchievements ?? []).filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [allAchievements, search, category]);

  const completed = filtered.filter((a) => earnedMap.has(a.id));
  const remaining = filtered.filter((a) => !earnedMap.has(a.id));

  const totalCount = allAchievements?.length ?? 0;
  const earnedCount = earned?.length ?? 0;
  const overallPct = totalCount ? Math.round((earnedCount / totalCount) * 100) : 0;

  const loading = loadingAll || loadingEarned;

  const renderCard = (a: Achievement, isEarned: boolean) => {
    const pa = earnedMap.get(a.id);
    const progress = extractProgress(a, pa);
    const rarityClass = rarityStyles[a.rarity ?? "common"] ?? rarityStyles.common;
    return (
      <Card
        key={a.id}
        className={cn(
          "transition-colors",
          isEarned ? "border-primary/40 bg-primary/5" : "opacity-90",
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                isEarned ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground",
              )}
            >
              {isEarned ? <Trophy className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight flex items-center gap-2">
                <span className="truncate">{a.name}</span>
                {isEarned && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
              </CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cn("capitalize text-[10px]", rarityClass)}>
                  {a.rarity ?? "common"}
                </Badge>
                {a.category && (
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {a.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {a.description && (
            <CardDescription className="text-xs">{a.description}</CardDescription>
          )}
          {progress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Progress</span>
                <span>
                  {progress.current.toLocaleString()} / {progress.target.toLocaleString()}
                </span>
              </div>
              <Progress
                value={(progress.current / progress.target) * 100}
                className="h-1.5"
              />
            </div>
          )}
          {isEarned && pa?.unlocked_at && (
            <p className="text-[11px] text-muted-foreground">
              Unlocked {format(new Date(pa.unlocked_at), "PP")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">


      <div className="flex items-center gap-3">
        <Award className="h-7 w-7 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
          <p className="text-sm text-muted-foreground">
            Your completed milestones and what's still ahead.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Overall Progress</CardTitle>
              <CardDescription>
                {earnedCount} of {totalCount} achievements unlocked
              </CardDescription>
            </div>
            <div className="text-3xl font-bold text-primary">{overallPct}%</div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={overallPct} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search achievements..."
            className="pl-8"
          />
        </div>
        <Tabs value={category} onValueChange={setCategory} className="w-full sm:w-auto">
          <TabsList className="flex w-full flex-wrap justify-start sm:w-auto">
            {categories.map((c) => (
              <TabsTrigger key={c} value={c} className="capitalize text-xs">
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Loading achievements...
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="remaining" className="space-y-4">
          <TabsList>
            <TabsTrigger value="remaining">
              Remaining <Badge variant="secondary" className="ml-2">{remaining.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed <Badge variant="secondary" className="ml-2">{completed.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all">
              All <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="remaining">
            {remaining.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Nothing left in this filter — legendary work!
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {remaining.map((a) => renderCard(a, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completed.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No achievements unlocked yet in this filter.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {completed.map((a) => renderCard(a, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((a) => renderCard(a, earnedMap.has(a.id)))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
