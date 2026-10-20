import { ReleaseArtwork } from '@/components/game-art/ReleaseArtwork';
import { ReleaseArtworkDesigner } from './artwork/ReleaseArtworkDesigner';
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Calendar } from "lucide-react";
import { format, addDays, isBefore } from "date-fns";

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
    scheduled_release_date?: string | null;
    manufacturing_complete_at?: string | null;
    release_formats?: Array<{ format_type: string }>;
  } | null;
}

// Manufacturing days by format type
const MANUFACTURING_DAYS: Record<string, number> = {
  vinyl: 14,
  cd: 7,
  cassette: 5,
  digital: 2,
  streaming: 2,
};

export function EditReleaseDialog({ open, onOpenChange, release }: EditReleaseDialogProps) {
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [artworkBusy, setArtworkBusy] = useState(false);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  // Calculate minimum release date based on formats
  const getMinReleaseDate = () => {
    if (!release?.release_formats || release.release_formats.length === 0) {
      return addDays(new Date(), 2);
    }
    const maxDays = Math.max(
      ...release.release_formats.map(f => MANUFACTURING_DAYS[f.format_type] || 2)
    );
    return addDays(new Date(), maxDays);
  };

  const minReleaseDate = getMinReleaseDate();
  const manufacturingCompleteDate = release?.manufacturing_complete_at 
    ? new Date(release.manufacturing_complete_at) 
    : minReleaseDate;

  // Check if selected date is before manufacturing completion
  const isDateTooEarly = scheduledDate && isBefore(new Date(scheduledDate), manufacturingCompleteDate);

  useEffect(() => {
    if (release) {
      setDesignerOpen(false);
      setTitle(release.title);
      setArtistName(release.artist_name);
      setArtworkUrl(release.artwork_url || "");
      setScheduledDate(release.scheduled_release_date || "");
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
          scheduled_release_date: scheduledDate || null,
        })
        .eq("id", release.id).select("id").single();

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

  const uploadArtworkFile = async (file: File) => {
    if (!release) throw new Error("No release selected");
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `release-artwork/${release.id}-${crypto.randomUUID()}.${fileExt}`;
      const { error } = await supabase.storage.from("music").upload(filePath, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("music").getPublicUrl(filePath);
      setArtworkUrl(publicUrl);
    } finally { setUploading(false); }
  };

  const handleArtworkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await uploadArtworkFile(file); toast({ title: "Artwork uploaded" }); }
    catch (error: any) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); }
  };

  if (!release) return null;

  const canEditDate = release.release_status !== "released";

  return (
    <Dialog open={open} onOpenChange={next => { if (!uploading && !artworkBusy && !updateRelease.isPending) onOpenChange(next); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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

          {canEditDate && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Scheduled Release Date
              </Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={format(minReleaseDate, "yyyy-MM-dd")}
              />
              <p className="text-xs text-muted-foreground">
                Manufacturing completes: {format(manufacturingCompleteDate, "MMM d, yyyy")}
              </p>
              
              {isDateTooEarly && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Selected date is before manufacturing completes. Your release date should be after {format(manufacturingCompleteDate, "MMM d, yyyy")}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Artwork</Label>
            <p className="text-xs text-muted-foreground">A default sleeve appears when no artwork is available. Upload your own cover to replace it.</p>
            <div className="flex gap-2 items-center">
              <ReleaseArtwork id={release.id} title={title} artist={artistName} artworkUrl={artworkUrl} releaseType={release.release_type} />
              <div className="min-w-0 flex-1">
                <Input
                  aria-label="Upload release artwork"
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

          <Button type="button" variant="outline" disabled={uploading || updateRelease.isPending || artworkBusy} aria-expanded={designerOpen} onClick={() => setDesignerOpen(v => !v)}>{designerOpen ? 'Hide artwork studio' : 'Design your artwork'}</Button>
          {designerOpen && <ReleaseArtworkDesigner onBusyChange={setArtworkBusy} key={release.id} title={title} artist={artistName} disabled={uploading || updateRelease.isPending || artworkBusy} onUse={uploadArtworkFile} />}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              disabled={uploading || artworkBusy || updateRelease.isPending}
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateRelease.mutate()}
              disabled={uploading || artworkBusy || updateRelease.isPending || !title || !artistName}
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
