import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Play,
  Loader2,
  Music,
  Crown,
  Star,
  Volume2,
  Clock
} from "lucide-react";

type ChartSong = {
  id: string;
  song_id: string;
  rank: number;
  chart_type: string;
  trend: string | null;
  weeks_on_chart: number | null;
  song: {
    id: string;
    title: string;
    genre: string | null;
    audio_url: string | null;
    extended_audio_url: string | null;
    audio_generation_status: string | null;
    bands: { name: string } | null;
  };
};

export function ChartTopSongsSection() {
  const queryClient = useQueryClient();
  const [selectedSong, setSelectedSong] = useState<ChartSong | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);

  // Fetch songs currently in top 10 of any chart
  const { data: chartSongs, isLoading, refetch } = useQuery({
    queryKey: ["admin-chart-top-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_entries")
        .select(`
          id,
          song_id,
          rank,
          chart_type,
          trend,
          weeks_on_chart,
          songs!inner (
            id,
            title,
            genre,
            audio_url,
            extended_audio_url,
            audio_generation_status,
            bands (name)
          )
        `)
        .lte("rank", 10)
        .order("rank", { ascending: true });

      if (error) throw error;
      
      // Transform and dedupe by song_id, keeping best rank
      const songMap = new Map<string, ChartSong>();
      (data || []).forEach((entry: any) => {
        const existing = songMap.get(entry.song_id);
        if (!existing || entry.rank < existing.rank) {
          songMap.set(entry.song_id, {
            id: entry.id,
            song_id: entry.song_id,
            rank: entry.rank,
            chart_type: entry.chart_type,
            trend: entry.trend,
            weeks_on_chart: entry.weeks_on_chart,
            song: entry.songs
          });
        }
      });
      
      return Array.from(songMap.values()).sort((a, b) => a.rank - b.rank);
    },
    staleTime: 30000,
  });

  const generateExtendedMutation = useMutation({
    mutationFn: async (songId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      setGenerationLogs(["Starting extended audio generation..."]);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-generate-extended-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ songId }),
        }
      );

      const result = await response.json();
      
      if (result.logs) {
        setGenerationLogs(result.logs);
      }
      
      if (!response.ok) throw new Error(result.error || "Generation failed");
      return result;
    },
    onSuccess: (data) => {
      toast.success(`Extended version generated for "${data.songTitle}"`);
      queryClient.invalidateQueries({ queryKey: ["admin-chart-top-songs"] });
    },
    onError: (error: Error) => {
      setGenerationLogs(prev => [...prev, `ERROR: ${error.message}`]);
      toast.error(`Generation failed: ${error.message}`);
    },
  });

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Crown className="h-3 w-3 mr-1" />
          #1
        </Badge>
      );
    }
    if (rank <= 3) {
      return (
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
          <Star className="h-3 w-3 mr-1" />
          #{rank}
        </Badge>
      );
    }
    return <Badge variant="outline">#{rank}</Badge>;
  };

  const openGenerateDialog = (chartSong: ChartSong) => {
    setSelectedSong(chartSong);
    setGenerationLogs([]);
    setDialogOpen(true);
  };

  const handleGenerateExtended = () => {
    if (!selectedSong) return;
    generateExtendedMutation.mutate(selectedSong.song_id);
  };

  const topTenCount = chartSongs?.length || 0;
  const numberOnes = chartSongs?.filter(s => s.rank === 1).length || 0;
  const withExtended = chartSongs?.filter(s => s.song.extended_audio_url).length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Chart Top 10 Songs
            </CardTitle>
            <CardDescription>
              Songs currently in the top 10 of any chart. Generate extended versions for #1 songs.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{topTenCount}</div>
            <div className="text-xs text-muted-foreground">In Top 10</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10">
            <div className="text-2xl font-bold text-yellow-500">{numberOnes}</div>
            <div className="text-xs text-muted-foreground">#1 Positions</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-500">{withExtended}</div>
            <div className="text-xs text-muted-foreground">Extended Generated</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : chartSongs?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No songs currently in top 10 of any chart</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Song</TableHead>
                  <TableHead>Band</TableHead>
                  <TableHead>Chart</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Audio</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartSongs?.map((chartSong) => (
                  <TableRow key={chartSong.id} className={chartSong.rank === 1 ? "bg-yellow-500/5" : ""}>
                    <TableCell>{getRankBadge(chartSong.rank)}</TableCell>
                    <TableCell className="font-medium">{chartSong.song.title}</TableCell>
                    <TableCell>{chartSong.song.bands?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {chartSong.chart_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(chartSong.trend)}
                        {chartSong.weeks_on_chart && (
                          <span className="text-xs text-muted-foreground">
                            {chartSong.weeks_on_chart}w
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {chartSong.song.audio_url && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                            <Volume2 className="h-3 w-3 mr-1" />
                            Standard
                          </Badge>
                        )}
                        {chartSong.song.extended_audio_url && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Extended
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={chartSong.rank === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => openGenerateDialog(chartSong)}
                        disabled={!!chartSong.song.extended_audio_url}
                      >
                        {chartSong.song.extended_audio_url ? (
                          "Generated"
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            {chartSong.rank === 1 ? "Generate Extended" : "Generate"}
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Generation Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedSong?.rank === 1 && <Crown className="h-5 w-5 text-yellow-500" />}
                Generate Extended Version
              </DialogTitle>
              <DialogDescription>
                Create a 5-minute full version of "{selectedSong?.song.title}" for streaming release
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Chart Position:</span>{" "}
                  <span className="font-medium">#{selectedSong?.rank} ({selectedSong?.chart_type})</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Band:</span>{" "}
                  <span className="font-medium">{selectedSong?.song.bands?.name || "Unknown"}</span>
                </div>
              </div>

              {selectedSong?.song.audio_url && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground mb-2">Current standard audio:</p>
                  <audio controls className="w-full h-10" src={selectedSong.song.audio_url}>
                    Your browser does not support audio.
                  </audio>
                </div>
              )}

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-yellow-400 mb-1">Extended Version Features:</p>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  <li>• 5-minute full-length version (vs 3-4 min standard)</li>
                  <li>• 256kbps bitrate for streaming quality</li>
                  <li>• Full lyrics included (not truncated)</li>
                  <li>• Weekly #1 songs eligible for Rockmundo release</li>
                </ul>
              </div>

              {/* Generation Logs */}
              {generationLogs.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {generateExtendedMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    Generation Log
                  </Label>
                  <div className="rounded-lg bg-black/90 p-3 font-mono text-xs max-h-60 overflow-y-auto">
                    {generationLogs.map((log, index) => (
                      <div 
                        key={index} 
                        className={`py-0.5 ${
                          log.includes('ERROR') 
                            ? 'text-red-400' 
                            : log.includes('SUCCESS') 
                            ? 'text-green-400' 
                            : 'text-green-300'
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                    {generateExtendedMutation.isPending && (
                      <div className="py-0.5 text-yellow-400 animate-pulse">
                        ▌ Generating extended audio (may take 2-4 minutes)...
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerateExtended}
                  disabled={generateExtendedMutation.isPending}
                >
                  {generateExtendedMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Generate Extended (5 min)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
