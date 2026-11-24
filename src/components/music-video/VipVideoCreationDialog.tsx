import { useRef, useState } from "react";
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
import { Sparkles, Film, Palette, Camera, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  normalizeMusicVideoBrief,
  VIDEO_THEMES,
  VIDEO_ART_STYLES,
  VIDEO_MOODS,
  VIDEO_CAMERA_MOVEMENTS,
  VIDEO_LIGHTING,
  VIDEO_PALETTES,
  VIDEO_MOTION,
} from "../../../supabase/functions/_shared/musicVideoPrompt";

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
  const creatingRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);

  // Form state
  const [selectedSong, setSelectedSong] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [visualTheme, setVisualTheme] = useState("cinematic");
  const [artStyle, setArtStyle] = useState("realistic");
  const [mood, setMood] = useState("auto");
  const [shotConcept, setShotConcept] = useState("");
  const [cameraMovement, setCameraMovement] = useState("auto");
  const [lighting, setLighting] = useState("auto");
  const [colourPalette, setColourPalette] = useState("auto");
  const [subjectMotion, setSubjectMotion] = useState("auto");

  const resetForm = () => {
    setSelectedSong("");
    setVideoTitle("");
    setMode("basic");
    setVisualTheme("cinematic");
    setArtStyle("realistic");
    setMood("auto");
    setShotConcept("");
    setCameraMovement("auto");
    setLighting("auto");
    setColourPalette("auto");
    setSubjectMotion("auto");
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

    if (profileCash < VIP_VIDEO_COST) {
      toast({
        title: "Insufficient Funds",
        description: `AI video generation costs $${VIP_VIDEO_COST.toLocaleString()}. You have $${profileCash.toLocaleString()}.`,
        variant: "destructive",
      });
      return;
    }

    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsCreating(true);

    try {
      const creativeBrief = normalizeMusicVideoBrief({
        visual_theme: visualTheme,
        ...(mode === "advanced" ? {
          art_style: artStyle,
          mood,
          shot_concept: shotConcept,
          camera_movement: cameraMovement,
          lighting,
          colour_palette: colourPalette,
          subject_motion: subjectMotion,
        } : {}),
      });

      // Charge, song ownership, VIP status, video creation and the unique
      // paid reservation are ONE atomic, character-scoped SQL transaction.
      // Retry an ambiguous network response using the SAME request ID.
      const requestId = requestIdRef.current ?? crypto.randomUUID();
      requestIdRef.current = requestId;
      const { data: reservation, error: reserveError } = await (supabase as any)
        .rpc("reserve_music_video_generation", {
          p_song_id: selectedSong,
          p_title: videoTitle,
          p_description: creativeBrief,
          p_request_id: requestId,
        });
      if (reserveError) throw reserveError;
      if (typeof reservation?.video_id !== "string") {
        throw new Error("Payment reservation could not be confirmed.");
      }
      // From this point the reserved video is durable. Do not reserve a
      // second charge if provider startup or the response fails later.
      requestIdRef.current = null;
      if (reservation.state === "reserved") {
        const { error: genError } = await supabase.functions.invoke("generate-music-video", {
          body: { videoId: reservation.video_id },
        });
        if (genError) {
          toast({
            title: "Video reservation saved",
            description: "Generation could not be confirmed. A failed or unstarted job is refunded automatically; check your video list before starting another.",
            variant: "destructive",
          });
          queryClient.invalidateQueries({ queryKey: ["music-videos"] });
          queryClient.invalidateQueries({ queryKey: ["game-data"] });
          resetForm();
          setOpen(false);
          onVideoCreated?.();
          return;
        }
      } else {
        toast({
          title: "Existing generation found",
          description: "This generation is already underway or finished. No additional charge was taken.",
        });
        queryClient.invalidateQueries({ queryKey: ["music-videos"] });
        queryClient.invalidateQueries({ queryKey: ["game-data"] });
        resetForm();
        setOpen(false);
        onVideoCreated?.();
        return;
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
      creatingRef.current = false;
    }
  };

  const selectedTheme = VIDEO_THEMES.find((t) => t.value === visualTheme);

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
            Create a short AI-generated visual clip for your song. Cost: ${VIP_VIDEO_COST.toLocaleString()} in-game cash.
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
              maxLength={160}
            />
          </div>

          <div className="space-y-3">
            <Label>Creation Mode</Label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="AI video creation mode">
              <Button type="button" variant={mode === "basic" ? "default" : "outline"}
                aria-pressed={mode === "basic"} onClick={() => setMode("basic")}>Basic Video</Button>
              <Button type="button" variant={mode === "advanced" ? "default" : "outline"}
                aria-pressed={mode === "advanced"} onClick={() => setMode("advanced")}>Advanced Video</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "basic" ? "Pick a look and we'll direct the shot for you." : "Describe one continuous shot and give the AI more visual direction. Results can vary."}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Film className="h-3 w-3" /> Visual Theme</Label>
            <Select value={visualTheme} onValueChange={setVisualTheme}>
              <SelectTrigger aria-label="Visual Theme"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VIDEO_THEMES.map((theme) => (
                  <SelectItem key={theme.value} value={theme.value}>{theme.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTheme && <p className="text-xs text-muted-foreground">{selectedTheme.description}</p>}
          </div>

          {mode === "advanced" && (
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4" aria-label="Advanced video direction">
              <div className="space-y-2">
                <Label htmlFor="video-shot-concept">Main Shot / Action (optional)</Label>
                <Textarea id="video-shot-concept" value={shotConcept} onChange={(e) => setShotConcept(e.target.value)}
                  maxLength={240} rows={3}
                  placeholder={selectedTheme?.concept ?? "Describe the main subject and what happens in one shot"} />
                <p className="text-xs text-muted-foreground">One shot only; leave blank for an automatic scene based on your theme.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Palette className="h-3 w-3" /> Art Style</Label>
                  <Select value={artStyle} onValueChange={setArtStyle}>
                    <SelectTrigger aria-label="Art Style"><SelectValue /></SelectTrigger>
                    <SelectContent>{VIDEO_ART_STYLES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mood</Label>
                  <Select value={mood} onValueChange={setMood}>
                    <SelectTrigger aria-label="Mood"><SelectValue /></SelectTrigger>
                    <SelectContent>{VIDEO_MOODS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Camera className="h-3 w-3" /> Camera Movement</Label>
                  <Select value={cameraMovement} onValueChange={setCameraMovement}>
                    <SelectTrigger aria-label="Camera Movement"><SelectValue /></SelectTrigger>
                    <SelectContent>{VIDEO_CAMERA_MOVEMENTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lighting</Label>
                  <Select value={lighting} onValueChange={setLighting}>
                    <SelectTrigger aria-label="Lighting"><SelectValue /></SelectTrigger>
                    <SelectContent>{VIDEO_LIGHTING.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Colour Palette</Label>
                  <Select value={colourPalette} onValueChange={setColourPalette}>
                    <SelectTrigger aria-label="Colour Palette"><SelectValue /></SelectTrigger>
                    <SelectContent>{VIDEO_PALETTES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject Motion</Label>
                  <Select value={subjectMotion} onValueChange={setSubjectMotion}>
                    <SelectTrigger aria-label="Subject Motion"><SelectValue /></SelectTrigger>
                    <SelectContent>{VIDEO_MOTION.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Cost Summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">AI Video Generation</p>
                  <p className="text-sm text-muted-foreground">
                    One short visual clip. This does not create a full-song edit or sync the song audio.
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
                profileCash < VIP_VIDEO_COST
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
