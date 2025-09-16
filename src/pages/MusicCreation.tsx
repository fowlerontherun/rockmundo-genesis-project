import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Music, Play, Trash2, Star, Coins, Volume2, Pencil } from "lucide-react";

interface Song {
  id: string;
  title: string;
  genre: string;
  lyrics: string;
  status: string;
  quality_score: number;
  recording_cost: number;
  popularity: number;
  plays: number;
  duration: number;
  created_at: string;
}

interface PlayerSkills {
  guitar: number;
  vocals: number;
  drums: number;
  bass: number;
  performance: number;
  songwriting: number;
}

const MusicCreation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editSongForm, setEditSongForm] = useState({
    title: "",
    genre: "",
    lyrics: "",
    duration: 180
  });
  const [updatingSong, setUpdatingSong] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);

  const [newSong, setNewSong] = useState({
    title: "",
    genre: "",
    lyrics: "",
    duration: 180
  });

  const genres = [
    "Rock", "Pop", "Hip Hop", "Electronic", "Jazz", "Blues", "Country", 
    "Metal", "Punk", "Alternative", "Indie", "Classical", "Folk", "R&B"
  ];

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [songsResponse, skillsResponse, profileResponse] = await Promise.all([
        supabase.from("songs").select("*").eq("artist_id", user?.id).order("created_at", { ascending: false }),
        supabase.from("player_skills").select("*").eq("user_id", user?.id).single(),
        supabase.from("profiles").select("*").eq("user_id", user?.id).single()
      ]);

      if (songsResponse.data) setSongs(songsResponse.data);
      if (skillsResponse.data) setSkills(skillsResponse.data);
      if (profileResponse.data) setProfile(profileResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (song: Song) => {
    setEditingSong(song);
    setEditSongForm({
      title: song.title,
      genre: song.genre,
      lyrics: song.lyrics ?? "",
      duration: song.duration
    });
    setIsEditDialogOpen(true);
  };

  const calculateQuality = (): number => {
    if (!skills) return 30;
    
    const baseQuality = (skills.songwriting * 0.4 + skills.guitar * 0.2 + skills.vocals * 0.2 + 
                        skills.performance * 0.1 + skills.drums * 0.05 + skills.bass * 0.05);
    
    // Add randomness and ensure it's between 1-100
    const randomFactor = Math.random() * 20 - 10; // -10 to +10
    return Math.max(1, Math.min(100, Math.round(baseQuality + randomFactor)));
  };

  const calculateRecordingCost = (quality: number): number => {
    const baseCost = 500;
    const qualityMultiplier = quality / 50; // Higher quality = higher cost
    return Math.round(baseCost * qualityMultiplier);
  };

  const createSong = async () => {
    if (!newSong.title || !newSong.genre) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a title and genre for your song."
      });
      return;
    }

    setCreating(true);

    try {
      const quality = calculateQuality();
      const recordingCost = calculateRecordingCost(quality);

      const { data, error } = await supabase
        .from("songs")
        .insert({
          title: newSong.title,
          genre: newSong.genre,
          lyrics: newSong.lyrics,
          duration: newSong.duration,
          artist_id: user?.id,
          quality_score: quality,
          recording_cost: recordingCost,
          status: "draft"
        })
        .select()
        .single();

      if (error) throw error;

      // Add XP for songwriting
      const xpGain = Math.round(quality / 10);
      await supabase
        .from("player_skills")
        .update({
          songwriting: Math.min(100, (skills?.songwriting || 0) + xpGain)
        })
        .eq("user_id", user?.id);

      // Add activity
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "songwriting",
          message: `Created new song: "${newSong.title}" (Quality: ${quality}%)`,
          earnings: 0
        });

      setSongs(prev => [data, ...prev]);
      setNewSong({ title: "", genre: "", lyrics: "", duration: 180 });

      await fetchData();

      toast({
        title: "Song Created!",
        description: `"${newSong.title}" was created with ${quality}% quality. +${xpGain} Songwriting XP!`
      });

    } catch (error) {
      console.error("Error creating song:", error);
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: "Failed to create song. Please try again."
      });
    } finally {
      setCreating(false);
    }
  };

  const recordSong = async (song: Song) => {
    if ((profile?.cash || 0) < song.recording_cost) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `You need $${song.recording_cost} to record this song.`
      });
      return;
    }

    setRecording(true);

    try {
      // Update song status and profile cash
      const [songUpdate, profileUpdate] = await Promise.all([
        supabase
          .from("songs")
          .update({ status: "recorded", release_date: new Date().toISOString() })
          .eq("id", song.id),
        supabase
          .from("profiles")
          .update({ cash: (profile?.cash || 0) - song.recording_cost })
          .eq("user_id", user?.id)
      ]);

      if (songUpdate.error) throw songUpdate.error;
      if (profileUpdate.error) throw profileUpdate.error;

      // Add recording XP to multiple skills
      const performanceXP = Math.round(song.quality_score / 15);
      const vocalXP = Math.round(song.quality_score / 20);
      
      await supabase
        .from("player_skills")
        .update({
          performance: Math.min(100, (skills?.performance || 0) + performanceXP),
          vocals: Math.min(100, (skills?.vocals || 0) + vocalXP)
        })
        .eq("user_id", user?.id);

      // Add activity
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "recording",
          message: `Recorded "${song.title}" in the studio`,
          earnings: -song.recording_cost
        });

      // Update local state
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, status: "recorded" } : s));
      setProfile(prev => prev ? { ...prev, cash: prev.cash - song.recording_cost } : null);

      await fetchData();

      toast({
        title: "Recording Complete!",
        description: `"${song.title}" has been recorded and is ready for release!`
      });

    } catch (error) {
      console.error("Error recording song:", error);
      toast({
        variant: "destructive",
        title: "Recording Failed",
        description: "Failed to record song. Please try again."
      });
    } finally {
      setRecording(false);
    }
  };

  const updateSong = async () => {
    if (!editingSong) return;
    if (!editSongForm.title || !editSongForm.genre) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a title and genre for your song."
      });
      return;
    }

    setUpdatingSong(true);

    try {
      const { error } = await supabase
        .from("songs")
        .update({
          title: editSongForm.title,
          genre: editSongForm.genre,
          lyrics: editSongForm.lyrics || null,
          duration: editSongForm.duration
        })
        .eq("id", editingSong.id);

      if (error) throw error;

      await fetchData();

      toast({
        title: "Song Updated",
        description: `"${editSongForm.title}" has been updated.`
      });

      setIsEditDialogOpen(false);
      setEditingSong(null);
      setEditSongForm({ title: "", genre: "", lyrics: "", duration: 180 });
    } catch (error) {
      console.error("Error updating song:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update song. Please try again."
      });
    } finally {
      setUpdatingSong(false);
    }
  };

  const deleteSong = async (songId: string) => {
    setDeletingSongId(songId);

    try {
      const { error } = await supabase
        .from("songs")
        .delete()
        .eq("id", songId);

      if (error) throw error;

      setSongs(prev => prev.filter(s => s.id !== songId));

      if (editingSong?.id === songId) {
        setIsEditDialogOpen(false);
        setEditingSong(null);
        setEditSongForm({ title: "", genre: "", lyrics: "", duration: 180 });
      }

      await fetchData();

      toast({
        title: "Song Deleted",
        description: "The song has been removed from your catalog."
      });

    } catch (error) {
      console.error("Error deleting song:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Failed to delete song. Please try again."
      });
    } finally {
      setDeletingSongId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-yellow-500";
      case "recorded": return "bg-green-500";
      case "released": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return "text-purple-400";
    if (quality >= 60) return "text-blue-400";
    if (quality >= 40) return "text-green-400";
    if (quality >= 20) return "text-yellow-400";
    return "text-red-400";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading music studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bebas tracking-wider">MUSIC STUDIO</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Create, record, and manage your musical masterpieces
        </p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-oswald">${profile?.cash?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-blue-400" />
            <span className="font-oswald">{songs.length} Songs</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create New Song</TabsTrigger>
          <TabsTrigger value="catalog">Song Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-bebas text-2xl">NEW SONG CREATION</CardTitle>
              <CardDescription>
                Channel your creativity and write your next hit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Song Title</label>
                  <Input
                    placeholder="Enter song title..."
                    value={newSong.title}
                    onChange={(e) => setNewSong(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Genre</label>
                  <Select value={newSong.genre} onValueChange={(value) => setNewSong(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lyrics (Optional)</label>
                <Textarea
                  placeholder="Write your lyrics here..."
                  value={newSong.lyrics}
                  onChange={(e) => setNewSong(prev => ({ ...prev, lyrics: e.target.value }))}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (seconds)</label>
                <Input
                  type="number"
                  min="30"
                  max="600"
                  value={newSong.duration}
                  onChange={(e) => setNewSong(prev => ({ ...prev, duration: parseInt(e.target.value) || 180 }))}
                />
              </div>

              {skills && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Estimated Quality: {calculateQuality()}%</h4>
                  <p className="text-sm text-muted-foreground">
                    Based on your songwriting skill ({skills.songwriting}/100) and other musical abilities
                  </p>
                </div>
              )}

              <Button 
                onClick={createSong}
                disabled={creating || !newSong.title || !newSong.genre}
                className="w-full"
              >
                {creating ? "Creating..." : "Create Song"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          {songs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Songs Yet</h3>
                <p className="text-muted-foreground">Create your first song to get started!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {songs.map((song) => (
                <Card key={song.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="font-oswald text-lg">{song.title}</CardTitle>
                        <CardDescription>{song.genre} • {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</CardDescription>
                      </div>
                      <Badge className={`${getStatusColor(song.status)} text-white capitalize`}>
                        {song.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span>Quality</span>
                        <span className={`font-mono ${getQualityColor(song.quality_score)}`}>
                          {song.quality_score}%
                        </span>
                      </div>
                      <Progress value={song.quality_score} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3 text-blue-400" />
                        <span>{song.plays.toLocaleString()} plays</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400" />
                        <span>{song.popularity} popularity</span>
                      </div>
                    </div>

                    {song.lyrics && (
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-20 overflow-y-auto">
                        {song.lyrics}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {song.status === "draft" && (
                        <Button
                          onClick={() => recordSong(song)}
                          disabled={recording || (profile?.cash || 0) < song.recording_cost}
                          className="flex-1"
                          variant="default"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Record (${song.recording_cost})
                        </Button>
                      )}

                      <Button
                        onClick={() => openEditDialog(song)}
                        variant="outline"
                        size="sm"
                        disabled={updatingSong && editingSong?.id === song.id}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteSong(song.id)}
                        variant="destructive"
                        size="sm"
                        disabled={deletingSongId === song.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {deletingSongId === song.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingSong(null);
            setEditSongForm({ title: "", genre: "", lyrics: "", duration: 180 });
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await updateSong();
            }}
            className="space-y-6"
          >
            <DialogHeader>
              <DialogTitle>Edit Song</DialogTitle>
              <DialogDescription>
                Make changes to your song details and keep your catalog up to date.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Song Title</label>
                <Input
                  value={editSongForm.title}
                  onChange={(e) => setEditSongForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter song title..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Genre</label>
                <Select
                  value={editSongForm.genre}
                  onValueChange={(value) => setEditSongForm(prev => ({ ...prev, genre: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map(genre => (
                      <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Lyrics (Optional)</label>
              <Textarea
                value={editSongForm.lyrics}
                onChange={(e) => setEditSongForm(prev => ({ ...prev, lyrics: e.target.value }))}
                rows={6}
                placeholder="Update your lyrics here..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (seconds)</label>
              <Input
                type="number"
                min="30"
                max="600"
                value={editSongForm.duration}
                onChange={(e) => setEditSongForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 180 }))}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={updatingSong}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updatingSong || !editSongForm.title || !editSongForm.genre}
              >
                {updatingSong ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MusicCreation;