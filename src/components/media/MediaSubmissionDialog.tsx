import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Newspaper, BookOpen, Podcast, Globe, Star, Users, DollarSign, TrendingUp, Send, Loader2 } from "lucide-react";

export type MediaType = "newspaper" | "magazine" | "podcast" | "website";

interface MediaSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaType: MediaType;
  mediaItem: {
    id: string;
    name: string;
    min_fame_required?: number | null;
    genres?: string[] | null;
    fame_boost_min?: number | null;
    fame_boost_max?: number | null;
    fan_boost_min?: number | null;
    fan_boost_max?: number | null;
    compensation_min?: number | null;
    compensation_max?: number | null;
  };
  bandId: string;
  bandFame: number;
}

const mediaConfig = {
  newspaper: {
    icon: Newspaper,
    title: "Request Interview",
    table: "newspaper_submissions",
    idField: "newspaper_id",
    typeField: "interview_type",
    types: [
      { value: "short_feature", label: "Short Feature", description: "Brief mention or news piece" },
      { value: "full_interview", label: "Full Interview", description: "In-depth Q&A session" },
      { value: "cover_story", label: "Cover Story", description: "Major feature with cover placement" },
    ],
  },
  magazine: {
    icon: BookOpen,
    title: "Apply for Feature",
    table: "magazine_submissions",
    idField: "magazine_id",
    typeField: "feature_type",
    types: [
      { value: "profile", label: "Artist Profile", description: "Quick profile piece" },
      { value: "interview", label: "Interview Feature", description: "Extended interview" },
      { value: "cover_feature", label: "Cover Feature", description: "Cover story and photoshoot" },
    ],
  },
  podcast: {
    icon: Podcast,
    title: "Request Guest Appearance",
    table: "podcast_submissions",
    idField: "podcast_id",
    typeField: "episode_topic",
    types: [
      { value: "career_journey", label: "Career Journey", description: "Discuss your music career" },
      { value: "new_release", label: "New Release", description: "Promote your latest work" },
      { value: "industry_insights", label: "Industry Insights", description: "Share music industry knowledge" },
    ],
  },
  website: {
    icon: Globe,
    title: "Request Feature",
    table: "website_submissions",
    idField: "website_id",
    typeField: "pitch_message",
    types: [
      { value: "artist_spotlight", label: "Artist Spotlight", description: "Featured artist profile" },
      { value: "new_release", label: "New Release Coverage", description: "Promote your latest release" },
      { value: "interview", label: "Interview", description: "Q&A interview feature" },
    ],
  },
};

export function MediaSubmissionDialog({
  open,
  onOpenChange,
  mediaType,
  mediaItem,
  bandId,
  bandFame,
}: MediaSubmissionDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const config = mediaConfig[mediaType];
  const Icon = config.icon;
  const [selectedType, setSelectedType] = useState(config.types[0].value);

  const isEligible = !mediaItem.min_fame_required || bandFame >= mediaItem.min_fame_required;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user || !bandId) throw new Error("Not authenticated");
      
      const submission: Record<string, unknown> = {
        user_id: user.id,
        band_id: bandId,
        [config.idField]: mediaItem.id,
        [config.typeField]: selectedType,
        status: "pending",
      };

      const { error } = await supabase
        .from(config.table as "newspaper_submissions" | "magazine_submissions" | "podcast_submissions" | "website_submissions")
        .insert(submission as never);

      if (error) {
        if (error.code === "23505") {
          throw new Error("You already have a pending submission to this outlet");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Submission sent!", {
        description: `Your request has been sent to ${mediaItem.name}`,
      });
      queryClient.invalidateQueries({ queryKey: [`${mediaType}-submissions`] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Submission failed", { description: error.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            Submit your request to {mediaItem.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Eligibility Check */}
          {!isEligible && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive flex items-center gap-2">
                <Star className="h-4 w-4" />
                Requires {mediaItem.min_fame_required} fame (you have {bandFame})
              </p>
            </div>
          )}

          {/* Media Info */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <h4 className="font-medium">{mediaItem.name}</h4>
            
            {mediaItem.genres && mediaItem.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {mediaItem.genres.slice(0, 4).map((genre) => (
                  <Badge key={genre} variant="secondary" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-sm">
              {mediaItem.fame_boost_min != null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>+{mediaItem.fame_boost_min}-{mediaItem.fame_boost_max} fame</span>
                </div>
              )}
              {mediaItem.fan_boost_min != null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>+{mediaItem.fan_boost_min}-{mediaItem.fan_boost_max} fans</span>
                </div>
              )}
              {mediaItem.compensation_min != null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  <span>${mediaItem.compensation_min}-{mediaItem.compensation_max}</span>
                </div>
              )}
            </div>
          </div>

          {/* Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.types.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <span className="font-medium">{type.label}</span>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!isEligible || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
