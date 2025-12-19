import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Music, Star, Send, AlertCircle } from "lucide-react";

interface SubmitDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  bandId?: string | null;
  preselectedLabelId?: string | null;
}

interface RecordedSong {
  id: string;
  title: string;
  genre: string;
  quality_score: number;
  status: string;
}

interface LabelOption {
  id: string;
  name: string;
  genre_focus: string[] | null;
  reputation_score: number;
}

export function SubmitDemoDialog({ open, onOpenChange, userId, bandId, preselectedLabelId }: SubmitDemoDialogProps) {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(preselectedLabelId ?? null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's profile ID (different from auth user ID)
  const { data: profileData } = useQuery({
    queryKey: ["user-profile-id", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!userId,
  });

  const profileId = profileData?.id;

  // Fetch recorded songs that can be submitted as demos
  const { data: songs = [] } = useQuery<RecordedSong[]>({
    queryKey: ["demo-eligible-songs", userId, bandId],
    queryFn: async () => {
      let query = supabase
        .from("songs")
        .select("id, title, genre, quality_score, status")
        .eq("status", "recorded")
        .order("quality_score", { ascending: false });

      if (bandId) {
        query = query.eq("band_id", bandId);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Fetch available labels
  const { data: labelsData } = useQuery({
    queryKey: ["labels-for-demo"],
    queryFn: async (): Promise<LabelOption[]> => {
      const { data, error } = await supabase
        .from("labels")
        .select("id, name, genre_focus, reputation_score, is_bankrupt")
        .eq("is_bankrupt", false)
        .order("reputation_score", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        genre_focus: l.genre_focus as string[] | null,
        reputation_score: l.reputation_score ?? 0,
      }));
    },
    enabled: open,
  });
  
  const labels = labelsData ?? [];

  // Fetch existing submissions to prevent duplicates
  const { data: existingSubmissions = [] } = useQuery({
    queryKey: ["existing-demo-submissions", bandId, profileId],
    queryFn: async () => {
      let query = supabase
        .from("demo_submissions")
        .select("song_id, label_id, status")
        .in("status", ["pending", "under_review"]);

      if (bandId) {
        query = query.eq("band_id", bandId);
      } else if (profileId) {
        query = query.eq("artist_profile_id", profileId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && (!!bandId || !!profileId),
  });

  const submitDemoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSongId || !selectedLabelId) {
        throw new Error("Please select a song and label");
      }

      if (!bandId && !profileId) {
        throw new Error("Could not find your profile. Please try again.");
      }

      const { error } = await supabase.from("demo_submissions").insert({
        song_id: selectedSongId,
        label_id: selectedLabelId,
        band_id: bandId || null,
        artist_profile_id: bandId ? null : profileId,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Demo submitted!",
        description: "Your demo has been sent to the label for review. They'll respond within a few days.",
      });
      queryClient.invalidateQueries({ queryKey: ["existing-demo-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["demo-submissions"] });
      onOpenChange(false);
      setSelectedSongId(null);
      setSelectedLabelId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit demo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset selections when dialog closes, but respect preselected label
  useEffect(() => {
    if (!open) {
      setSelectedSongId(null);
      setSelectedLabelId(preselectedLabelId ?? null);
    } else if (preselectedLabelId) {
      setSelectedLabelId(preselectedLabelId);
    }
  }, [open, preselectedLabelId]);

  const selectedSong = songs.find((s) => s.id === selectedSongId);
  const selectedLabel = labels.find((l) => l.id === selectedLabelId);

  // Check if this combination already has a pending submission
  const isDuplicateSubmission = existingSubmissions.some(
    (sub) => sub.song_id === selectedSongId && sub.label_id === selectedLabelId
  );

  // Check genre match between song and label
  const isGenreMatch = selectedSong && selectedLabel && 
    selectedLabel.genre_focus?.some(g => g.toLowerCase().includes(selectedSong.genre.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Submit Demo to Record Label
          </DialogTitle>
          <DialogDescription>
            Send your best recorded song to a label. They'll review it and may offer you a contract.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Song Selection */}
          <div className="space-y-2">
            <Label>Select a Recorded Song</Label>
            {songs.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-sm text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No recorded songs available. Record a song first.
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-40 rounded-md border">
                <div className="p-2 space-y-2">
                  {songs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => setSelectedSongId(song.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-md transition-colors ${
                        selectedSongId === song.id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Music className="h-4 w-4 text-muted-foreground" />
                        <div className="text-left">
                          <div className="font-medium">{song.title}</div>
                          <div className="text-xs text-muted-foreground">{song.genre}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        <span className="text-sm">{song.quality_score}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Label Selection */}
          <div className="space-y-2">
            <Label>Select a Label</Label>
            <Select value={selectedLabelId ?? ""} onValueChange={setSelectedLabelId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a record label" />
              </SelectTrigger>
              <SelectContent>
                {labels.map((label) => (
                  <SelectItem key={label.id} value={label.id}>
                    <div className="flex items-center gap-2">
                      <span>{label.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        Rep: {label.reputation_score}
                      </Badge>
                      {label.genre_focus && (
                        <Badge variant="outline" className="text-xs">
                          {label.genre_focus}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Match indicator */}
          {selectedSong && selectedLabel && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Genre compatibility:</span>
                  <Badge variant={isGenreMatch ? "default" : "secondary"}>
                    {isGenreMatch ? "Good match!" : "Different genres"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Labels are more likely to sign artists that match their genre focus, but exceptional 
                  quality can override genre preferences.
                </p>
              </CardContent>
            </Card>
          )}

          {isDuplicateSubmission && (
            <Card className="border-destructive">
              <CardContent className="p-3 text-sm text-destructive">
                You already have a pending submission for this song to this label.
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => submitDemoMutation.mutate()}
            disabled={
              !selectedSongId || 
              !selectedLabelId || 
              isDuplicateSubmission || 
              submitDemoMutation.isPending
            }
          >
            {submitDemoMutation.isPending ? "Submitting..." : "Submit Demo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}