import { useState } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useSongwritingData } from "@/hooks/useSongwritingData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Music, FileText, Clock, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MUSIC_GENRES } from "@/data/genres";
import { Switch } from "@/components/ui/switch";

export default function SongwritingPage() {
  const { user } = useAuth();
  const { 
    projects, 
    isLoadingProjects, 
    createProject, 
    updateProject,
    startSession,
    completeSession,
    songThemes,
    chordProgressions,
  } = useSongwritingData(user?.id);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [selectedChordProgressionId, setSelectedChordProgressionId] = useState<string>("");
  const [initialLyrics, setInitialLyrics] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [useAILyrics, setUseAILyrics] = useState(false);
  const [coWriters, setCoWriters] = useState<string>("0");
  const [sessionMusicians, setSessionMusicians] = useState<string>("0");

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;

    await createProject.mutateAsync({
      title: newProjectTitle,
      theme_id: selectedThemeId || null,
      chord_progression_id: selectedChordProgressionId || null,
      initial_lyrics: initialLyrics || null,
      genres: selectedGenre ? [selectedGenre] : null,
      creative_brief: {
        mood: selectedMood || null,
        useAILyrics,
        coWriters: parseInt(coWriters) || 0,
        sessionMusicians: parseInt(sessionMusicians) || 0,
      },
    });

    setIsCreateDialogOpen(false);
    setNewProjectTitle("");
    setSelectedThemeId("");
    setSelectedChordProgressionId("");
    setInitialLyrics("");
    setSelectedGenre("");
    setSelectedMood("");
    setUseAILyrics(false);
    setCoWriters("0");
    setSessionMusicians("0");
  };

  const handleUpdateLyrics = async (lyrics: string) => {
    if (!selectedProjectId) return;
    await updateProject.mutateAsync({
      id: selectedProjectId,
      lyrics,
    });
  };

  const handleStartSession = async () => {
    if (!selectedProjectId) return;
    await startSession.mutateAsync({ projectId: selectedProjectId });
  };

  const handleCompleteSession = async () => {
    if (!selectedProject?.songwriting_sessions?.[0]) return;
    const sessionId = selectedProject.songwriting_sessions[0].id;
    await completeSession.mutateAsync({ sessionId });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'writing': return 'default';
      case 'completed': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <FileText className="h-4 w-4" />;
      case 'writing': return <Music className="h-4 w-4" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoadingProjects) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Songwriting Studio</h1>
          <p className="text-muted-foreground">Create and manage your songwriting projects</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Start a new songwriting project
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="My New Song"
                />
              </div>
              
              <div>
                <Label htmlFor="genre">Genre</Label>
                <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                  <SelectTrigger id="genre">
                    <SelectValue placeholder="Select a genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSIC_GENRES.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mood">Mood Palette (Optional)</Label>
                <Select value={selectedMood} onValueChange={setSelectedMood}>
                  <SelectTrigger id="mood">
                    <SelectValue placeholder="Select a mood" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upbeat">Upbeat</SelectItem>
                    <SelectItem value="melancholic">Melancholic</SelectItem>
                    <SelectItem value="energetic">Energetic</SelectItem>
                    <SelectItem value="calm">Calm</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="romantic">Romantic</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                    <SelectItem value="introspective">Introspective</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="theme">Theme (Optional)</Label>
                <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {songThemes?.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        {theme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="chords">Chord Progression (Optional)</Label>
                <Select value={selectedChordProgressionId} onValueChange={setSelectedChordProgressionId}>
                  <SelectTrigger id="chords">
                    <SelectValue placeholder="Select chord progression" />
                  </SelectTrigger>
                  <SelectContent>
                    {chordProgressions?.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.name} - {cp.progression}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ai-lyrics">Use AI for Lyrics</Label>
                  <p className="text-xs text-muted-foreground">
                    Generate lyrics with AI assistance
                  </p>
                </div>
                <Switch
                  id="ai-lyrics"
                  checked={useAILyrics}
                  onCheckedChange={setUseAILyrics}
                />
              </div>

              <div>
                <Label htmlFor="cowriters">Co-Writers</Label>
                <Input
                  id="cowriters"
                  type="number"
                  min="0"
                  max="5"
                  value={coWriters}
                  onChange={(e) => setCoWriters(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Collaborate with other songwriters (0-5)
                </p>
              </div>

              <div>
                <Label htmlFor="musicians">Session Musicians</Label>
                <Input
                  id="musicians"
                  type="number"
                  min="0"
                  max="10"
                  value={sessionMusicians}
                  onChange={(e) => setSessionMusicians(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Hire session musicians for recording (0-10)
                </p>
              </div>

              <div>
                <Label htmlFor="lyrics">Initial Lyrics (Optional)</Label>
                <Textarea
                  id="lyrics"
                  value={initialLyrics}
                  onChange={(e) => setInitialLyrics(e.target.value)}
                  placeholder="Start with some lyrics..."
                  rows={4}
                />
              </div>

              <Button onClick={handleCreateProject} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Your songwriting projects</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {projects?.map((project) => (
                    <Card
                      key={project.id}
                      className={`cursor-pointer transition-colors hover:bg-muted ${
                        selectedProjectId === project.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold truncate">{project.title}</h3>
                            {project.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusColor(project.status)}>
                              {getStatusIcon(project.status)}
                              <span className="ml-1">{project.status}</span>
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {selectedProject ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedProject.title}</CardTitle>
                      <CardDescription>
                        {selectedProject.song_themes?.name && `Theme: ${selectedProject.song_themes.name}`}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusColor(selectedProject.status)}>
                      {selectedProject.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Music Progress</span>
                      <span>{Math.round((selectedProject.music_progress / 2000) * 100)}%</span>
                    </div>
                    <Progress value={(selectedProject.music_progress / 2000) * 100} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Lyrics Progress</span>
                      <span>{Math.round((selectedProject.lyrics_progress / 2000) * 100)}%</span>
                    </div>
                    <Progress value={(selectedProject.lyrics_progress / 2000) * 100} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Sessions:</span>
                      <span className="ml-2 font-semibold">
                        {selectedProject.sessions_completed}/{selectedProject.total_sessions}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Quality:</span>
                      <span className="ml-2 font-semibold">{selectedProject.quality_score}</span>
                    </div>
                  </div>
                  {!selectedProject.is_locked ? (
                    <Button onClick={handleStartSession} className="w-full">
                      <Clock className="mr-2 h-4 w-4" />
                      Start Session
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button onClick={handleCompleteSession} className="w-full">
                        Complete Session
                      </Button>
                      {selectedProject.locked_until && (
                        <p className="text-xs text-muted-foreground text-center">
                          Session ends {formatDistanceToNow(new Date(selectedProject.locked_until), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lyrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={selectedProject.lyrics || selectedProject.initial_lyrics || ""}
                    onChange={(e) => handleUpdateLyrics(e.target.value)}
                    placeholder="Write your lyrics here..."
                    rows={20}
                    className="font-mono"
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center p-12">
                <div className="text-center text-muted-foreground">
                  <Music className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Select a project to get started</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
