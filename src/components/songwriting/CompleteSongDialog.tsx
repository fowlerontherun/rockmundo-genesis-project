import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

interface CompleteSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  onComplete: () => void;
}

export const CompleteSongDialog = ({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  onComplete,
}: CompleteSongDialogProps) => {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      // Update project status to completed
      const { error: projectError } = await supabase
        .from("songwriting_projects")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (projectError) throw projectError;

      // If there's an associated song, mark it complete too
      const { data: song } = await supabase
        .from("songs")
        .select("id")
        .eq("songwriting_project_id", projectId)
        .maybeSingle();

      if (song) {
        await supabase
          .from("songs")
          .update({
            status: "complete",
            completed_at: new Date().toISOString(),
          })
          .eq("id", song.id);
      }

      toast.success("Song completed!", {
        description: `"${projectTitle}" is now ready for recording or release.`,
      });

      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error completing song:", error);
      toast.error("Failed to complete song");
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
            Complete Song
          </DialogTitle>
          <DialogDescription>
            Mark "{projectTitle}" as completed? This will make it available for recording and release.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={completing}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={completing}>
            {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Song
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
