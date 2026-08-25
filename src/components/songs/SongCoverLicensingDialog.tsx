import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useUpdateSongCoverSettings } from "@/hooks/useSongCovers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: {
    id: string;
    title: string;
    available_for_covers?: boolean | null;
    cover_royalty_percentage?: number | null;
    cover_auto_approve?: boolean | null;
  } | null;
}

export const SongCoverLicensingDialog = ({ open, onOpenChange, song }: Props) => {
  const [available, setAvailable] = useState(false);
  const [royalty, setRoyalty] = useState(15);
  const [autoApprove, setAutoApprove] = useState(false);
  const update = useUpdateSongCoverSettings();

  useEffect(() => {
    if (!song) return;
    setAvailable(!!song.available_for_covers);
    setRoyalty(Number(song.cover_royalty_percentage ?? 15));
    setAutoApprove(!!song.cover_auto_approve);
  }, [song]);

  if (!song) return null;

  const handleSave = async () => {
    await update.mutateAsync({
      songId: song.id,
      availableForCovers: available,
      royaltyPercentage: royalty,
      autoApprove,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recording-cover terms — {song.title}</DialogTitle>
          <DialogDescription>
            Other bands can learn this song for live shows without taking ownership. These settings control permission to make and commercially release their own recording.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Publish recording terms</Label>
              <p className="text-xs text-muted-foreground">
                Bands can still add the song to a live repertoire when this is off, but recording requests require your approval.
              </p>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Writer royalty</Label>
              <span className="text-sm font-semibold text-primary">{royalty}%</span>
            </div>
            <Slider
              value={[royalty]}
              min={0}
              max={50}
              step={1}
              disabled={!available}
              onValueChange={(value) => setRoyalty(value[0] ?? 15)}
            />
            <p className="text-xs text-muted-foreground">
              {royalty}% is taken from the cover recording's eligible revenue before the covering band or label is paid. If the original has multiple writers, that royalty is split by their songwriting ownership percentages.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Auto-approve recording requests</Label>
              <p className="text-xs text-muted-foreground">
                Grant recording permission immediately on the published royalty terms.
              </p>
            </div>
            <Switch checked={autoApprove} onCheckedChange={setAutoApprove} disabled={!available} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save recording terms"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SongCoverLicensingDialog;
