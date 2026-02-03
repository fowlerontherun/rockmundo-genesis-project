import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface SongArchiveButtonProps {
  songId: string;
  songTitle?: string;
  isArchived: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showDelete?: boolean;
}

export const SongArchiveButton = ({ 
  songId, 
  songTitle,
  isArchived, 
  variant = "outline",
  size = "default",
  showDelete = true,
}: SongArchiveButtonProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ["user-songs"] });
      queryClient.invalidateQueries({ queryKey: ["band-songs"] });
      queryClient.invalidateQueries({ queryKey: ["recordable-songs"] });
      toast({
        title: archive ? "Song Archived" : "Song Restored",
        description: archive 
          ? "This song is now hidden from setlists, recordings, and rehearsals."
          : "This song is now available for setlists, recordings, and rehearsals.",
      });
      setShowArchiveConfirm(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${isArchived ? 'restore' : 'archive'} song: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // First, delete related records that might have foreign key constraints
      // Delete from setlist_songs
      await supabase.from("setlist_songs").delete().eq("song_id", songId);
      
      // Delete from band_song_familiarity
      await supabase.from("band_song_familiarity").delete().eq("song_id", songId);
      
      // Delete from song_rehearsals
      await supabase.from("song_rehearsals").delete().eq("song_id", songId);
      
      // Delete from band_song_ownership
      await supabase.from("band_song_ownership").delete().eq("song_id", songId);
      
      // Finally delete the song itself
      const { error } = await supabase
        .from("songs")
        .delete()
        .eq("id", songId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["user-songs"] });
      queryClient.invalidateQueries({ queryKey: ["band-songs"] });
      queryClient.invalidateQueries({ queryKey: ["recordable-songs"] });
      queryClient.invalidateQueries({ queryKey: ["setlist-songs"] });
      toast({
        title: "Song Deleted",
        description: "The song has been permanently deleted.",
      });
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete song: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Simple archive/restore if delete not shown or if archived (show restore directly)
  if (!showDelete || isArchived) {
    return (
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
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
                    <li>Rehearsal sessions</li>
                    <li>Creating music videos</li>
                  </ul>
                </>
              ) : (
                <>
                  This will hide the song from:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Setlist creation and management</li>
                    <li>Recording options</li>
                    <li>Rehearsal sessions</li>
                    <li>Music video creation</li>
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
            <AlertDialogAction 
              onClick={() => archiveMutation.mutate(!isArchived)}
              disabled={archiveMutation.isPending}
            >
              {isArchived ? "Restore Song" : "Archive Song"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Dropdown with both archive and delete options
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size}>
            <Archive className="h-4 w-4 mr-2" />
            Manage
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowArchiveConfirm(true)}>
            <Archive className="h-4 w-4 mr-2" />
            Archive Song
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowDeleteConfirm(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Song?</AlertDialogTitle>
            <AlertDialogDescription>
              {songTitle && <p className="font-medium mb-2">"{songTitle}"</p>}
              This will hide the song from:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Setlist creation and management</li>
                <li>Recording options</li>
                <li>Rehearsal sessions</li>
                <li>Music video creation</li>
              </ul>
              <p className="mt-2 text-sm">
                The song will still exist in your catalog and can be restored at any time.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => archiveMutation.mutate(true)}
              disabled={archiveMutation.isPending}
            >
              Archive Song
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Song Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {songTitle && <p className="font-medium mb-2">"{songTitle}"</p>}
              <p className="text-destructive font-medium">This action cannot be undone!</p>
              <p className="mt-2">This will permanently delete:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The song and all its data</li>
                <li>All rehearsal progress for this song</li>
                <li>Any setlist entries containing this song</li>
                <li>Ownership and royalty records</li>
              </ul>
              <p className="mt-3 text-sm bg-muted p-2 rounded">
                💡 Consider archiving instead if you might want to restore this song later.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
