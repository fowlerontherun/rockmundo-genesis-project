import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Star } from "lucide-react";
import { getQualityLabel } from "@/data/craftingMaterials";

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

  return (
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

        <Button onClick={onClose} className="w-full">
          Awesome!
        </Button>
      </DialogContent>
    </Dialog>
  );
};
