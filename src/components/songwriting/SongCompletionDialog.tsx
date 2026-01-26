import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SongQualityBreakdown } from "./SongQualityBreakdown";
import type { SongQualityResult } from "@/utils/songQuality";
import { Music, Users, Lock, Gift, Percent } from "lucide-react";
import type { Collaboration } from "@/hooks/useCollaborationInvites";

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
  collaborators?: Collaboration[];
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
  isInBand,
  collaborators = []
}: SongCompletionDialogProps) => {
  // Calculate royalty splits
  const royaltyCollaborators = collaborators.filter(
    c => c.status === "accepted" && c.compensation_type === "royalty"
  );
  const totalCollaboratorPercentage = royaltyCollaborators.reduce(
    (sum, c) => sum + (c.royalty_percentage || 0), 0
  );
  const writerPercentage = 100 - totalCollaboratorPercentage;

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

          {/* Royalty Splits Display */}
          {royaltyCollaborators.length > 0 && (
            <div className="space-y-3 p-4 border rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Royalty Splits
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-primary/5 rounded">
                  <span className="text-sm font-medium">You (Writer)</span>
                  <Badge variant="secondary">{writerPercentage}%</Badge>
                </div>
                {royaltyCollaborators.map((collab) => (
                  <div key={collab.id} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={collab.invitee_profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {collab.invitee_profile?.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{collab.invitee_profile?.username}</span>
                    </div>
                    <Badge variant="secondary">{collab.royalty_percentage}%</Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These percentages will be applied to all future earnings from this song.
              </p>
            </div>
          )}

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
