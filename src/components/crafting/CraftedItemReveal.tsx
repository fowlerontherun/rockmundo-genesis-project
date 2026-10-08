import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Share2, Sparkles, Star } from "lucide-react";
import { getQualityLabel } from "@/data/craftingMaterials";
import { useEffect, useState } from "react";
import { ShareMomentSheet } from "@/features/shareable-moments/ShareMomentSheet";
import type { ShareMoment } from "@/features/shareable-moments/types";
import { shouldOfferSharePrompt } from "@/features/shareable-moments/prompts";
import { referralAwareDestination } from "@/features/shareable-moments/referralDestination";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface CraftedItemRevealProps {
  open: boolean;
  onClose: () => void;
  recipeName: string;
  qualityRoll: number;
  bonusStats: Record<string, number> | null;
}

export const CraftedItemReveal = ({
  open,
  onClose,
  recipeName,
  qualityRoll,
  bonusStats,
}: CraftedItemRevealProps) => {
  const quality = getQualityLabel(qualityRoll);
  const isMasterwork = qualityRoll >= 95;
  const [shareMoment, setShareMoment] = useState<ShareMoment | null>(null);
  const { profileId } = useActiveProfile();
  useEffect(() => {
    if (!open || !isMasterwork || shareMoment) return;
    const sourceId = `${recipeName}:${Math.round(qualityRoll)}`;
    if (!shouldOfferSharePrompt("craft-masterwork", sourceId)) return;
    void (async () => {
      const destinationUrl = await referralAwareDestination(profileId, window.location.href, "craft_share");
      setShareMoment({ version: 1,
      promptOnly: true, promptKind: "craft-masterwork", promptSourceId: sourceId, promptLabel: "Share masterwork", type: "achievement", id: sourceId, eyebrow: "MASTERWORK", headline: recipeName, subheadline: "Crafted an exceptional item in RockMundo", metrics: [{ label: "Quality", value: `${Math.round(qualityRoll)}%` }, { label: "Grade", value: quality.label }], destinationUrl, referralCode: null, createdAt: new Date().toISOString() });
    })();
  }, [open, isMasterwork, recipeName, qualityRoll, quality.label, shareMoment, profileId]);

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            {isMasterwork && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
            <Sparkles className="w-5 h-5 text-primary" />
            Crafting Complete!
            <Sparkles className="w-5 h-5 text-primary" />
            {isMasterwork && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-4 py-4">
          <h3 className="text-lg font-bold">{recipeName}</h3>
          <Badge className={`${quality.color} text-sm px-3 py-1`} variant="outline">
            {quality.label} — {Math.round(qualityRoll)}%
          </Badge>

          {bonusStats && Object.keys(bonusStats).length > 0 && (
            <div className="space-y-1 text-sm">
              {Object.entries(bonusStats).map(([key, val]) => (
                <div key={key} className={val >= 0 ? "text-green-400" : "text-red-400"}>
                  {key.replace(/_/g, " ")}: {val >= 0 ? "+" : ""}{val}
                </div>
              ))}
            </div>
          )}

          {isMasterwork && (
            <p className="text-xs text-amber-300 italic">
              ✨ A true masterpiece — crafted with exceptional skill!
            </p>
          )}
        </div>

        <div className="grid gap-2"><Button onClick={onClose} className="w-full">Awesome!</Button>{isMasterwork && <Button variant="outline" onClick={() => setShareMoment({ version: 1, type: "achievement", id: `${recipeName}:${Math.round(qualityRoll)}`, eyebrow: "MASTERWORK", headline: recipeName, subheadline: "Crafted an exceptional item in RockMundo", metrics: [{ label: "Quality", value: `${Math.round(qualityRoll)}%` }, { label: "Grade", value: quality.label }], destinationUrl: window.location.href, referralCode: null, createdAt: new Date().toISOString() })}><Share2 className="mr-2 h-4 w-4" />Share masterwork</Button>}</div>
      </DialogContent>
    </Dialog>
    <ShareMomentSheet moment={shareMoment} open={!!shareMoment} onOpenChange={(next) => { if (!next) setShareMoment(null); }} />
    </>
  );
};
