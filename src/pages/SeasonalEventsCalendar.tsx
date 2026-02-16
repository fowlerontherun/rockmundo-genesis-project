import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { getSeasonEmoji, getCurrentSeason, getMonthName } from "@/utils/gameCalendar";
import type { Season } from "@/utils/gameCalendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle2, Snowflake, Sun, Leaf, Flower2 } from "lucide-react";

const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

const SEASON_MONTHS: Record<Season, { start: number; end: number; label: string }> = {
  spring: { start: 3, end: 5, label: "March – May" },
  summer: { start: 6, end: 8, label: "June – August" },
  autumn: { start: 9, end: 11, label: "September – November" },
  winter: { start: 12, end: 2, label: "December – February" },
};

const SEASON_ICONS: Record<Season, React.ReactNode> = {
  spring: <Flower2 className="h-4 w-4" />,
  summer: <Sun className="h-4 w-4" />,
  autumn: <Leaf className="h-4 w-4" />,
  winter: <Snowflake className="h-4 w-4" />,
};

const SeasonalEventsCalendar = () => {
  const { user } = useAuth();
  const { data: calendar } = useGameCalendar();
  const currentSeason = calendar?.season ?? "spring";
  const [activeTab, setActiveTab] = useState<string>(currentSeason);

  // Fetch seasonal events
  const { data: events } = useQuery({
    queryKey: ["seasonal-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("random_events")
        .select("id, title, description, season, option_a_text, option_b_text, is_common")
        .eq("is_active", true)
        .not("season", "is", null);
      return data || [];
    },
  });

  // Fetch player's encountered events
  const { data: playerEvents } = useQuery({
    queryKey: ["player-seasonal-events", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("player_events")
        .select("event_id")
        .eq("user_id", user.id);
      return data?.map((e) => e.event_id) || [];
    },
    enabled: !!user?.id,
  });

  const encounteredSet = useMemo(() => new Set(playerEvents || []), [playerEvents]);

  // Group events by season
  const eventsBySeason = useMemo(() => {
    const grouped: Record<Season, typeof events> = {
      spring: [], summer: [], autumn: [], winter: [],
    };
    events?.forEach((e) => {
      const s = e.season as Season;
      if (grouped[s]) grouped[s]!.push(e);
    });
    return grouped;
  }, [events]);

  // Season progress (how far through current season in days)
  const seasonProgress = useMemo(() => {
    if (!calendar) return 0;
    const monthInSeason = ((calendar.gameMonth - 1) % 3); // 0, 1, 2
    const dayProgress = (monthInSeason * 30 + calendar.gameDay) / 90;
    return Math.round(dayProgress * 100);
  }, [calendar]);

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-7 w-7" />
          Seasonal Events Calendar
        </h1>
        <p className="text-muted-foreground mt-1">
          Discover season-specific events and holidays throughout the game year.
        </p>
      </div>

      {/* Current season progress */}
      {calendar && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getSeasonEmoji(currentSeason)}</span>
                <span className="font-semibold capitalize">{currentSeason}</span>
                <span className="text-muted-foreground">
                  — Day {calendar.gameDay}, Year {calendar.gameYear}
                </span>
              </div>
              <Badge variant="outline">{seasonProgress}% complete</Badge>
            </div>
            <Progress value={seasonProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Season calendar overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SEASONS.map((s) => (
          <Card
            key={s}
            className={`cursor-pointer transition-all ${s === currentSeason ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100"}`}
            onClick={() => setActiveTab(s)}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl mb-1">{getSeasonEmoji(s)}</div>
              <p className="font-semibold capitalize">{s}</p>
              <p className="text-xs text-muted-foreground">{SEASON_MONTHS[s].label}</p>
              <Badge variant="secondary" className="mt-2 text-xs">
                {eventsBySeason[s]?.length || 0} events
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events by season tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          {SEASONS.map((s) => (
            <TabsTrigger key={s} value={s} className="flex items-center gap-1.5 capitalize">
              {SEASON_ICONS[s]}
              {s}
            </TabsTrigger>
          ))}
        </TabsList>

        {SEASONS.map((s) => (
          <TabsContent key={s} value={s} className="space-y-3 mt-4">
            {eventsBySeason[s]?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No seasonal events for {s} yet.
                </CardContent>
              </Card>
            ) : (
              eventsBySeason[s]?.map((event) => {
                const encountered = encounteredSet.has(event.id);
                return (
                  <Card key={event.id} className={encountered ? "border-primary/30 bg-primary/5" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        {encountered && (
                          <Badge variant="default" className="flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            Encountered
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{event.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <div className="rounded-md border p-3 text-sm">
                          <p className="font-medium text-xs text-muted-foreground mb-1">Option A</p>
                          <p>{event.option_a_text}</p>
                        </div>
                        <div className="rounded-md border p-3 text-sm">
                          <p className="font-medium text-xs text-muted-foreground mb-1">Option B</p>
                          <p>{event.option_b_text}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default SeasonalEventsCalendar;
