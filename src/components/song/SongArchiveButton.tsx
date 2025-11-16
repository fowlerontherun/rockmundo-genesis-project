import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SongArchiveButtonProps {
  songId: string;
  isArchived: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export const SongArchiveButton = ({ 
  songId, 
  isArchived, 
  variant = "outline",
  size = "default" 
}: SongArchiveButtonProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const archiveMutation = useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await supabase
        .from("songs")
        .update({ archived: archive })
        .eq("id", songId);

      if (error) throw error;
    },
    onSuccess: (_, archive) => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["band-songs"] });
      toast({
        title: archive ? "Song Archived" : "Song Restored",
        description: archive 
          ? "This song is now hidden from setlists and recording options."
          : "This song is now available for setlists and recording.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${isArchived ? 'restore' : 'archive'} song: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleToggleArchive = () => {
    archiveMutation.mutate(!isArchived);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={archiveMutation.isPending}
        >
          {isArchived ? (
            <>
              <ArchiveRestore className="h-4 w-4 mr-2" />
              Restore
            </>
          ) : (
            <>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchived ? "Restore Song?" : "Archive Song?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived ? (
              <>
                This will make the song available again for:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Adding to setlists</li>
                  <li>Recording in studio</li>
                  <li>Creating music videos</li>
                  <li>Performance scheduling</li>
                </ul>
              </>
            ) : (
              <>
                This will hide the song from:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Setlist creation and management</li>
                  <li>Recording options</li>
                  <li>Music video creation</li>
                  <li>Performance scheduling</li>
                </ul>
                <p className="mt-2 text-sm">
                  The song will still exist in your catalog and can be restored at any time.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggleArchive}>
            {isArchived ? "Restore Song" : "Archive Song"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
