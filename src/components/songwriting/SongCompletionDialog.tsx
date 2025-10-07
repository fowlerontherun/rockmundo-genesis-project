import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SongQualityBreakdown } from "./SongQualityBreakdown";
import type { SongQualityResult } from "@/utils/songQuality";
import { Music, Users, Lock, Gift } from "lucide-react";

interface SongCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quality: SongQualityResult;
  xpEarned: number;
  onKeepPrivate: () => void;
  onAddToBand: () => void;
  onListForSale: () => void;
  onGift: () => void;
  isInBand: boolean;
}

export const SongCompletionDialog = ({
  open,
  onOpenChange,
  quality,
  xpEarned,
  onKeepPrivate,
  onAddToBand,
  onListForSale,
  onGift,
  isInBand
}: SongCompletionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">🎉 Song Completed!</DialogTitle>
          <DialogDescription>
            You've finished your song! Choose what to do with it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <SongQualityBreakdown quality={quality} />

          <div className="bg-primary/10 p-4 rounded-lg text-center">
            <div className="text-sm text-muted-foreground">XP Earned</div>
            <div className="text-3xl font-bold text-primary">+{xpEarned} XP</div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">What would you like to do with this song?</h4>
            
            <Button
              onClick={onKeepPrivate}
              variant="outline"
              className="w-full justify-start"
            >
              <Lock className="mr-2 h-4 w-4" />
              Keep Private
              <span className="ml-auto text-xs text-muted-foreground">Save for later</span>
            </Button>

            {isInBand && (
              <Button
                onClick={onAddToBand}
                variant="outline"
                className="w-full justify-start"
              >
                <Users className="mr-2 h-4 w-4" />
                Add to Band Catalog
                <span className="ml-auto text-xs text-muted-foreground">Share with band</span>
              </Button>
            )}

            <Button
              onClick={onListForSale}
              variant="outline"
              className="w-full justify-start"
            >
              <Music className="mr-2 h-4 w-4" />
              List on Song Market
              <span className="ml-auto text-xs text-muted-foreground">Sell or auction</span>
            </Button>

            <Button
              onClick={onGift}
              variant="outline"
              className="w-full justify-start"
            >
              <Gift className="mr-2 h-4 w-4" />
              Gift to Player
              <span className="ml-auto text-xs text-muted-foreground">Send as gift</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
