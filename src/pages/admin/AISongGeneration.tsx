import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Music, 
  Play, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  RefreshCw,
  Wand2,
  Volume2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";

type Song = {
  id: string;
  title: string;
  genre: string | null;
  status: string | null;
  quality_score: number | null;
  audio_url: string | null;
  audio_generation_status: string | null;
  audio_prompt: string | null;
  audio_generated_at: string | null;
  created_at: string | null;
  band_id: string | null;
  bands?: { name: string } | null;
};

export default function AISongGeneration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: songs, isLoading, refetch } = useQuery({
    queryKey: ["admin-songs-for-generation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, status, quality_score, audio_url, audio_generation_status, audio_prompt, audio_generated_at, created_at, band_id, bands(name)")
        .in("status", ["recorded", "released"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Song[];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({ songId, customPrompt }: { songId: string; customPrompt?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-generate-song-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ songId, customPrompt: customPrompt || undefined }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Generation failed");
      return result;
    },
    onSuccess: (data) => {
      toast.success(`Audio generated for "${data.songTitle}"`);
      queryClient.invalidateQueries({ queryKey: ["admin-songs-for-generation"] });
      setDialogOpen(false);
      setSelectedSong(null);
      setCustomPrompt("");
    },
    onError: (error: Error) => {
      toast.error(`Generation failed: ${error.message}`);
    },
  });

  const filteredSongs = songs?.filter((song) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      song.genre?.toLowerCase().includes(query) ||
      song.bands?.name?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "generating":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "pending":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const openGenerateDialog = (song: Song) => {
    setSelectedSong(song);
    setCustomPrompt(song.audio_prompt || "");
    setDialogOpen(true);
  };

  const handleGenerate = () => {
    if (!selectedSong) return;
    generateMutation.mutate({ 
      songId: selectedSong.id, 
      customPrompt: customPrompt.trim() || undefined 
    });
  };

  const stats = {
    total: songs?.length || 0,
    completed: songs?.filter(s => s.audio_generation_status === "completed").length || 0,
    pending: songs?.filter(s => !s.audio_generation_status || s.audio_generation_status === "pending").length || 0,
    failed: songs?.filter(s => s.audio_generation_status === "failed").length || 0,
  };

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wand2 className="h-8 w-8" />
              AI Song Generation
            </h1>
            <p className="text-muted-foreground">
              Test and manage AI-generated audio for songs using Replicate MusicGen
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Songs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search songs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Songs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recorded Songs</CardTitle>
            <CardDescription>
              Select a song to generate AI audio. Only recorded or released songs are shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Band</TableHead>
                      <TableHead>Genre</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Audio Status</TableHead>
                      <TableHead>Generated At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSongs?.map((song) => (
                      <TableRow key={song.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-muted-foreground" />
                            {song.title}
                          </div>
                        </TableCell>
                        <TableCell>{song.bands?.name || "—"}</TableCell>
                        <TableCell>{song.genre || "—"}</TableCell>
                        <TableCell>{song.quality_score || "—"}</TableCell>
                        <TableCell>{getStatusBadge(song.audio_generation_status)}</TableCell>
                        <TableCell>
                          {song.audio_generated_at 
                            ? new Date(song.audio_generated_at).toLocaleDateString()
                            : "—"
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {song.audio_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(song.audio_url!, "_blank")}
                              >
                                <Volume2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openGenerateDialog(song)}
                              disabled={song.audio_generation_status === "generating"}
                            >
                              {song.audio_generation_status === "generating" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  {song.audio_url ? "Regenerate" : "Generate"}
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSongs?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No songs found matching your search
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generate Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Generate AI Audio</DialogTitle>
              <DialogDescription>
                Generate audio for "{selectedSong?.title}" using Replicate MusicGen
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Genre:</span>{" "}
                  <span className="font-medium">{selectedSong?.genre || "Not set"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Quality:</span>{" "}
                  <span className="font-medium">{selectedSong?.quality_score || "Not set"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">Custom Prompt (optional)</Label>
                <Textarea
                  id="prompt"
                  placeholder="Leave empty to auto-generate from song metadata..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  If left empty, a prompt will be generated based on genre, theme, and quality score.
                </p>
              </div>

              {selectedSong?.audio_url && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground mb-2">Current audio:</p>
                  <audio controls className="w-full" src={selectedSong.audio_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerate} 
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Audio
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
}
