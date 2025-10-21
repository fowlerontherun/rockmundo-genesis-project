import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Trophy, Music } from "lucide-react";

const CompetitiveCharts = () => {
  const [country, setCountry] = useState("all");
  const [genre, setGenre] = useState("all");

  // Fetch chart entries
  const { data: chartEntries } = useQuery({
    queryKey: ["chart-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_entries")
        .select(`
          *,
          songs (
            title,
            genre,
            user_id,
            band_id,
            bands (name),
            profiles:user_id (stage_name)
          )
        `)
        .order("rank", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch streaming data from song_releases
  const { data: streamingData } = useQuery({
    queryKey: ["streaming-charts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_releases")
        .select(`
          song_id,
          total_streams,
          songs (
            title,
            genre,
            user_id,
            band_id,
            bands (name),
            profiles:user_id (stage_name)
          )
        `)
        .eq("is_active", true)
        .order("total_streams", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Aggregate by song (in case same song on multiple platforms)
      const aggregated = data?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.song_id === curr.song_id);
        if (existing) {
          existing.total_streams += curr.total_streams;
        } else {
          acc.push({ ...curr });
        }
        return acc;
      }, []) || [];

      return aggregated.sort((a, b) => b.total_streams - a.total_streams);
    },
  });

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const renderChartTable = (data: any[], type: string) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Music className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>No chart data available yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {data.map((entry, index) => {
          const song = entry.songs;
          const artistName = song?.bands?.name || song?.profiles?.stage_name || "Unknown Artist";
          
          return (
            <Card key={entry.id || entry.song_id} className="hover:bg-secondary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                    <span className="text-2xl font-bold text-primary">
                      {entry.rank || index + 1}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{song?.title || "Unknown Song"}</h3>
                      {entry.rank === 1 && <Trophy className="h-4 w-4 text-yellow-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{artistName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {song?.genre || "Unknown"}
                      </Badge>
                      {entry.weeks_on_chart && (
                        <span className="text-xs text-muted-foreground">
                          {entry.weeks_on_chart} week{entry.weeks_on_chart !== 1 ? "s" : ""} on chart
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
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
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const filterData = (data: any[]) => {
    if (!data) return [];
    
    let filtered = [...data];
    
    if (genre !== "all") {
      filtered = filtered.filter(entry => entry.songs?.genre === genre);
    }
    
    // Country filtering would require additional data in the schema
    // For now, we'll keep all data when "all" is selected
    
    return filtered;
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
          <p className="text-muted-foreground">Track your musical success against other artists</p>
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
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                  <SelectItem value="jp">Japan</SelectItem>
                  <SelectItem value="de">Germany</SelectItem>
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
                  <SelectItem value="Rock">Rock</SelectItem>
                  <SelectItem value="Pop">Pop</SelectItem>
                  <SelectItem value="Electronic">Electronic</SelectItem>
                  <SelectItem value="Hip Hop">Hip Hop</SelectItem>
                  <SelectItem value="Jazz">Jazz</SelectItem>
                  <SelectItem value="Metal">Metal</SelectItem>
                  <SelectItem value="Indie/Bedroom Pop">Indie/Bedroom Pop</SelectItem>
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
              {renderChartTable(filterData(streamingData || streamChartData), "streams")}
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
              {renderChartTable(filterData(digitalSalesData), "sales")}
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
              {renderChartTable(filterData(cdSalesData), "sales")}
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
              {renderChartTable(filterData(vinylSalesData), "sales")}
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
              {renderChartTable(filterData(recordSalesData), "sales")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompetitiveCharts;