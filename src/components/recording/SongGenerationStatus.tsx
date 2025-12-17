import { AlertCircle, CheckCircle2, Loader2, Music, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

  if (!status) return null;

  // Already completed with audio - show success, no regeneration allowed
  if (isCompleted && hasAudio) {
    return (
      <Alert className="bg-primary/10 border-primary/30">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-primary font-medium">
            ✨ AI audio generated successfully!
          </span>
          <span className="text-xs text-muted-foreground">
            Regeneration not available
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Currently generating
  if (isGenerating && !isTimedOut) {
    const startedAt = status.audio_generation_started_at 
      ? new Date(status.audio_generation_started_at) 
      : new Date();
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    return (
      <Alert className="bg-muted/50 border-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Generating AI audio for "{songTitle}"...
          </span>
          <span className="text-xs text-muted-foreground">
            {minutes}:{seconds.toString().padStart(2, '0')} / 10:00
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Failed or timed out - show retry option
  if (isFailed || isTimedOut) {
    return (
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
    );
  }

  return null;
}
