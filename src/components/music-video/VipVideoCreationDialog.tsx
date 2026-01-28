import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Plus, Trash2, Film, Palette, Camera, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Song {
  id: string;
  title: string;
  genre?: string;
  release_title?: string;
}

interface VipVideoCreationDialogProps {
  songs: Song[];
  isVip: boolean;
  profileCash: number;
  onVideoCreated?: () => void;
}

const VISUAL_THEMES = [
  { value: "cinematic", label: "Cinematic", description: "Film-like quality with dramatic lighting" },
  { value: "neon_cyberpunk", label: "Neon Cyberpunk", description: "Futuristic neon-lit cityscapes" },
  { value: "vintage_retro", label: "Vintage Retro", description: "70s/80s aesthetic with film grain" },
  { value: "nature_ethereal", label: "Nature Ethereal", description: "Dreamy natural landscapes" },
  { value: "urban_gritty", label: "Urban Gritty", description: "Raw street-level city vibes" },
  { value: "abstract_artistic", label: "Abstract Artistic", description: "Surreal, artistic visuals" },
  { value: "performance_stage", label: "Performance Stage", description: "Concert/stage focused" },
  { value: "animated_stylized", label: "Animated Stylized", description: "Animated/cartoon aesthetic" },
];

const ART_STYLES = [
  { value: "realistic", label: "Realistic" },
  { value: "stylized", label: "Stylized" },
  { value: "anime", label: "Anime" },
  { value: "watercolor", label: "Watercolor" },
  { value: "comic_book", label: "Comic Book" },
  { value: "noir", label: "Film Noir" },
  { value: "vaporwave", label: "Vaporwave" },
  { value: "minimalist", label: "Minimalist" },
];

const MOODS = [
  { value: "energetic", label: "Energetic" },
  { value: "melancholic", label: "Melancholic" },
  { value: "romantic", label: "Romantic" },
  { value: "dark", label: "Dark & Moody" },
  { value: "uplifting", label: "Uplifting" },
  { value: "mysterious", label: "Mysterious" },
  { value: "aggressive", label: "Aggressive" },
  { value: "peaceful", label: "Peaceful" },
];

const VIP_VIDEO_COST = 75000; // $75,000 for AI-generated video

export function VipVideoCreationDialog({
  songs,
  isVip,
  profileCash,
  onVideoCreated,
}: VipVideoCreationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [selectedSong, setSelectedSong] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [visualTheme, setVisualTheme] = useState("cinematic");
  const [artStyle, setArtStyle] = useState("realistic");
  const [mood, setMood] = useState("energetic");
  const [sceneDescriptions, setSceneDescriptions] = useState<string[]>([
    "Opening shot: Slow zoom into the scene, establishing the mood",
    "Main verse: Dynamic camera movement following the performer",
    "Chorus: Wide shots with dramatic lighting changes",
  ]);

  const addScene = () => {
    if (sceneDescriptions.length < 8) {
      setSceneDescriptions([...sceneDescriptions, ""]);
    }
  };

  const updateScene = (index: number, value: string) => {
    const updated = [...sceneDescriptions];
    updated[index] = value;
    setSceneDescriptions(updated);
  };

  const removeScene = (index: number) => {
    if (sceneDescriptions.length > 1) {
      setSceneDescriptions(sceneDescriptions.filter((_, i) => i !== index));
    }
  };

  const resetForm = () => {
    setSelectedSong("");
    setVideoTitle("");
    setVisualTheme("cinematic");
    setArtStyle("realistic");
    setMood("energetic");
    setSceneDescriptions([
      "Opening shot: Slow zoom into the scene, establishing the mood",
      "Main verse: Dynamic camera movement following the performer",
      "Chorus: Wide shots with dramatic lighting changes",
    ]);
  };

  const handleCreate = async () => {
    if (!selectedSong || !videoTitle) {
      toast({
        title: "Missing Information",
        description: "Please select a song and enter a video title.",
        variant: "destructive",
      });
      return;
    }

    if (sceneDescriptions.filter((s) => s.trim()).length < 2) {
      toast({
        title: "More Scenes Needed",
        description: "Please add at least 2 scene descriptions for the AI to work with.",
        variant: "destructive",
      });
      return;
    }

    if (profileCash < VIP_VIDEO_COST) {
      toast({
        title: "Insufficient Funds",
        description: `AI video generation costs $${VIP_VIDEO_COST.toLocaleString()}. You have $${profileCash.toLocaleString()}.`,
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const song = songs.find((s) => s.id === selectedSong);

      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Deduct cost first
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("user_id", session.user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      await supabase
        .from("profiles")
        .update({ cash: profile.cash - VIP_VIDEO_COST })
        .eq("id", profile.id);

      // Create the video record
      const { data: video, error: videoError } = await supabase
        .from("music_videos")
        .insert({
          song_id: selectedSong,
          title: videoTitle,
          budget: VIP_VIDEO_COST,
          production_quality: 95, // AI videos are high quality
          status: "planning",
          views_count: 0,
          earnings: 0,
          hype_score: 0,
          description: JSON.stringify({
            visual_theme: visualTheme,
            art_style: artStyle,
            mood,
            scene_descriptions: sceneDescriptions.filter((s) => s.trim()),
            ai_generated: true,
          }),
        })
        .select()
        .single();

      if (videoError) throw videoError;

      // Trigger AI video generation
      const { error: genError } = await supabase.functions.invoke("generate-music-video", {
        body: {
          videoId: video.id,
          songTitle: song?.title || videoTitle,
          songGenre: song?.genre,
          visualTheme,
          artStyle,
          sceneDescriptions: sceneDescriptions.filter((s) => s.trim()),
          mood,
        },
      });

      if (genError) {
        console.error("Video generation error:", genError);
        // Don't fail the whole operation, video is still created
      }

      toast({
        title: "AI Video Generation Started! ✨",
        description: "Your custom music video is being created. Check back soon!",
      });

      queryClient.invalidateQueries({ queryKey: ["music-videos"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      
      resetForm();
      setOpen(false);
      onVideoCreated?.();
    } catch (error) {
      console.error("Error creating video:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create video",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const selectedTheme = VISUAL_THEMES.find((t) => t.value === visualTheme);

  if (!isVip) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/50 bg-primary/10 hover:bg-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>AI Video Generator</span>
          <Badge variant="secondary" className="ml-1">
            VIP
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI Music Video Generator
            <Badge>VIP Exclusive</Badge>
          </DialogTitle>
          <DialogDescription>
            Create a custom AI-generated music video by describing your vision. Cost: ${VIP_VIDEO_COST.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Song Selection */}
          <div className="space-y-2">
            <Label>Select Song *</Label>
            <Select value={selectedSong} onValueChange={setSelectedSong}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a recorded song..." />
              </SelectTrigger>
              <SelectContent>
                {songs.map((song) => (
                  <SelectItem key={song.id} value={song.id}>
                    {song.title} {song.release_title ? `(${song.release_title})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Video Title */}
          <div className="space-y-2">
            <Label>Video Title *</Label>
            <Input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Enter a title for your music video..."
            />
          </div>

          {/* Visual Settings */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Film className="h-3 w-3" /> Visual Theme
              </Label>
              <Select value={visualTheme} onValueChange={setVisualTheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISUAL_THEMES.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTheme && (
                <p className="text-xs text-muted-foreground">{selectedTheme.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Palette className="h-3 w-3" /> Art Style
              </Label>
              <Select value={artStyle} onValueChange={setArtStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ART_STYLES.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Camera className="h-3 w-3" /> Mood
              </Label>
              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scene Descriptions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Scene Descriptions *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addScene}
                disabled={sceneDescriptions.length >= 8}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Add Scene
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Describe each scene or moment in your video. The AI will use these to create your video.
            </p>

            <div className="space-y-3">
              {sceneDescriptions.map((scene, index) => (
                <Card key={index} className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-2 shrink-0">
                        {index + 1}
                      </Badge>
                      <Textarea
                        value={scene}
                        onChange={(e) => updateScene(index, e.target.value)}
                        placeholder={`Describe scene ${index + 1}... (e.g., "Close-up shot of the singer in a rain-soaked alley with neon reflections")`}
                        rows={2}
                        className="flex-1"
                      />
                      {sceneDescriptions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeScene(index)}
                          className="shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Cost Summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">AI Video Generation</p>
                  <p className="text-sm text-muted-foreground">
                    High-quality AI-generated music video based on your vision
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    ${VIP_VIDEO_COST.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Balance: ${profileCash.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                isCreating ||
                !selectedSong ||
                !videoTitle ||
                profileCash < VIP_VIDEO_COST ||
                sceneDescriptions.filter((s) => s.trim()).length < 2
              }
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate AI Video
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
