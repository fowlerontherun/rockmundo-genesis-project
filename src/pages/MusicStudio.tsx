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
  Volume2
} from "lucide-react";

interface Song {
  id: number;
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
}

const MusicStudio = () => {
  const { toast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [newSong, setNewSong] = useState({
    title: "",
    genre: "rock",
    lyrics: ""
  });

  const genres = [
    "rock", "metal", "punk", "indie", "alternative", 
    "blues", "jazz", "electronic", "folk", "pop"
  ];

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      // Simulated API call
      const mockSongs: Song[] = [
        {
          id: 1,
          title: "Midnight Echo",
          genre: "rock",
          duration: 235,
          quality_score: 85,
          recording_cost: 500,
          lyrics: "In the silence of the night...\nEchoes of a distant fight...",
          created_at: "2024-01-15",
          popularity: 72,
          plays: 1247,
          status: "released"
        },
        {
          id: 2,
          title: "Electric Dreams",
          genre: "alternative",
          duration: 198,
          quality_score: 78,
          recording_cost: 400,
          lyrics: "Wires and circuits in my mind...\nDigital love I hope to find...",
          created_at: "2024-01-20",
          popularity: 65,
          plays: 892,
          status: "recorded"
        },
        {
          id: 3,
          title: "Rebel Heart",
          genre: "punk",
          duration: 156,
          quality_score: 71,
          recording_cost: 300,
          lyrics: "Break the chains that hold us down...\nIn this underground...",
          created_at: "2024-01-25",
          popularity: 0,
          plays: 0,
          status: "draft"
        }
      ];
      setSongs(mockSongs);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load songs",
        variant: "destructive"
      });
    }
  };

  const createSong = async () => {
    if (!newSong.title || !newSong.lyrics) {
      toast({
        title: "Error",
        description: "Title and lyrics are required",
        variant: "destructive"
      });
      return;
    }

    try {
      const song: Song = {
        id: Date.now(),
        title: newSong.title,
        genre: newSong.genre,
        duration: Math.floor(120 + Math.random() * 180), // Random duration 2-5 min
        quality_score: Math.floor(60 + Math.random() * 40), // Random quality 60-100
        recording_cost: Math.floor(200 + Math.random() * 500),
        lyrics: newSong.lyrics,
        created_at: new Date().toISOString().split('T')[0],
        popularity: 0,
        plays: 0,
        status: "draft"
      };

      setSongs([...songs, song]);
      setNewSong({ title: "", genre: "rock", lyrics: "" });
      
      toast({
        title: "Success",
        description: "Song created successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create song",
        variant: "destructive"
      });
    }
  };

  const recordSong = async (song: Song) => {
    if (song.status !== 'draft') return;
    
    setIsRecording(true);
    setRecordingProgress(0);
    
    // Simulate recording process
    const interval = setInterval(() => {
      setRecordingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRecording(false);
          
          // Update song status
          setSongs(songs.map(s => 
            s.id === song.id 
              ? { ...s, status: 'recorded' as const }
              : s
          ));
          
          toast({
            title: "Recording Complete",
            description: `"${song.title}" has been recorded successfully`
          });
          
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const releaseSong = async (song: Song) => {
    if (song.status !== 'recorded') return;
    
    try {
      setSongs(songs.map(s => 
        s.id === song.id 
          ? { ...s, status: 'released' as const }
          : s
      ));
      
      toast({
        title: "Song Released",
        description: `"${song.title}" is now available to the public`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release song",
        variant: "destructive"
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'recorded': return 'warning';
      case 'released': return 'success';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Music Studio
          </h1>
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <span className="text-muted-foreground">{songs.length} Songs</span>
          </div>
        </div>

        <Tabs defaultValue="songs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="songs">Song Library</TabsTrigger>
            <TabsTrigger value="create">Create New Song</TabsTrigger>
          </TabsList>

          <TabsContent value="songs" className="space-y-6">
            {/* Recording Progress */}
            {isRecording && (
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <Volume2 className="h-5 w-5 text-accent animate-pulse" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Recording in progress...</span>
                        <span>{recordingProgress}%</span>
                      </div>
                      <Progress value={recordingProgress} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Songs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {songs.map((song) => (
                <Card 
                  key={song.id} 
                  className="bg-card/80 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => setSelectedSong(song)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{song.title}</CardTitle>
                        <CardDescription>{song.genre}</CardDescription>
                      </div>
                      <Badge variant={getStatusColor(song.status) as any} className="capitalize">
                        {song.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(song.duration)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {song.quality_score}%
                      </div>
                    </div>

                    {song.status === 'released' && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          {song.plays.toLocaleString()} plays
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {song.popularity}% popular
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {song.status === 'draft' && (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            recordSong(song);
                          }}
                          disabled={isRecording}
                          className="flex-1 bg-gradient-primary"
                        >
                          <Mic className="h-3 w-3 mr-1" />
                          Record
                        </Button>
                      )}
                      
                      {song.status === 'recorded' && (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            releaseSong(song);
                          }}
                          className="flex-1 bg-gradient-accent"
                        >
                          <Music className="h-3 w-3 mr-1" />
                          Release
                        </Button>
                      )}

                      {song.status === 'released' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 border-success text-success"
                          disabled
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Live
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="create">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Create New Song
                </CardTitle>
                <CardDescription>
                  Write and compose your next hit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Song Title</Label>
                    <Input
                      id="title"
                      value={newSong.title}
                      onChange={(e) => setNewSong({...newSong, title: e.target.value})}
                      placeholder="Enter song title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Genre</Label>
                    <Select value={newSong.genre} onValueChange={(value) => setNewSong({...newSong, genre: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map((genre) => (
                          <SelectItem key={genre} value={genre}>
                            {genre.charAt(0).toUpperCase() + genre.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lyrics">Lyrics</Label>
                  <Textarea
                    id="lyrics"
                    value={newSong.lyrics}
                    onChange={(e) => setNewSong({...newSong, lyrics: e.target.value})}
                    placeholder="Write your lyrics here..."
                    rows={8}
                  />
                </div>

                <Button 
                  onClick={createSong}
                  disabled={!newSong.title || !newSong.lyrics}
                  className="w-full bg-gradient-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Song
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Song Details Modal */}
        {selectedSong && (
          <Card className="fixed inset-4 z-50 bg-card/95 backdrop-blur-sm border-primary/20 overflow-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{selectedSong.title}</CardTitle>
                  <CardDescription className="text-lg">{selectedSong.genre}</CardDescription>
                </div>
                <Button 
                  onClick={() => setSelectedSong(null)}
                  variant="ghost"
                  size="sm"
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">{formatDuration(selectedSong.duration)}</div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-accent">{selectedSong.quality_score}%</div>
                  <div className="text-sm text-muted-foreground">Quality</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-success">${selectedSong.recording_cost}</div>
                  <div className="text-sm text-muted-foreground">Recording Cost</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">{selectedSong.plays.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Plays</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Lyrics</h3>
                <div className="bg-secondary/30 p-4 rounded-lg whitespace-pre-line text-sm">
                  {selectedSong.lyrics}
                </div>
              </div>

              {selectedSong.status === 'released' && (
                <div>
                  <h3 className="font-semibold mb-2">Performance</h3>
                  <Progress value={selectedSong.popularity} className="h-2" />
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>Popularity</span>
                    <span>{selectedSong.popularity}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MusicStudio;