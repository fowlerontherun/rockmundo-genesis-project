import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Music, Plus, Edit, Trash2, Play, Eye } from "lucide-react";

interface Song {
  id: string;
  title: string;
  genre: string;
  lyrics: string | null;
  status: string;
  quality_score: number;
  streams: number;
  chart_position: number | null;
  revenue: number;
  release_date: string | null;
  created_at: string;
  updated_at: string;
}

const GENRES = [
  "Rock", "Pop", "Hip Hop", "Electronic", "Country", "Jazz", "Blues", 
  "Classical", "Folk", "Reggae", "Punk", "Metal", "R&B", "Alternative"
];

const STATUSES = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "in_progress", label: "In Progress", color: "default" },
  { value: "completed", label: "Completed", color: "success" },
  { value: "released", label: "Released", color: "primary" }
];

const Songwriting = () => {
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    genre: "",
    lyrics: "",
    status: "draft"
  });

  useEffect(() => {
    if (user) {
      fetchSongs();
    }
  }, [user]);

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("user_id", user?.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSongs(data || []);
    } catch (error) {
      console.error("Error fetching songs:", error);
      toast.error("Failed to load songs");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (selectedSong) {
        // Update existing song
        const { error } = await supabase
          .from("songs")
          .update({
            title: formData.title,
            genre: formData.genre,
            lyrics: formData.lyrics,
            status: formData.status,
            updated_at: new Date().toISOString()
          })
          .eq("id", selectedSong.id)
          .eq("user_id", user.id);

        if (error) throw error;
        toast.success("Song updated successfully!");
      } else {
        // Create new song
        const { error } = await supabase
          .from("songs")
          .insert({
            user_id: user.id,
            title: formData.title,
            genre: formData.genre,
            lyrics: formData.lyrics,
            status: formData.status,
            quality_score: Math.floor(Math.random() * 50) + 25, // Random initial quality
            streams: 0,
            revenue: 0
          });

        if (error) throw error;
        toast.success("Song created successfully!");
      }

      setIsDialogOpen(false);
      setSelectedSong(null);
      setFormData({ title: "", genre: "", lyrics: "", status: "draft" });
      fetchSongs();
    } catch (error) {
      console.error("Error saving song:", error);
      toast.error("Failed to save song");
    }
  };

  const handleEdit = (song: Song) => {
    setSelectedSong(song);
    setFormData({
      title: song.title,
      genre: song.genre,
      lyrics: song.lyrics || "",
      status: song.status
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (songId: string) => {
    if (!confirm("Are you sure you want to delete this song?")) return;

    try {
      const { error } = await supabase
        .from("songs")
        .delete()
        .eq("id", songId)
        .eq("user_id", user?.id);

      if (error) throw error;
      toast.success("Song deleted successfully!");
      fetchSongs();
    } catch (error) {
      console.error("Error deleting song:", error);
      toast.error("Failed to delete song");
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const statusConfig = STATUSES.find(s => s.value === status);
    return statusConfig?.color || "secondary";
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading songs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Music className="h-8 w-8 text-primary" />
            Songwriting Studio
          </h1>
          <p className="text-muted-foreground mt-2">
            Create, edit, and manage your musical compositions
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setSelectedSong(null);
              setFormData({ title: "", genre: "", lyrics: "", status: "draft" });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              New Song
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedSong ? "Edit Song" : "Create New Song"}
              </DialogTitle>
              <DialogDescription>
                {selectedSong ? "Update your song details" : "Start writing your next hit"}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Song Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter song title"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={formData.genre} onValueChange={(value) => setFormData({ ...formData, genre: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lyrics">Lyrics</Label>
                <Textarea
                  id="lyrics"
                  value={formData.lyrics}
                  onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
                  placeholder="Write your lyrics here..."
                  className="min-h-32"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedSong ? "Update Song" : "Create Song"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {songs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No songs yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start your musical journey by creating your first song
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Song
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {songs.map((song) => (
            <Card key={song.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{song.title}</CardTitle>
                    <CardDescription>{song.genre}</CardDescription>
                  </div>
                  <Badge variant={getStatusBadgeVariant(song.status) as any}>
                    {STATUSES.find(s => s.value === song.status)?.label || song.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Quality:</span>
                    <div className="font-medium">{song.quality_score}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Streams:</span>
                    <div className="font-medium">{song.streams.toLocaleString()}</div>
                  </div>
                </div>

                {song.lyrics && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Preview:</span>
                    <p className="text-xs mt-1 line-clamp-2 text-muted-foreground">
                      {song.lyrics.substring(0, 100)}...
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(song)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(song.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {new Date(song.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Songwriting;