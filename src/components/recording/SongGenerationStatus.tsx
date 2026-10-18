import { AlertCircle, CheckCircle2, Loader2, Music, RefreshCw, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSongGenerationStatus } from "@/hooks/useSongGenerationStatus";
import { useSongGenerationLimits } from "@/hooks/useSongGenerationLimits";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface SongGenerationStatusProps {
  songId: string;
  songTitle: string;
  showRetry?: boolean;
}

export function SongGenerationStatus({ songId, songTitle, showRetry = true }: SongGenerationStatusProps) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const retryInFlight = useRef(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [trackedAttemptId, setTrackedAttemptId] = useState<string | null>(null);
  const [showLyricsDialog, setShowLyricsDialog] = useState(false);
  const [editLyrics, setEditLyrics] = useState("");
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  
  const { 
    data: status,
    isError: statusError,
    refetch: retryStatus,
    isGenerating,
    queueState,
    queueAvailableAt,
    isCompleted, 
    isFailed, 
    isTimedOut,
    hasAudio, 
    canRegenerate,
  } = useSongGenerationStatus(songId);
  
  const { data: limits } = useSongGenerationLimits();

  // The song remains marked "completed" when a replacement fails because its
  // old recording is still playable. Follow the new attempt, not just the song
  // status, so users see the actual regeneration outcome.
  const { data: replacementAttempt } = useQuery({
    queryKey: ["song-generation-attempt", songId, trackedAttemptId],
    enabled: !!trackedAttemptId,
    queryFn: async () => {
      const { data, error } = await supabase.from("song_generation_attempts")
        .select("id,status,error_message")
        .eq("id", trackedAttemptId!)
        .eq("song_id", songId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) =>
      query.state.data?.status === "generating" || !query.state.data ? 4000 : false,
  });
  const replacementPending = replacementAttempt?.status === "generating" ||
    (!!trackedAttemptId && !replacementAttempt);

  // Display a useful reason for historical failures without displaying raw
  // provider/internal errors. This remains read-only and scoped to the owner
  // by the song_generation_attempts RLS policy.
  const { data: latestAttempt } = useQuery({
    queryKey: ["song-generation-latest-attempt", songId],
    enabled: !!songId && Boolean(isFailed || isTimedOut),
    queryFn: async () => {
      const { data, error } = await supabase.from("song_generation_attempts")
        .select("status,error_message,started_at")
        .eq("song_id", songId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 10_000,
  });
  const failureReason = latestAttempt?.error_message || "";
  // A short, provider-successful MP3 is kept as a listen-only preview.
  // Only expose a path scoped to this song; it is NOT a valid generated master.
  const previewMatch = failureReason.match(
    /Preview stored: (short-previews\/[a-f0-9-]+\/[a-f0-9-]+\.mp3|repair-previews\/20261018\/[a-f0-9-]+\/[a-f0-9-]+\.mp3)/i
  );
  const shortPreviewPath = previewMatch?.[1]?.includes("/" + songId + "/") ? previewMatch[1] : null;
  const shortPreviewUrl = shortPreviewPath
    ? supabase.storage.from("music").getPublicUrl(shortPreviewPath).data.publicUrl
    : null;
  const failureHint = /throttled|rate.?limit|429/i.test(failureReason)
    ? "The audio provider rate-limited the last request. Avoid repeatedly retrying while provider credit is low."
    : /too short|duration.*outside|duration.*under|60.?90/i.test(failureReason)
    ? "The provider returned an unsuitable length. RockMundo requires at least 60 seconds; review your lyrics before retrying."
    : /SERVICE_ROLE_REQUIRED|permission/i.test(failureReason)
    ? "A server permission error interrupted generation. Contact an administrator before spending credit on another attempt."
    : "A previous attempt failed. Starting another will make a new provider request.";


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
    if (!profileId || !limits?.is_admin) return;
    setRetrying(true);
    setTrackedAttemptId(null);
    setShowLyricsDialog(false);
    try {
      // The admin endpoint validates and saves edited lyrics before submitting
      // generation, ensuring they take priority over any linked project lyrics.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Your session has expired. Please sign in again.");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-generate-song-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ songId, regenerate: true, overrideLyrics: updatedLyrics }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.error) {
        console.error('Admin regenerate error:', data);
        toast.error(data?.error || "Failed to regenerate");
      } else if (data?.success) {
        if (data.attemptId) setTrackedAttemptId(data.attemptId);
        toast.success(data?.queued ? "Song queued" : "Regeneration started!", {
          description: data?.queued ? "Waiting for the next provider slot." : "Song is being regenerated with MiniMax Music."
        });
        queryClient.invalidateQueries({ queryKey: ["song-generation-status", songId] });
        queryClient.invalidateQueries({ queryKey: ["song-generation-limits"] });
      }
    } catch (err) {
      console.error('Admin regenerate failed:', err);
      toast.error("Failed to regenerate");
    } finally {
      setRetrying(false);
    }
  };

  const handleRetry = async (replaceExisting = false) => {
    if (!profileId || !canRegenerate || retryInFlight.current) return;
    setShowReplaceDialog(false);

    // Check limits before retrying
    if (limits && !limits.can_generate && !limits.is_admin) {
      toast.error("Weekly limit reached", {
        description: `You've used ${limits.used}/${limits.limit} generations this week.`
      });
      return;
    }

    retryInFlight.current = true;
    setRetrying(true);
    setTrackedAttemptId(null);
    try {
      // Never erase the existing master before the provider confirms a new job.
      // The authoritative worker decides whether a failed/timed-out job may restart.
      const { data, error } = await supabase.functions.invoke('generate-song-audio', {
        body: { songId, regenerate: replaceExisting }
      });

      if (error) {
        console.error('Retry generation error:', error);
        let message = error.message || "Failed to retry generation";
        if ("context" in error && error.context instanceof Response) {
          try {
            const details = await error.context.clone().json();
            message = details.error || message;
          } catch { /* response did not contain JSON */ }
        }
        toast.error(message);
      } else if (data?.success) {
        if (data.attemptId) setTrackedAttemptId(data.attemptId);
        toast.success(data?.queued ? "Song queued" : "Generation started!", {
          description: data?.queued ? "It will start automatically when a provider slot opens." : "Your song is being generated."
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
      retryInFlight.current = false;
      setRetrying(false);
    }
  };

  const replaceDialog = (
    <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{hasAudio ? "Regenerate AI song audio?" : "Retry failed AI song generation?"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This starts one new paid-provider generation attempt producing a full
          song of at least 60 seconds. It may use provider credit even if the result is rejected.
          No automatic retries will run after a failure.
          {hasAudio && " Your current song remains playable until a valid replacement is ready."}
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowReplaceDialog(false)}>Cancel</Button>
          <Button onClick={() => void handleRetry(hasAudio)} disabled={retrying || !canRegenerate}>
            {retrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hasAudio ? "Regenerate once" : "Retry once"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

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

  if (statusError) return <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
    Could not load audio generation status.
    <Button type="button" size="sm" variant="outline" className="ml-2" onClick={() => void retryStatus()}>Retry status</Button>
    {lyricsDialog}
    {replaceDialog}
  </div>;
  if (!status) return <>{lyricsDialog}{replaceDialog}</>;

  // The dispatcher cannot know if a timed-out provider POST incurred a
  // charge. Keep the attempt reserved and require an operator to reconcile it.
  if (queueState === "needs_review") {
    return (
      <>
        {lyricsDialog}
        {replaceDialog}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            AI generation is awaiting a provider status check. Your request
            might already have been accepted, so RockMundo will not submit or
            charge for another attempt automatically. Please contact support.
            {hasAudio && (
              <span className="block text-xs mt-1">Your existing audio remains playable.</span>
            )}
          </AlertDescription>
        </Alert>
      </>
    );
  }

  // Already completed with audio - show success, admin can regenerate
  if (isCompleted && hasAudio && !replacementPending && queueState !== 'queued' && queueState !== 'dispatching') {
    return (
      <>
        {lyricsDialog}
        {replaceDialog}
        {replacementAttempt?.status === "failed" && (
          <Alert variant="destructive" className="mb-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Regeneration failed: {replacementAttempt.error_message || "Provider could not complete a valid replacement"}.
              Your original audio is still available.
            </AlertDescription>
          </Alert>
        )}
        <Alert className="bg-primary/10 border-primary/30">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-primary font-medium">
              {replacementAttempt?.status === "failed" ? "Previous audio remains available" : "✨ AI audio generated successfully!"}
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
            ) : showRetry ? (
              <Button variant="outline" size="sm" onClick={() => setShowReplaceDialog(true)}
                disabled={retrying || !limits?.can_generate}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Regenerate
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </>
    );
  }

  // Queued requests are not yet provider predictions. A long queue should
  // never appear timed out, and the original recording remains available.
  if (queueState === "queued" || queueState === "dispatching") {
    return (
      <>
        {lyricsDialog}
        {replaceDialog}
        <Alert className="bg-muted/50 border-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            {queueState === "queued" ? "Queued for AI song generation" : "Sending song to audio provider"}
            {queueAvailableAt && new Date(queueAvailableAt).getTime() > Date.now() && (
              <span className="block text-xs text-muted-foreground">
                Waiting for the provider rate-limit cooldown.
              </span>
            )}
            {hasAudio && <span className="block text-xs">Your existing audio remains playable.</span>}
          </AlertDescription>
        </Alert>
      </>
    );
  }

  // Do not reset an active provider job before the authoritative timeout.
  if ((isGenerating && !isTimedOut) || replacementPending) {
    const startedAt = status.audio_generation_started_at 
      ? new Date(status.audio_generation_started_at) 
      : new Date();
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    return (
      <>
        {lyricsDialog}
        {replaceDialog}
        <Alert className="bg-muted/50 border-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Generating AI audio for "{songTitle}"...
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {minutes}:{seconds.toString().padStart(2, '0')} / {queueState === "submitted" ? "30:00" : "15:00"}
              </span>
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
        {replaceDialog}
        <Alert variant="destructive" className="bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <span className="block">{isTimedOut
                ? "Generation timed out after 15 minutes"
                : "Audio generation failed"}</span>
              <span className="block text-xs mt-1">{failureHint}</span>
            </span>
            {showRetry && canRegenerate && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowReplaceDialog(true)}
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
        {shortPreviewUrl && (
          <Alert className="mt-2">
            <Music className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <span className="block text-sm">
                A short recording was recovered from the paid AI generation.
                It is a preview only; the song still needs at least 60 seconds of audio.
              </span>
              <audio controls preload="none" src={shortPreviewUrl}
                aria-label={`Short AI audio preview for ${songTitle}`}
                className="w-full" />
            </AlertDescription>
          </Alert>
        )}
      </>
    );
  }

  return <>{lyricsDialog}{replaceDialog}</>;
}
