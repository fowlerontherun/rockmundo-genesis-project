// @ts-nocheck
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Trophy, Music } from "lucide-react";
import { TrackableSongPlayer } from "@/components/audio/TrackableSongPlayer";
import { SongVoting } from "@/components/audio/SongVoting";
import { useVoteWeightedScore } from "@/hooks/useVoteWeightedScore";

const CompetitiveCharts = () => {
  const [country, setCountry] = useState("all");
  const [genre, setGenre] = useState("all");

  // Fetch genres from database
  const { data: genres } = useQuery({
    queryKey: ["chart-genres"],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("genre")
        .not("genre", "is", null);
      const uniqueGenres = [...new Set(data?.map(s => s.genre).filter(Boolean))];
      return uniqueGenres.sort();
    },
  });

  // Fetch countries from database
  const { data: countries } = useQuery({
    queryKey: ["chart-countries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cities")
        .select("country")
        .not("country", "is", null);
      const uniqueCountries = [...new Set(data?.map(c => c.country).filter(Boolean))];
      return uniqueCountries.sort();
    },
  });

  // Fetch chart entries for today
  const { data: chartEntries, isLoading } = useQuery({
    queryKey: ["chart-entries", country, genre],
    queryFn: async () => {
      let query = supabase
        .from("chart_entries")
        .select(`
          *,
          songs (
            id,
            title,
            genre,
            user_id,
            band_id,
            audio_url,
            audio_generation_status,
            bands (name),
            profiles:user_id (stage_name)
          )
        `)
        .eq("chart_date", new Date().toISOString().split('T')[0])
        .order("rank", { ascending: true });

      if (genre !== "all") {
        query = query.eq("genre", genre);
      }

      if (country !== "all") {
        query = query.eq("country", country);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Get vote-weighted scores for chart songs
  const songIds = chartEntries?.map(e => e.song_id).filter(Boolean) || [];
  const { data: voteScores } = useVoteWeightedScore(songIds);

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const renderChartTable = (data: any[], type: string) => {
    if (isLoading) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p>Loading chart data...</p>
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Music className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>No chart data available yet</p>
          <p className="text-sm mt-2">Charts are updated daily at 3 AM</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {data.map((entry, index) => {
          const song = entry.songs;
          const artistName = song?.bands?.name || song?.profiles?.stage_name || "Unknown Artist";
          const voteScore = voteScores?.[entry.song_id];
          
          return (
            <Card key={entry.id || entry.song_id} className="hover:bg-secondary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                    <span className="text-2xl font-bold text-primary">
                      {entry.rank || index + 1}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{song?.title || "Unknown Song"}</h3>
                      {entry.rank === 1 && <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{artistName}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {song?.genre || "Unknown"}
                      </Badge>
                      {entry.weeks_on_chart && (
                        <span className="text-xs text-muted-foreground">
                          {entry.weeks_on_chart} week{entry.weeks_on_chart !== 1 ? "s" : ""} on chart
                        </span>
                      )}
                      {voteScore && voteScore.weightedScore !== 0 && (
                        <Badge variant={voteScore.weightedScore > 0 ? "default" : "destructive"} className="text-xs">
                          {voteScore.weightedScore > 0 ? "+" : ""}{voteScore.weightedScore} votes
                        </Badge>
                      )}
                    </div>
                    
                    {/* Audio Player with tracking */}
                    {song?.audio_url && (
                      <div className="mt-2">
                        <TrackableSongPlayer
                          songId={song.id}
                          audioUrl={song.audio_url}
                          generationStatus={song.audio_generation_status}
                          title={song.title}
                          artist={artistName}
                          compact
                          source="competitive_charts"
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0 space-y-2">
                    {type === "streams" ? (
                      <div className="text-lg font-bold text-primary">
                        {entry.total_streams?.toLocaleString() || "0"} streams
                      </div>
                    ) : (
                      <div className="text-lg font-bold text-primary">
                        {entry.plays_count?.toLocaleString() || "0"} plays
                      </div>
                    )}
                    {entry.trend && (
                      <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                        {getTrendIcon(entry.trend)}
                        {entry.trend_change && Math.abs(entry.trend_change)}
                      </div>
                    )}
                    
                    {/* Voting */}
                    {song?.id && (
                      <SongVoting songId={song.id} compact showCounts />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const streamChartData = chartEntries?.filter(e => e.chart_type === "streaming") || [];
  const recordSalesData = chartEntries?.filter(e => e.chart_type === "record_sales") || [];
  const digitalSalesData = chartEntries?.filter(e => e.chart_type === "digital_sales") || [];
  const cdSalesData = chartEntries?.filter(e => e.chart_type === "cd_sales") || [];
  const vinylSalesData = chartEntries?.filter(e => e.chart_type === "vinyl_sales") || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Music Charts</h1>
          <p className="text-muted-foreground">
            Track your musical success against other artists • Updated daily at 3 AM
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Country</label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries?.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Genre</label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {genres?.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart Tabs */}
      <Tabs defaultValue="streams" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="streams">Streams</TabsTrigger>
          <TabsTrigger value="digital">Digital Sales</TabsTrigger>
          <TabsTrigger value="cd">CD Sales</TabsTrigger>
          <TabsTrigger value="vinyl">Vinyl Sales</TabsTrigger>
          <TabsTrigger value="records">Record Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="streams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Streaming Songs</CardTitle>
              <CardDescription>Most streamed songs across all platforms</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChartTable(streamChartData, "streams")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="digital" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Digital Sales Chart</CardTitle>
              <CardDescription>Top selling digital downloads</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChartTable(digitalSalesData, "sales")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cd" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CD Sales Chart</CardTitle>
              <CardDescription>Top selling CDs</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChartTable(cdSalesData, "sales")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vinyl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vinyl Sales Chart</CardTitle>
              <CardDescription>Top selling vinyl records</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChartTable(vinylSalesData, "sales")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overall Record Sales</CardTitle>
              <CardDescription>Combined physical record sales</CardDescription>
            </CardHeader>
            <CardContent>
              {renderChartTable(recordSalesData, "sales")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompetitiveCharts;