import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Save, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const GENRES = ["Rock", "Pop", "Dance", "Electronic", "Hip-Hop", "Jazz", "Classical", "Country", "R&B", "Indie"];
const SEASONS = ["spring", "summer", "autumn", "winter"];

export default function GameCalendar() {
  const queryClient = useQueryClient();
  const [configDaysPerYear, setConfigDaysPerYear] = useState(120);
  const [configDaysPerMonth, setConfigDaysPerMonth] = useState(10);

  // Fetch calendar config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["game-calendar-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_calendar_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setConfigDaysPerYear(data.real_world_days_per_game_year);
        setConfigDaysPerMonth(data.real_world_days_per_game_month);
      }
      
      return data;
    },
  });

  // Fetch season modifiers
  const { data: modifiers, isLoading: modifiersLoading } = useQuery({
    queryKey: ["season-genre-modifiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("season_genre_modifiers")
        .select("*")
        .order("season")
        .order("genre");

      if (error) throw error;
      return data || [];
    },
  });

  // Update config mutation
  const updateConfig = useMutation({
    mutationFn: async () => {
      if (!config?.id) {
        const { data, error } = await supabase
          .from("game_calendar_config")
          .insert({
            real_world_days_per_game_year: configDaysPerYear,
            real_world_days_per_game_month: configDaysPerMonth,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("game_calendar_config")
        .update({
          real_world_days_per_game_year: configDaysPerYear,
          real_world_days_per_game_month: configDaysPerMonth,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Calendar config updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["game-calendar-config"] });
    },
  });

  // Update modifier mutation
  const updateModifier = useMutation({
    mutationFn: async (params: {
      season: string;
      genre: string;
      streams: number;
      sales: number;
      attendance: number;
    }) => {
      const { data, error } = await supabase
        .from("season_genre_modifiers")
        .upsert({
          season: params.season,
          genre: params.genre,
          streams_multiplier: params.streams,
          sales_multiplier: params.sales,
          gig_attendance_multiplier: params.attendance,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Season modifier updated" });
      queryClient.invalidateQueries({ queryKey: ["season-genre-modifiers"] });
    },
  });

  const getModifier = (season: string, genre: string) => {
    return modifiers?.find((m) => m.season === season && m.genre === genre);
  };

  if (configLoading || modifiersLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Game Calendar Configuration</h1>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Calendar Settings</TabsTrigger>
          <TabsTrigger value="modifiers">Season Modifiers</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Time Progression Settings</CardTitle>
              <CardDescription>
                Configure how real-world time translates to in-game time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="daysPerYear">Real-World Days Per Game Year</Label>
                  <Input
                    id="daysPerYear"
                    type="number"
                    value={configDaysPerYear}
                    onChange={(e) => setConfigDaysPerYear(parseInt(e.target.value))}
                    min={30}
                    max={365}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: 120 days (4 real months = 1 game year)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daysPerMonth">Real-World Days Per Game Month</Label>
                  <Input
                    id="daysPerMonth"
                    type="number"
                    value={configDaysPerMonth}
                    onChange={(e) => setConfigDaysPerMonth(parseInt(e.target.value))}
                    min={1}
                    max={30}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: 10 days (10 real days = 1 game month)
                  </p>
                </div>
              </div>

              <Button onClick={() => updateConfig.mutate()} disabled={updateConfig.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateConfig.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modifiers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Season × Genre Multipliers
              </CardTitle>
              <CardDescription>
                Configure how different seasons affect music genres
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {SEASONS.map((season) => (
                  <div key={season} className="space-y-3">
                    <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
                      {season === "spring" && "🌸"}
                      {season === "summer" && "☀️"}
                      {season === "autumn" && "🍂"}
                      {season === "winter" && "❄️"}
                      {season}
                    </h3>
                    <div className="grid gap-4">
                      {GENRES.map((genre) => {
                        const modifier = getModifier(season, genre);
                        return (
                          <ModifierRow
                            key={`${season}-${genre}`}
                            season={season}
                            genre={genre}
                            modifier={modifier}
                            onUpdate={(streams, sales, attendance) =>
                              updateModifier.mutate({ season, genre, streams, sales, attendance })
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModifierRow({
  season,
  genre,
  modifier,
  onUpdate,
}: {
  season: string;
  genre: string;
  modifier?: any;
  onUpdate: (streams: number, sales: number, attendance: number) => void;
}) {
  const [streams, setStreams] = useState(Number(modifier?.streams_multiplier) || 1.0);
  const [sales, setSales] = useState(Number(modifier?.sales_multiplier) || 1.0);
  const [attendance, setAttendance] = useState(Number(modifier?.gig_attendance_multiplier) || 1.0);

  const hasChanges =
    streams !== (Number(modifier?.streams_multiplier) || 1.0) ||
    sales !== (Number(modifier?.sales_multiplier) || 1.0) ||
    attendance !== (Number(modifier?.gig_attendance_multiplier) || 1.0);

  return (
    <div className="flex items-center gap-4 p-3 bg-secondary/20 rounded-lg">
      <div className="w-24 font-medium">{genre}</div>
      <div className="flex-1 grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Streams</Label>
          <Input
            type="number"
            value={streams}
            onChange={(e) => setStreams(parseFloat(e.target.value))}
            step={0.1}
            min={0.5}
            max={2.0}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sales</Label>
          <Input
            type="number"
            value={sales}
            onChange={(e) => setSales(parseFloat(e.target.value))}
            step={0.1}
            min={0.5}
            max={2.0}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Attendance</Label>
          <Input
            type="number"
            value={attendance}
            onChange={(e) => setAttendance(parseFloat(e.target.value))}
            step={0.1}
            min={0.5}
            max={2.0}
            className="h-8"
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => onUpdate(streams, sales, attendance)}
        disabled={!hasChanges}
        className="whitespace-nowrap"
      >
        Save
      </Button>
    </div>
  );
}
