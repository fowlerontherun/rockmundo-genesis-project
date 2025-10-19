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
      // Get project details first
      const { data: project, error: projectFetchError } = await supabase
        .from("songwriting_projects")
        .select("*, profiles(user_id)")
        .eq("id", projectId)
        .single();

      if (projectFetchError) throw projectFetchError;

      // Update project status to completed
      const { error: projectError } = await supabase
        .from("songwriting_projects")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (projectError) throw projectError;

      // Check if song exists, if not create it
      const { data: existingSong } = await supabase
        .from("songs")
        .select("id")
        .eq("songwriting_project_id", projectId)
        .maybeSingle();

      if (!existingSong) {
        // Create new song from completed project
        const { error: songError } = await supabase
          .from("songs")
          .insert({
            user_id: project.profiles?.[0]?.user_id,
            title: project.title,
            genre: project.genres?.[0] || "Rock",
            lyrics: project.initial_lyrics || "",
            quality_score: project.quality_score || 50,
            song_rating: project.song_rating || 1,
            duration: 180,
            status: "complete",
            completed_at: new Date().toISOString(),
            songwriting_project_id: projectId,
            catalog_status: "private"
          });

        if (songError) throw songError;
      } else {
        // Update existing song
        await supabase
          .from("songs")
          .update({
            status: "complete",
            completed_at: new Date().toISOString(),
          })
          .eq("id", existingSong.id);
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
