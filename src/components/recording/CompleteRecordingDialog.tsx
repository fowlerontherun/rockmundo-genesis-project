import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Music, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useAuth } from "@/hooks/use-auth-context";
import { useSongGenerationLimits } from "@/hooks/useSongGenerationLimits";
import { useSongGenerationStatus } from "@/hooks/useSongGenerationStatus";
import { GenerationLimitBadge } from "./GenerationLimitBadge";
import { SongGenerationStatus } from "./SongGenerationStatus";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MusicOwnershipReminder } from "@/components/legal/MusicOwnershipReminder";

interface CompleteRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  songTitle: string;
  songId?: string;
}

export const CompleteRecordingDialog = ({
  open,
  onOpenChange,
  sessionId,
  songTitle,
  songId: propSongId,
}: CompleteRecordingDialogProps) => {
  const [completing, setCompleting] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [currentSongId, setCurrentSongId] = useState<string | null>(propSongId || null);
  const queryClient = useQueryClient();
  const { data: vipStatus } = useVipStatus();
  const { user } = useAuth();
  const { data: limits } = useSongGenerationLimits();
  const { isCompleted, hasAudio, cannotRegenerate } = useSongGenerationStatus(currentSongId);

  // Fetch song ID if not provided
  useEffect(() => {
    if (!propSongId && sessionId) {
      supabase
        .from('recording_sessions')
        .select('song_id')
        .eq('id', sessionId)
        .single()
        .then(({ data }) => {
          if (data?.song_id) {
            setCurrentSongId(data.song_id);
          }
        });
    }
  }, [propSongId, sessionId]);

  const canGenerateAudio = vipStatus?.isVip && 
    limits?.can_generate && 
    !cannotRegenerate;

  const generateAudio = async (songId: string) => {
    if (!vipStatus?.isVip || !user?.id) return;

    // Check limits
    if (limits && !limits.can_generate && !limits.is_admin) {
      toast.error("Weekly generation limit reached", {
        description: `You've used ${limits.used}/${limits.limit} generations this week.`
      });
      return;
    }

    setGeneratingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-song-audio', {
        body: { songId, userId: user.id }
      });

      if (error) {
        console.error('Audio generation error:', error);
        toast.error("Audio generation failed", {
          description: "Please try again later."
        });
      } else if (data?.error) {
        toast.error(data.error, {
          description: data.details
        });
      } else if (data?.success) {
        toast.success("AI audio generated!", {
          description: data.message || "Your song now has playable audio.",
          icon: <Music className="h-4 w-4" />
        });
        queryClient.invalidateQueries({ queryKey: ["songs"] });
        queryClient.invalidateQueries({ queryKey: ["song-generation-status", songId] });
        queryClient.invalidateQueries({ queryKey: ["song-generation-limits"] });
      }
    } catch (err) {
      console.error('Audio generation failed:', err);
      toast.error("Audio generation failed");
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      // Get session details
      const { data: session, error: sessionError } = await supabase
        .from('recording_sessions')
        .select('song_id')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Update session
      const { error: updateError } = await supabase
        .from("recording_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;

      // Update song status to recorded
      if (session?.song_id) {
        setCurrentSongId(session.song_id);
        
        await supabase
          .from('songs')
          .update({ status: 'recorded' })
          .eq('id', session.song_id);

        // Trigger AI audio generation for VIP users if within limits
        if (canGenerateAudio) {
          generateAudio(session.song_id);
        }
      }

      toast.success("Recording completed!", {
        description: `"${songTitle}" recording session finished successfully.`,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["recording_sessions"] });

      onOpenChange(false);
    } catch (error) {
      console.error("Error completing recording:", error);
      toast.error("Failed to complete recording session");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Complete Recording
          </DialogTitle>
          <DialogDescription>
            Mark the recording session for "{songTitle}" as completed?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Music Ownership Reminder */}
          <MusicOwnershipReminder compact />
          {/* VIP Status and Generation Info */}
          {vipStatus?.isVip ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary font-medium">
                  ✨ VIP: AI audio generation available
                </span>
                <GenerationLimitBadge />
              </div>
              
              {/* Show warning if at limit */}
              {limits && !limits.can_generate && !limits.is_admin && (
                <Alert variant="destructive" className="bg-destructive/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Weekly limit reached. Audio won't be generated automatically.
                  </AlertDescription>
                </Alert>
              )}

              {/* Show warning if song already has audio */}
              {cannotRegenerate && (
                <Alert className="bg-muted">
                  <Music className="h-4 w-4" />
                  <AlertDescription>
                    This song already has AI-generated audio. Regeneration is not available.
                  </AlertDescription>
                </Alert>
              )}

              {/* Show current generation status if song exists */}
              {currentSongId && (
                <SongGenerationStatus 
                  songId={currentSongId} 
                  songTitle={songTitle}
                  showRetry={false}
                />
              )}
            </div>
          ) : (
            <Alert className="bg-muted/50">
              <Music className="h-4 w-4" />
              <AlertDescription>
                VIP subscription required for AI music generation.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={completing}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={completing || generatingAudio}>
            {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Recording
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
