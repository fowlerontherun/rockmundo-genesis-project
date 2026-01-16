import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Users, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface AddToRepertoireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string;
  songTitle: string;
  bandId: string;
  bandName: string;
  userId: string;
  onSuccess?: () => void;
}

export const AddToRepertoireDialog = ({
  open,
  onOpenChange,
  songId,
  songTitle,
  bandId,
  bandName,
  userId,
  onSuccess,
}: AddToRepertoireDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleAddToRepertoire = async () => {
    setIsSubmitting(true);

    try {
      // 1. Update song to belong to band
      const { error: songError } = await supabase
        .from("songs")
        .update({
          band_id: bandId,
          ownership_type: "band",
          added_to_repertoire_at: new Date().toISOString(),
          added_to_repertoire_by: userId,
        })
        .eq("id", songId);

      if (songError) throw songError;

      // 2. Create ownership record for the original writer (100%)
      const { error: ownershipError } = await supabase
        .from("band_song_ownership")
        .insert({
          song_id: songId,
          band_id: bandId,
          user_id: userId,
          ownership_percentage: 100,
          original_percentage: 100,
          role: "writer",
          is_active_member: true,
        });

      if (ownershipError) throw ownershipError;

      // 3. Log activity
      await supabase.from("activity_feed").insert({
        user_id: userId,
        activity_type: "song_added_to_repertoire",
        message: `Added "${songTitle}" to ${bandName}'s repertoire`,
        metadata: { songId, bandId },
      });

      toast.success("Song Added!", {
        description: `"${songTitle}" is now part of ${bandName}'s repertoire.`,
      });

      queryClient.invalidateQueries({ queryKey: ["band-repertoire-songs"] });
      queryClient.invalidateQueries({ queryKey: ["songwriting-projects"] });
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding to repertoire:", error);
      toast.error("Failed to add song to repertoire");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add to Band Repertoire
          </DialogTitle>
          <DialogDescription>
            Add "{songTitle}" to {bandName}'s song catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Ownership Rules:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• You will retain 100% ownership as the original writer</li>
                <li>• If you leave the band, you keep 30% royalty share</li>
                <li>• If you rejoin, your share reverts to the original split</li>
                <li>• All band members will be able to view and perform this song</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Your ownership</span>
            <Badge variant="default">100%</Badge>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleAddToRepertoire} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add to Repertoire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
