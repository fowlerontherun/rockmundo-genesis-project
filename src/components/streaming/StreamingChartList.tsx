import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, Trophy, Music } from "lucide-react";
import { useState } from "react";
import { TrackableSongPlayer } from "@/components/audio/TrackableSongPlayer";

interface StreamingChartListProps {
  platformId: string;
  brandColor?: string;
}

const chartTypes = [
  { value: "top_40_today", label: "Top 40 Today" },
  { value: "top_40_week", label: "Top 40 This Week" },
  { value: "viral_50", label: "Viral 50" },
];

const regions = [
  { value: "GLOBAL", label: "Global" },
  { value: "US", label: "United States" },
  { value: "UK", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "JP", label: "Japan" },
  { value: "BR", label: "Brazil" },
  { value: "AU", label: "Australia" },
  { value: "CA", label: "Canada" },
];

interface ChartEntry {
  position: number;
  song_id: string;
  song_title: string;
  artist_name: string;
  streams: number;
  movement: "up" | "down" | "same" | "new";
  movement_value?: number;
  audio_url?: string;
  audio_status?: string;
}

export function StreamingChartList({ platformId, brandColor = "#6366f1" }: StreamingChartListProps) {
  const [chartType, setChartType] = useState("top_40_today");
  const [region, setRegion] = useState("GLOBAL");

  const { data: chartData, isLoading } = useQuery<ChartEntry[]>({
    queryKey: ["streaming-chart", platformId, chartType, region],
    queryFn: async (): Promise<ChartEntry[]> => {
      // Generate simulated chart data from released songs
      const { data: songs } = await supabase
        .from("songs")
        .select("id, title, quality_score, audio_url, audio_generation_status, band_id")
        .eq("status", "released")
        .order("quality_score", { ascending: false })
        .limit(40);

      if (!songs?.length) return [];

      // Get band names
      const bandIds = songs.filter(s => s.band_id).map(s => s.band_id) as string[];
      let bands: any[] = [];
      if (bandIds.length > 0) {
        const { data: bandData } = await supabase
          .from("bands")
          .select("id, name")
          .in("id", bandIds);
        bands = bandData || [];
      }

      return songs.map((song, index) => {
        const band = bands.find(b => b.id === song.band_id);
        const movements: ("up" | "down" | "same" | "new")[] = ["up", "down", "same", "new"];
        const movement = movements[Math.floor(Math.random() * movements.length)];
        
        return {
          position: index + 1,
          song_id: song.id,
          song_title: song.title,
          artist_name: band?.name || "Unknown Artist",
          streams: Math.floor(Math.random() * 10000000) + 100000,
          movement,
          movement_value: movement === "same" ? 0 : Math.floor(Math.random() * 10) + 1,
          audio_url: song.audio_url || undefined,
          audio_status: song.audio_generation_status || undefined,
        };
      });
    },
    enabled: !!platformId,
  });

  const getMovementIcon = (movement: string, value?: number) => {
    switch (movement) {
      case "up":
        return (
          <div className="flex items-center gap-1 text-emerald-500">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">+{value || 0}</span>
          </div>
        );
      case "down":
        return (
          <div className="flex items-center gap-1 text-destructive">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs">-{value || 0}</span>
          </div>
        );
      case "new":
        return <Badge className="text-xs" style={{ backgroundColor: brandColor }}>NEW</Badge>;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPositionStyle = (position: number) => {
    if (position === 1) return "bg-amber-500 text-white";
    if (position === 2) return "bg-slate-400 text-white";
    if (position === 3) return "bg-amber-700 text-white";
    return "bg-muted";
  };

  const formatStreams = (streams: number) => {
    if (streams >= 1000000) return `${(streams / 1000000).toFixed(1)}M`;
    if (streams >= 1000) return `${(streams / 1000).toFixed(0)}K`;
    return streams.toString();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Select value={chartType} onValueChange={setChartType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Chart Type" />
          </SelectTrigger>
          <SelectContent>
            {chartTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            {regions.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!chartData?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">No Chart Data Available</p>
            <p className="text-sm text-muted-foreground">
              Charts update daily based on streaming activity.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {chartData.map((entry) => (
            <Card key={entry.song_id} className="overflow-hidden hover:bg-accent/50 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${getPositionStyle(entry.position)}`}>
                    {entry.position}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{entry.song_title}</p>
                    <p className="text-sm text-muted-foreground truncate">{entry.artist_name}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    {getMovementIcon(entry.movement, entry.movement_value)}
                    
                    <div className="text-right">
                      <p className="font-medium">{formatStreams(entry.streams)}</p>
                      <p className="text-xs text-muted-foreground">streams</p>
                    </div>
                  </div>
                </div>

                {(entry.audio_url || entry.audio_status) && (
                  <div className="mt-3 pt-3 border-t">
                    <TrackableSongPlayer
                      songId={entry.song_id}
                      audioUrl={entry.audio_url}
                      generationStatus={entry.audio_status}
                      title={entry.song_title}
                      artist={entry.artist_name}
                      compact
                      source="streaming_chart"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
