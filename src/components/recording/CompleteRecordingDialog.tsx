import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Music } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useAuth } from "@/hooks/use-auth-context";

interface CompleteRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  songTitle: string;
}

export const CompleteRecordingDialog = ({
  open,
  onOpenChange,
  sessionId,
  songTitle,
}: CompleteRecordingDialogProps) => {
  const [completing, setCompleting] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const queryClient = useQueryClient();
  const { data: vipStatus } = useVipStatus();
  const { user } = useAuth();

  const generateAudio = async (songId: string) => {
    if (!vipStatus?.isVip || !user?.id) return;

    setGeneratingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-song-audio', {
        body: { songId, userId: user.id }
      });

      if (error) {
        console.error('Audio generation error:', error);
        toast.error("Audio generation started in background", {
          description: "You'll be notified when it's ready."
        });
      } else if (data?.success) {
        toast.success("AI audio generated!", {
          description: "Your song now has playable audio.",
          icon: <Music className="h-4 w-4" />
        });
        queryClient.invalidateQueries({ queryKey: ["songs"] });
      }
    } catch (err) {
      console.error('Audio generation failed:', err);
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
        await supabase
          .from('songs')
          .update({ status: 'recorded' })
          .eq('id', session.song_id);

        // Trigger AI audio generation for VIP users
        if (vipStatus?.isVip) {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Complete Recording
          </DialogTitle>
          <DialogDescription>
            Mark the recording session for "{songTitle}" as completed?
            {vipStatus?.isVip && (
              <span className="block mt-2 text-primary font-medium">
                ✨ VIP: AI audio will be generated automatically!
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
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
