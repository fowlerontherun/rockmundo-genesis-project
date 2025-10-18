import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();

  const handleComplete = async () => {
    setCompleting(true);
    try {
      // Mark session as completed
      const { error: updateError } = await supabase
        .from("recording_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (updateError) throw updateError;

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
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={completing}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={completing}>
            {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Recording
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
