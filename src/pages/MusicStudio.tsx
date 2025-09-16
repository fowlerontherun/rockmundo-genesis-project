import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Music, 
  Mic, 
  Guitar, 
  Headphones, 
  Play, 
  Pause, 
  Plus,
  Clock,
  TrendingUp,
  Star,
  Volume2,
  Save,
  Upload,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";

interface Song {
  id: string;
  title: string;
  genre: string;
  duration: number;
  quality_score: number;
  recording_cost: number;
  lyrics: string;
  created_at: string;
  popularity: number;
  plays: number;
  status: 'draft' | 'recorded' | 'released';
  artist_id: string;
  band_id?: string;
}

const MusicStudio = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, skills, updateProfile, addActivity } = useGameData();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const [newSong, setNewSong] = useState({
    title: "",
    genre: "rock",
    lyrics: ""
  });

  const genres = [
    "rock", "pop", "jazz", "blues", "electronic", "folk", "hip-hop", 
    "classical", "reggae", "country", "metal", "alternative", "indie"
  ];

  useEffect(() => {
    if (user) {
      loadSongs();
    }
  }, [user]);

  const loadSongs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSongs((data || []).map(item => ({
        ...item,
        status: item.status as 'draft' | 'recorded' | 'released'
      })));
    } catch (error: any) {
      console.error('Error loading songs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load your songs",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSongQuality = () => {
    if (!skills) return 50;
    
    const relevantSkills = [
      skills.songwriting,
      skills.vocals,
      skills.guitar,
      skills.performance
    ];
    
    const averageSkill = relevantSkills.reduce((sum, skill) => sum + skill, 0) / relevantSkills.length;
    const randomFactor = Math.random() * 20 - 10; // -10 to +10
    
    return Math.max(10, Math.min(100, Math.round(averageSkill + randomFactor)));
  };

  const calculateRecordingCost = (genre: string, duration: number) => {
    const baseCost = 500;
    const genreMultiplier = genre === 'classical' ? 1.5 : genre === 'electronic' ? 1.2 : 1.0;
    const durationMultiplier = duration / 180; // base 3 minutes
    
    return Math.round(baseCost * genreMultiplier * durationMultiplier);
  };

  const createSong = async () => {
    if (!user || !newSong.title.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please enter a song title",
      });
      return;
    }

    setCreating(true);

    try {
      const duration = 120 + Math.random() * 180; // 2-5 minutes
      const quality = calculateSongQuality();
      const cost = calculateRecordingCost(newSong.genre, duration);

      const { data, error } = await supabase
        .from('songs')
        .insert({
          title: newSong.title,
          genre: newSong.genre,
          lyrics: newSong.lyrics,
          duration: Math.round(duration),
          quality_score: quality,
          recording_cost: cost,
          artist_id: user.id,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      setSongs(prev => [{
        ...data,
        status: data.status as 'draft' | 'recorded' | 'released'
      }, ...prev]);
      setNewSong({ title: "", genre: "rock", lyrics: "" });
      
      // Add experience for songwriting
      const expGain = Math.round(quality / 2);
      await supabase
        .from('profiles')
        .update({ 
          experience: (profile?.experience || 0) + expGain 
        })
        .eq('user_id', user.id);

      await addActivity('creative', `Created new song: ${data.title}`, 0);

      toast({
        title: "Song created!",
        description: `"${data.title}" has been added to your catalog (+${expGain} XP)`,
      });
    } catch (error: any) {
      console.error('Error creating song:', error);
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: "Failed to create song",
      });
    } finally {
      setCreating(false);
    }
  };

  const recordSong = async (song: Song) => {
    if (!user || !profile) return;

    if (profile.cash < song.recording_cost) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `Recording costs $${song.recording_cost} but you only have $${profile.cash}`,
      });
      return;
    }

    if (song.status !== 'draft') {
      toast({
        variant: "destructive",
        title: "Already recorded",
        description: "This song has already been recorded",
      });
      return;
    }

    setIsRecording(true);
    setRecordingProgress(0);
    setSelectedSong(song);

    // Simulate recording process
    const recordingInterval = setInterval(() => {
      setRecordingProgress(prev => {
        if (prev >= 100) {
          clearInterval(recordingInterval);
          finishRecording(song);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const finishRecording = async (song: Song) => {
    if (!user || !profile) return;

    try {
      // Deduct recording cost
      await updateProfile({ cash: profile.cash - song.recording_cost });

      // Update song status and potentially improve quality based on skills
      const skillBonus = Math.round((skills?.performance || 0) / 10);
      const newQuality = Math.min(100, song.quality_score + skillBonus);

      const { error } = await supabase
        .from('songs')
        .update({ 
          status: 'recorded',
          quality_score: newQuality
        })
        .eq('id', song.id);

      if (error) throw error;

      // Update local state
      setSongs(prev => prev.map(s => 
        s.id === song.id 
          ? { ...s, status: 'recorded' as const, quality_score: newQuality }
          : s
      ));

      await addActivity('creative', `Recorded "${song.title}"`, -song.recording_cost);

      toast({
        title: "Recording complete!",
        description: `"${song.title}" has been professionally recorded`,
      });
    } catch (error: any) {
      console.error('Error recording song:', error);
      toast({
        variant: "destructive",
        title: "Recording failed",
        description: "Failed to complete recording",
      });
    } finally {
      setIsRecording(false);
      setRecordingProgress(0);
      setSelectedSong(null);
    }
  };

  const releaseSong = async (song: Song) => {
    if (!user) return;

    if (song.status !== 'recorded') {
      toast({
        variant: "destructive",
        title: "Not recorded",
        description: "Song must be recorded before release",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('songs')
        .update({ status: 'released' })
        .eq('id', song.id);

      if (error) throw error;

      // Update local state
      setSongs(prev => prev.map(s => 
        s.id === song.id ? { ...s, status: 'released' as const } : s
      ));

      // Gain fame based on song quality
      const fameGain = Math.round(song.quality_score / 5);
      await updateProfile({ fame: (profile?.fame || 0) + fameGain });

      await addActivity('release', `Released "${song.title}" to the world`, 0);

      toast({
        title: "Song released!",
        description: `"${song.title}" is now available to fans (+${fameGain} fame)`,
      });
    } catch (error: any) {
      console.error('Error releasing song:', error);
      toast({
        variant: "destructive",
        title: "Release failed",
        description: "Failed to release song",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-secondary text-secondary-foreground';
      case 'recorded': return 'bg-primary text-primary-foreground';
      case 'released': return 'bg-success text-success-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return 'text-success';
    if (quality >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading music studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Music Studio
            </h1>
            <p className="text-muted-foreground">Create, record, and release your musical masterpieces</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-primary/20 rounded-lg px-4 py-2">
              <Music className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">{songs.length} Songs</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Create New Song</TabsTrigger>
            <TabsTrigger value="catalog">Song Catalog</TabsTrigger>
            <TabsTrigger value="studio">Recording Studio</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Create New Song
                </CardTitle>
                <CardDescription>
                  Write a new song to add to your catalog
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="song-title">Song Title</Label>
                      <Input
                        id="song-title"
                        placeholder="Enter song title"
                        value={newSong.title}
                        onChange={(e) => setNewSong(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="song-genre">Genre</Label>
                      <Select
                        value={newSong.genre}
                        onValueChange={(value) => setNewSong(prev => ({ ...prev, genre: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {genres.map(genre => (
                            <SelectItem key={genre} value={genre}>
                              {genre.charAt(0).toUpperCase() + genre.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Your Skills Impact</Label>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Songwriting:</span>
                          <span className="font-mono">{skills?.songwriting || 0}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Vocals:</span>
                          <span className="font-mono">{skills?.vocals || 0}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Performance:</span>
                          <span className="font-mono">{skills?.performance || 0}/100</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="song-lyrics">Lyrics</Label>
                    <Textarea
                      id="song-lyrics"
                      placeholder="Write your lyrics here..."
                      className="min-h-[200px]"
                      value={newSong.lyrics}
                      onChange={(e) => setNewSong(prev => ({ ...prev, lyrics: e.target.value }))}
                    />
                  </div>
                </div>

                <Button
                  onClick={createSong}
                  disabled={!newSong.title.trim() || creating}
                  className="w-full bg-gradient-primary hover:shadow-electric"
                >
                  {creating ? (
                    "Creating Song..."
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Create Song
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalog">
            <div className="space-y-4">
              {songs.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Songs Yet</h3>
                    <p className="text-muted-foreground">Create your first song to get started!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {songs.map((song) => (
                    <Card key={song.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{song.title}</CardTitle>
                            <CardDescription>{song.genre} • {formatDuration(song.duration)}</CardDescription>
                          </div>
                          <Badge className={getStatusColor(song.status)} variant="outline">
                            {song.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Quality:</span>
                          <span className={`font-bold ${getQualityColor(song.quality_score)}`}>
                            {song.quality_score}/100
                          </span>
                        </div>

                        {song.status === 'draft' && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Recording Cost:</span>
                              <span className="font-bold">${song.recording_cost}</span>
                            </div>
                            <Button
                              onClick={() => recordSong(song)}
                              disabled={isRecording || (profile?.cash || 0) < song.recording_cost}
                              className="w-full"
                            >
                              <Mic className="h-4 w-4 mr-2" />
                              Record Song
                            </Button>
                          </div>
                        )}

                        {song.status === 'recorded' && (
                          <Button
                            onClick={() => releaseSong(song)}
                            className="w-full bg-gradient-primary"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Release to World
                          </Button>
                        )}

                        {song.status === 'released' && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Plays:</span>
                              <span className="font-bold">{song.plays.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Popularity:</span>
                              <span className="font-bold">{song.popularity}/100</span>
                            </div>
                          </div>
                        )}

                        {song.lyrics && (
                          <details className="mt-4">
                            <summary className="text-sm font-medium cursor-pointer">Lyrics</summary>
                            <div className="mt-2 p-3 bg-secondary/30 rounded text-sm whitespace-pre-wrap">
                              {song.lyrics}
                            </div>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="studio">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-primary" />
                  Recording Studio
                </CardTitle>
                <CardDescription>
                  Professional recording equipment for your songs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isRecording && selectedSong ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-xl font-bold mb-2">Recording: {selectedSong.title}</h3>
                      <p className="text-muted-foreground">Please wait while we record your masterpiece...</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{recordingProgress}%</span>
                      </div>
                      <Progress value={recordingProgress} className="h-3" />
                    </div>

                    <div className="flex justify-center">
                      <div className="animate-pulse">
                        <Volume2 className="h-12 w-12 text-primary" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Mic className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Studio Ready</h3>
                    <p className="text-muted-foreground">
                      Select a draft song from your catalog to begin recording
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MusicStudio;