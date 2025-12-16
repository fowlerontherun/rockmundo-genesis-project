import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface EditReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: {
    id: string;
    title: string;
    artist_name: string;
    release_type: string;
    release_status: string;
    artwork_url?: string | null;
  } | null;
}

export function EditReleaseDialog({ open, onOpenChange, release }: EditReleaseDialogProps) {
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (release) {
      setTitle(release.title);
      setArtistName(release.artist_name);
      setArtworkUrl(release.artwork_url || "");
    }
  }, [release]);

  const updateRelease = useMutation({
    mutationFn: async () => {
      if (!release) throw new Error("No release selected");
      
      const { error } = await supabase
        .from("releases")
        .update({
          title,
          artist_name: artistName,
          artwork_url: artworkUrl || null,
        })
        .eq("id", release.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      queryClient.invalidateQueries({ queryKey: ["release-detail"] });
      toast({ title: "Release updated successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error updating release",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleArtworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !release) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${release.id}-${Date.now()}.${fileExt}`;
      const filePath = `release-artwork/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("music")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("music")
        .getPublicUrl(filePath);

      setArtworkUrl(publicUrl);
      toast({ title: "Artwork uploaded" });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (!release) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Release</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Release Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter release title"
            />
          </div>

          <div className="space-y-2">
            <Label>Artist Name</Label>
            <Input
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Enter artist name"
            />
          </div>

          <div className="space-y-2">
            <Label>Artwork</Label>
            <div className="flex gap-2 items-center">
              {artworkUrl ? (
                <img
                  src={artworkUrl}
                  alt="Release artwork"
                  className="w-20 h-20 object-cover rounded-md border"
                />
              ) : (
                <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs">
                  No artwork
                </div>
              )}
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleArtworkUpload}
                  disabled={uploading}
                />
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateRelease.mutate()}
              disabled={updateRelease.isPending || !title || !artistName}
              className="flex-1"
            >
              {updateRelease.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
