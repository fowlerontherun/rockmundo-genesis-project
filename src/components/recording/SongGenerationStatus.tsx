import { AlertCircle, CheckCircle2, Loader2, Music, RefreshCw, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSongGenerationStatus } from "@/hooks/useSongGenerationStatus";
import { useSongGenerationLimits } from "@/hooks/useSongGenerationLimits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface SongGenerationStatusProps {
  songId: string;
  songTitle: string;
  showRetry?: boolean;
}

export function SongGenerationStatus({ songId, songTitle, showRetry = true }: SongGenerationStatusProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const [showLyricsDialog, setShowLyricsDialog] = useState(false);
  const [editLyrics, setEditLyrics] = useState("");
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  
  const { 
    data: status,
    isGenerating, 
    isCompleted, 
    isFailed, 
    isTimedOut,
    hasAudio, 
    canRegenerate,
    cannotRegenerate,
  } = useSongGenerationStatus(songId);
  
  const { data: limits } = useSongGenerationLimits();

  const handleReset = async () => {
    if (!user?.id) return;
    setRetrying(true);
    try {
      // Reset the stuck status to 'failed' so it can be retried
      const { error } = await supabase
        .from('songs')
        .update({ audio_generation_status: 'failed' })
        .eq('id', songId);

      if (error) {
        console.error('Reset generation status error:', error);
        toast.error("Failed to reset generation status");
      } else {
        toast.success("Generation status reset", {
          description: "You can now retry generating audio."
        });
        queryClient.invalidateQueries({ queryKey: ["song-generation-status", songId] });
      }
    } catch (err) {
      console.error('Reset failed:', err);
      toast.error("Failed to reset generation status");
    } finally {
      setRetrying(false);
    }
  };

  const handleOpenLyricsDialog = async () => {
    setLoadingLyrics(true);
    setShowLyricsDialog(true);
    try {
      const { data } = await supabase
        .from('songs')
        .select('lyrics')
        .eq('id', songId)
        .single();
      setEditLyrics(data?.lyrics || "");
    } catch {
      setEditLyrics("");
    } finally {
      setLoadingLyrics(false);
    }
  };

  const handleAdminRegenerate = async (updatedLyrics?: string) => {
    if (!user?.id || !limits?.is_admin) return;
    setRetrying(true);
    setShowLyricsDialog(false);
    try {
      // Save updated lyrics if provided
      const updatePayload: Record<string, any> = { audio_generation_status: 'failed', audio_url: null };
      if (updatedLyrics !== undefined) {
        updatePayload.lyrics = updatedLyrics;
      }
      await supabase
        .from('songs')
        .update(updatePayload)
        .eq('id', songId);

      const { data, error } = await supabase.functions.invoke('generate-song-audio', {
        body: { songId, userId: user.id }
      });

      if (error) {
        console.error('Admin regenerate error:', error);
        toast.error("Failed to regenerate");
      } else if (data?.success) {
        toast.success("Regeneration started!", {
          description: "Song is being regenerated with MiniMax Music."
        });
        queryClient.invalidateQueries({ queryKey: ["song-generation-status", songId] });
        queryClient.invalidateQueries({ queryKey: ["song-generation-limits"] });
      } else if (data?.error) {
        toast.error(data.error, { description: data.details });
      }
    } catch (err) {
      console.error('Admin regenerate failed:', err);
      toast.error("Failed to regenerate");
    } finally {
      setRetrying(false);
    }
  };

  const handleRetry = async () => {
    if (!user?.id || !canRegenerate) return;

    // Check limits before retrying
    if (limits && !limits.can_generate && !limits.is_admin) {
      toast.error("Weekly limit reached", {
        description: `You've used ${limits.used}/${limits.limit} generations this week.`
      });
      return;
    }

    setRetrying(true);
    try {
      // First reset status to 'failed' to clear stuck state
      const { error: resetError } = await supabase
        .from('songs')
        .update({ audio_generation_status: 'failed' })
        .eq('id', songId);

      if (resetError) {
        console.error('Reset before retry error:', resetError);
      }

      const { data, error } = await supabase.functions.invoke('generate-song-audio', {
        body: { songId, userId: user.id }
      });

      if (error) {
        console.error('Retry generation error:', error);
        toast.error("Failed to retry generation");
      } else if (data?.success) {
        toast.success("Generation started!", {
          description: "Your song is being generated."
        });
        queryClient.invalidateQueries({ queryKey: ["song-generation-status", songId] });
        queryClient.invalidateQueries({ queryKey: ["song-generation-limits"] });
      } else if (data?.error) {
        toast.error(data.error, {
          description: data.details
        });
      }
    } catch (err) {
      console.error('Retry failed:', err);
      toast.error("Failed to retry generation");
    } finally {
      setRetrying(false);
    }
  };

  const lyricsDialog = (
    <Dialog open={showLyricsDialog} onOpenChange={setShowLyricsDialog}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Edit Lyrics Before Regenerating</DialogTitle>
        </DialogHeader>
        {loadingLyrics ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Textarea
            value={editLyrics}
            onChange={(e) => setEditLyrics(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Enter lyrics with [Verse], [Chorus], etc."
          />
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowLyricsDialog(false)}>
            Cancel
          </Button>
          <Button onClick={() => handleAdminRegenerate(editLyrics)} disabled={loadingLyrics}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Save & Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!status) return <>{lyricsDialog}</>;

  // Already completed with audio - show success, admin can regenerate
  if (isCompleted && hasAudio) {
    return (
      <>
        {lyricsDialog}
        <Alert className="bg-primary/10 border-primary/30">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-primary font-medium">
              ✨ AI audio generated successfully!
            </span>
            {limits?.is_admin ? (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleOpenLyricsDialog}
                  disabled={retrying}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit & Regenerate
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleAdminRegenerate()}
                  disabled={retrying}
                >
                  {retrying ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Regenerate
                </Button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                Regeneration not available
              </span>
            )}
          </AlertDescription>
        </Alert>
      </>
    );
  }

  // Currently generating - show reset button if timed out client-side
  if (isGenerating && !isTimedOut) {
    const startedAt = status.audio_generation_started_at 
      ? new Date(status.audio_generation_started_at) 
      : new Date();
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    return (
      <>
        {lyricsDialog}
        <Alert className="bg-muted/50 border-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Generating AI audio for "{songTitle}"...
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {minutes}:{seconds.toString().padStart(2, '0')} / 10:00
              </span>
              {minutes >= 5 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReset}
                  disabled={retrying}
                >
                  {retrying ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  )}
                  Reset
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  // Failed or timed out - show retry option
  if (isFailed || isTimedOut) {
    return (
      <>
        {lyricsDialog}
        <Alert variant="destructive" className="bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {isTimedOut 
                ? "Generation timed out after 10 minutes" 
                : "Audio generation failed"}
            </span>
            {showRetry && canRegenerate && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetry}
                disabled={retrying || (limits && !limits.can_generate && !limits.is_admin)}
              >
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </>
    );
  }

  return <>{lyricsDialog}</>;
}
