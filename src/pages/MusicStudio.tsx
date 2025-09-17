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
  Save,
  Upload,
  AlertCircle,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { 
  calculateTrainingCost, 
  getSkillCap, 
  isOnCooldown, 
  getRemainingCooldown,
  COOLDOWNS 
} from "@/utils/gameBalance";

interface Song {
  id: string;
  title: string;
  genre: string;
  duration: number;
  quality_score: number;
  recording_cost: number;
  mix_quality?: number | null;
  master_quality?: number | null;
  production_cost?: number;
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
  const [activeProcess, setActiveProcess] = useState<'recording' | 'mixing' | 'mastering' | null>(null);
  const [processProgress, setProcessProgress] = useState(0);
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
        status: item.status as 'draft' | 'recorded' | 'released',
        mix_quality: item.mix_quality ?? null,
        master_quality: item.master_quality ?? null,
        production_cost: item.production_cost ?? 0
      })));
    } catch (error) {
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

  const calculateMixingCost = (song: Song) => {
    return Math.max(200, Math.round(song.recording_cost * 0.6));
  };

  const calculateMasteringCost = (song: Song) => {
    return Math.max(150, Math.round(song.recording_cost * 0.4));
  };

  const calculateMixQualityBoost = () => {
    if (!skills) return 4;

    const relevantSkills = [
      skills.guitar,
      skills.bass,
      skills.drums
    ];

    const averageSkill = relevantSkills.reduce((sum, skill) => sum + skill, 0) / relevantSkills.length;
    const randomFactor = Math.random() * 6 - 3;

    return Math.max(1, Math.round(averageSkill / 10 + randomFactor));
  };

  const calculateMasterQualityBoost = () => {
    if (!skills) return 3;

    const relevantSkills = [
      skills.performance,
      skills.vocals,
      skills.songwriting
    ];

    const averageSkill = relevantSkills.reduce((sum, skill) => sum + skill, 0) / relevantSkills.length;
    const randomFactor = Math.random() * 6 - 2;

    return Math.max(1, Math.round(averageSkill / 8 + randomFactor));
  };

  const getFinalQuality = (song: Song) => song.master_quality ?? song.mix_quality ?? song.quality_score;

  const getProductionStage = (song: Song): 'draft' | 'recorded' | 'mixed' | 'mastered' | 'released' => {
    if (song.status === 'released') return 'released';
    if (song.status === 'draft') return 'draft';
    if (song.master_quality) return 'mastered';
    if (song.mix_quality) return 'mixed';
    return 'recorded';
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
          production_cost: 0,
          artist_id: user.id,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      setSongs(prev => [{
        ...data,
        status: data.status as 'draft' | 'recorded' | 'released',
        mix_quality: data.mix_quality ?? null,
        master_quality: data.master_quality ?? null,
        production_cost: data.production_cost ?? 0
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
    } catch (error) {
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

  const startStudioProcess = (
    song: Song,
    stage: 'recording' | 'mixing' | 'mastering',
    onComplete: () => void
  ) => {
    setActiveProcess(stage);
    setProcessProgress(0);
    setSelectedSong(song);

    const interval = setInterval(() => {
      setProcessProgress(prev => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(interval);
          onComplete();
          return 100;
        }
        return next;
      });
    }, 100);
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

    if (activeProcess) {
      toast({
        variant: "destructive",
        title: "Studio busy",
        description: "Please wait for the current session to finish"
      });
      return;
    }

    startStudioProcess(song, 'recording', () => {
      void finishRecording(song);
    });
  };

  const finishRecording = async (song: Song) => {
    if (!user || !profile) return;

    try {
      // Deduct recording cost
      await updateProfile({ cash: profile.cash - song.recording_cost });

      // Update song status and potentially improve quality based on skills
      const skillBonus = Math.round((skills?.performance || 0) / 10);
      const newQuality = Math.min(100, song.quality_score + skillBonus);
      const newProductionCost = (song.production_cost ?? 0) + song.recording_cost;

      const { error } = await supabase
        .from('songs')
        .update({
          status: 'recorded',
          quality_score: newQuality,
          production_cost: newProductionCost,
          mix_quality: null,
          master_quality: null
        })
        .eq('id', song.id);

      if (error) throw error;

      // Update local state
      setSongs(prev => prev.map(s =>
        s.id === song.id
          ? {
              ...s,
              status: 'recorded' as const,
              quality_score: newQuality,
              production_cost: newProductionCost,
              mix_quality: null,
              master_quality: null
            }
          : s
      ));

      await addActivity('creative', `Recorded "${song.title}"`, -song.recording_cost);

      toast({
        title: "Recording complete!",
        description: `"${song.title}" has been professionally recorded`,
      });
    } catch (error) {
      console.error('Error recording song:', error);
      toast({
        variant: "destructive",
        title: "Recording failed",
        description: "Failed to complete recording",
      });
    } finally {
      setActiveProcess(null);
      setProcessProgress(0);
      setSelectedSong(null);
    }
  };

  const finishMixing = async (song: Song, mixCost: number) => {
    if (!user || !profile) return;

    try {
      await updateProfile({ cash: profile.cash - mixCost });

      const baseQuality = song.mix_quality ?? song.quality_score;
      const mixBoost = calculateMixQualityBoost();
      const newMixQuality = Math.min(100, baseQuality + mixBoost);
      const newProductionCost = (song.production_cost ?? 0) + mixCost;

      const { error } = await supabase
        .from('songs')
        .update({
          mix_quality: newMixQuality,
          production_cost: newProductionCost
        })
        .eq('id', song.id);

      if (error) throw error;

      setSongs(prev => prev.map(s =>
        s.id === song.id
          ? { ...s, mix_quality: newMixQuality, production_cost: newProductionCost }
          : s
      ));

      await addActivity('creative', `Mixed "${song.title}"`, -mixCost);

      toast({
        title: "Mixing complete!",
        description: `"${song.title}" is polished and ready for mastering`,
      });
    } catch (error) {
      console.error('Error mixing song:', error);
      toast({
        variant: "destructive",
        title: "Mixing failed",
        description: "Failed to complete mixing session",
      });
    } finally {
      setActiveProcess(null);
      setProcessProgress(0);
      setSelectedSong(null);
    }
  };

  const mixSong = async (song: Song) => {
    if (!user || !profile) return;

    if (song.status === 'draft') {
      toast({
        variant: "destructive",
        title: "Recording required",
        description: "Record the song before moving to mixing",
      });
      return;
    }

    if (song.mix_quality) {
      toast({
        variant: "destructive",
        title: "Already mixed",
        description: "This song has already been mixed",
      });
      return;
    }

    const mixCost = calculateMixingCost(song);

    if (profile.cash < mixCost) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `Mixing costs $${mixCost} but you only have $${profile.cash}`,
      });
      return;
    }

    if (activeProcess) {
      toast({
        variant: "destructive",
        title: "Studio busy",
        description: "Please wait for the current session to finish",
      });
      return;
    }

    startStudioProcess(song, 'mixing', () => {
      void finishMixing(song, mixCost);
    });
  };

  const finishMastering = async (song: Song, masterCost: number) => {
    if (!user || !profile) return;

    try {
      await updateProfile({ cash: profile.cash - masterCost });

      const baseQuality = song.master_quality ?? song.mix_quality ?? song.quality_score;
      const masterBoost = calculateMasterQualityBoost();
      const newMasterQuality = Math.min(100, baseQuality + masterBoost);
      const newProductionCost = (song.production_cost ?? 0) + masterCost;

      const { error } = await supabase
        .from('songs')
        .update({
          master_quality: newMasterQuality,
          production_cost: newProductionCost
        })
        .eq('id', song.id);

      if (error) throw error;

      setSongs(prev => prev.map(s =>
        s.id === song.id
          ? { ...s, master_quality: newMasterQuality, production_cost: newProductionCost }
          : s
      ));

      await addActivity('creative', `Mastered "${song.title}"`, -masterCost);

      toast({
        title: "Mastering complete!",
        description: `"${song.title}" is ready for release`,
      });
    } catch (error) {
      console.error('Error mastering song:', error);
      toast({
        variant: "destructive",
        title: "Mastering failed",
        description: "Failed to complete mastering session",
      });
    } finally {
      setActiveProcess(null);
      setProcessProgress(0);
      setSelectedSong(null);
    }
  };

  const masterSong = async (song: Song) => {
    if (!user || !profile) return;

    if (!song.mix_quality) {
      toast({
        variant: "destructive",
        title: "Mixing required",
        description: "Complete mixing before mastering",
      });
      return;
    }

    if (song.master_quality) {
      toast({
        variant: "destructive",
        title: "Already mastered",
        description: "This song has already been mastered",
      });
      return;
    }

    const masterCost = calculateMasteringCost(song);

    if (profile.cash < masterCost) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `Mastering costs $${masterCost} but you only have $${profile.cash}`,
      });
      return;
    }

    if (activeProcess) {
      toast({
        variant: "destructive",
        title: "Studio busy",
        description: "Please wait for the current session to finish",
      });
      return;
    }

    startStudioProcess(song, 'mastering', () => {
      void finishMastering(song, masterCost);
    });
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

    if (!song.master_quality) {
      toast({
        variant: "destructive",
        title: "Mastering required",
        description: "Complete mastering before releasing the song",
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
      const finalQuality = getFinalQuality(song);
      const fameGain = Math.round(finalQuality / 5);
      await updateProfile({ fame: (profile?.fame || 0) + fameGain });

      await addActivity('release', `Released "${song.title}" to the world`, 0);

      toast({
        title: "Song released!",
        description: `"${song.title}" is now available to fans (+${fameGain} fame)`,
      });
    } catch (error) {
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
      case 'mixed': return 'bg-indigo-500 text-white';
      case 'mastered': return 'bg-amber-500 text-white';
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
                  {songs.map((song) => {
                    const stageStatus = getProductionStage(song);
                    const finalQuality = getFinalQuality(song);
                    const mixCost = calculateMixingCost(song);
                    const masterCost = calculateMasteringCost(song);
                    const productionCost = song.production_cost ?? 0;
                    const isProcessingSong = activeProcess && selectedSong?.id === song.id;
                    const isRecordingInProgress = Boolean(isProcessingSong && activeProcess === 'recording');
                    const isMixingInProgress = Boolean(isProcessingSong && activeProcess === 'mixing');
                    const isMasteringInProgress = Boolean(isProcessingSong && activeProcess === 'mastering');
                    const recordingComplete = song.status !== 'draft';
                    const mixingComplete = Boolean(song.mix_quality) || song.status === 'released';
                    const masteringComplete = Boolean(song.master_quality) || song.status === 'released';
                    const releaseComplete = song.status === 'released';
                    const releaseReady = song.status === 'recorded' && Boolean(song.master_quality);

                    return (
                      <Card key={song.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{song.title}</CardTitle>
                              <CardDescription>{song.genre} • {formatDuration(song.duration)}</CardDescription>
                            </div>
                            <Badge className={getStatusColor(stageStatus)} variant="outline">
                              {stageStatus.charAt(0).toUpperCase() + stageStatus.slice(1)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Final Quality</span>
                            <span className={`font-bold ${getQualityColor(finalQuality)}`}>
                              {finalQuality}/100
                            </span>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span>Total Production Cost</span>
                            <span className="font-bold">${productionCost.toLocaleString()}</span>
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                              Production Pipeline
                            </div>
                            <div className="space-y-2">
                              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border ${recordingComplete ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-muted/30'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`rounded-full p-2 ${recordingComplete ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    <Mic className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Recording Session</p>
                                    <p className="text-xs text-muted-foreground">Capture the best take in the studio</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 justify-end">
                                  {isRecordingInProgress ? (
                                    <Badge className="bg-primary text-primary-foreground text-xs">In progress</Badge>
                                  ) : recordingComplete ? (
                                    <Badge variant="outline" className="text-xs font-semibold">
                                      Quality: {song.quality_score}/100
                                    </Badge>
                                  ) : (
                                    <>
                                      <span className="text-sm text-muted-foreground">Cost: ${song.recording_cost.toLocaleString()}</span>
                                      <Button
                                        onClick={() => recordSong(song)}
                                        disabled={Boolean(activeProcess) || (profile?.cash || 0) < song.recording_cost}
                                        size="sm"
                                        className="gap-2"
                                      >
                                        <Mic className="h-4 w-4" />
                                        Record
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border ${mixingComplete ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-border/50 bg-muted/30'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`rounded-full p-2 ${mixingComplete ? 'bg-indigo-500/20 text-indigo-500' : 'bg-muted text-muted-foreground'}`}>
                                    <SlidersHorizontal className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Mixing</p>
                                    <p className="text-xs text-muted-foreground">Balance every element for clarity</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 justify-end">
                                  {isMixingInProgress ? (
                                    <Badge className="bg-indigo-500 text-white text-xs">In progress</Badge>
                                  ) : mixingComplete ? (
                                    <Badge variant="outline" className="text-xs font-semibold">
                                      Mix Quality: {(song.mix_quality ?? song.quality_score)}/100
                                    </Badge>
                                  ) : song.status === 'draft' ? (
                                    <span className="text-xs text-muted-foreground">Record the song to unlock mixing</span>
                                  ) : (
                                    <>
                                      <span className="text-sm text-muted-foreground">Cost: ${mixCost.toLocaleString()}</span>
                                      <Button
                                        onClick={() => mixSong(song)}
                                        disabled={Boolean(activeProcess) || (profile?.cash || 0) < mixCost}
                                        size="sm"
                                        className="gap-2"
                                      >
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Mix
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border ${masteringComplete ? 'border-amber-500/40 bg-amber-500/10' : 'border-border/50 bg-muted/30'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`rounded-full p-2 ${masteringComplete ? 'bg-amber-500/20 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                                    <Sparkles className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Mastering</p>
                                    <p className="text-xs text-muted-foreground">Give the track its final shine</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 justify-end">
                                  {isMasteringInProgress ? (
                                    <Badge className="bg-amber-500 text-white text-xs">In progress</Badge>
                                  ) : masteringComplete ? (
                                    <Badge variant="outline" className="text-xs font-semibold">
                                      Master Quality: {(song.master_quality ?? song.mix_quality ?? song.quality_score)}/100
                                    </Badge>
                                  ) : !song.mix_quality ? (
                                    <span className="text-xs text-muted-foreground">Mix the song to unlock mastering</span>
                                  ) : (
                                    <>
                                      <span className="text-sm text-muted-foreground">Cost: ${masterCost.toLocaleString()}</span>
                                      <Button
                                        onClick={() => masterSong(song)}
                                        disabled={Boolean(activeProcess) || (profile?.cash || 0) < masterCost}
                                        size="sm"
                                        className="gap-2"
                                      >
                                        <Sparkles className="h-4 w-4" />
                                        Master
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border ${releaseComplete ? 'border-success/40 bg-success/10' : 'border-border/50 bg-muted/30'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`rounded-full p-2 ${releaseComplete ? 'bg-success/20 text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    <Upload className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Release</p>
                                    <p className="text-xs text-muted-foreground">Share your finished track with the world</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 justify-end">
                                  {releaseComplete ? (
                                    <Badge className="bg-success text-success-foreground text-xs">Live</Badge>
                                  ) : releaseReady ? (
                                    <Button
                                      onClick={() => releaseSong(song)}
                                      disabled={Boolean(activeProcess)}
                                      size="sm"
                                      className="gap-2 bg-gradient-primary text-primary-foreground"
                                    >
                                      <Upload className="h-4 w-4" />
                                      Release
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Master the track to enable release</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {song.status === 'released' && (
                            <div className="space-y-2 rounded-lg bg-secondary/20 p-3">
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
                    );
                  })}
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
                {activeProcess && selectedSong ? (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold">
                        {activeProcess === 'recording'
                          ? 'Recording'
                          : activeProcess === 'mixing'
                          ? 'Mixing'
                          : 'Mastering'}: {selectedSong.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {activeProcess === 'recording'
                          ? 'Capturing your performance in the booth...'
                          : activeProcess === 'mixing'
                          ? 'Balancing levels and adding polish...'
                          : 'Giving the track its final shine...'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{processProgress}%</span>
                      </div>
                      <Progress value={processProgress} className="h-3" />
                    </div>

                    <div className="flex justify-center">
                      <div className="animate-pulse">
                        {activeProcess === 'recording' && <Mic className="h-12 w-12 text-primary" />}
                        {activeProcess === 'mixing' && <SlidersHorizontal className="h-12 w-12 text-primary" />}
                        {activeProcess === 'mastering' && <Sparkles className="h-12 w-12 text-primary" />}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <Headphones className="h-16 w-16 text-muted-foreground mx-auto" />
                    <h3 className="text-xl font-semibold">Studio Ready</h3>
                    <p className="text-muted-foreground">
                      Choose a song to record, mix, or master in the production pipeline
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