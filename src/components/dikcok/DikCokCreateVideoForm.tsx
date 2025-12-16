import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Video, Music, Sparkles, Loader2, Clock, Star } from "lucide-react";
import { useDikCokVideoTypes } from "@/hooks/useDikCokVideoTypes";
import { useAuth } from "@/hooks/use-auth-context";

interface DikCokCreateVideoFormProps {
  bandId: string;
  bandSongs?: { id: string; title: string }[];
  onSuccess?: () => void;
}

export const DikCokCreateVideoForm = ({ bandId, bandSongs = [], onSuccess }: DikCokCreateVideoFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { videoTypes, isLoading: typesLoading } = useDikCokVideoTypes();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    videoTypeId: "",
    trackId: "",
    trendingTag: "",
  });

  const selectedType = videoTypes?.find(t => t.id === formData.videoTypeId);

  const createVideoMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!formData.videoTypeId) throw new Error("Please select a video type");
      
      // Simulate video creation with outcome calculation
      const baseViews = Math.floor(Math.random() * 5000) + 500;
      const hypeGain = Math.floor(baseViews / 100);
      const fanGain = Math.floor(baseViews / 200);
      
      const velocities = ["Niche", "Stable", "Trending", "Exploding"];
      const velocity = velocities[Math.floor(Math.random() * velocities.length)];

      const { error } = await supabase.from("dikcok_videos").insert({
        band_id: bandId,
        creator_user_id: user.id,
        video_type_id: formData.videoTypeId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        track_id: formData.trackId || null,
        trending_tag: formData.trendingTag.trim() || null,
        views: baseViews,
        hype_gained: hypeGain,
        fan_gain: fanGain,
        engagement_velocity: velocity,
      });

      if (error) throw error;
      return { views: baseViews, hypeGain, fanGain, velocity };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-videos"] });
      toast({
        title: "Video Posted! 🎬",
        description: `${data.views.toLocaleString()} views, +${data.hypeGain} hype, +${data.fanGain} fans!`,
      });
      setFormData({ title: "", description: "", videoTypeId: "", trackId: "", trendingTag: "" });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Failed to post video", description: error.message, variant: "destructive" });
    },
  });

  const isValid = formData.title.trim().length > 0 && formData.videoTypeId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Create New Video
        </CardTitle>
        <CardDescription>Share your band's content and grow your fanbase</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Video Title *</Label>
          <Input
            placeholder="Epic guitar solo challenge"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            placeholder="Tell viewers what this video is about..."
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Video Type *</Label>
            <Select
              value={formData.videoTypeId}
              onValueChange={(v) => setFormData(prev => ({ ...prev, videoTypeId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {typesLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  videoTypes?.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <span>{type.name}</span>
                        <Badge variant="outline" className="text-xs">{type.difficulty}</Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Featured Song</Label>
            <Select
              value={formData.trackId}
              onValueChange={(v) => setFormData(prev => ({ ...prev, trackId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {bandSongs.map(song => (
                  <SelectItem key={song.id} value={song.id}>
                    <div className="flex items-center gap-2">
                      <Music className="h-3 w-3" />
                      {song.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Trending Tag</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">#</span>
            <Input
              placeholder="summerjam"
              value={formData.trendingTag}
              onChange={(e) => setFormData(prev => ({ ...prev, trendingTag: e.target.value.replace(/[^a-zA-Z0-9]/g, "") }))}
              maxLength={30}
            />
          </div>
        </div>

        {/* Video Type Preview */}
        {selectedType && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedType.name}</span>
              <Badge>{selectedType.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selectedType.description}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {selectedType.difficulty}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {selectedType.duration_hint}
              </span>
            </div>
            {selectedType.signature_effects && selectedType.signature_effects.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedType.signature_effects.map((effect, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {effect}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={() => createVideoMutation.mutate()}
          disabled={!isValid || createVideoMutation.isPending}
          className="w-full"
        >
          {createVideoMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
          ) : (
            <><Video className="h-4 w-4 mr-2" /> Post Video</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
