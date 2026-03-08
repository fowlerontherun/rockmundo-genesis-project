import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BODY_SLOTS, type BodySlot, calculateTattooQuality } from "@/data/tattooDesigns";
import type { TattooArtist } from "./TattooArtistCard";

interface CustomTattooDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist: TattooArtist | null;
  parlourTier: number;
  parlourPriceMultiplier: number;
  occupiedSlots: Set<string>;
  onSubmit: (data: { description: string; bodySlot: BodySlot; quotedPrice: number; estimatedQuality: number }) => void;
  isPending?: boolean;
}

const CUSTOM_SURCHARGE = 1.5;
const CUSTOM_BASE_PRICE = 300;

export const CustomTattooDialog = ({
  open,
  onOpenChange,
  artist,
  parlourTier,
  parlourPriceMultiplier,
  occupiedSlots,
  onSubmit,
  isPending,
}: CustomTattooDialogProps) => {
  const [description, setDescription] = useState("");
  const [bodySlot, setBodySlot] = useState<BodySlot | "">("");

  if (!artist) return null;

  const quotedPrice = Math.round(CUSTOM_BASE_PRICE * parlourPriceMultiplier * artist.price_premium * CUSTOM_SURCHARGE);
  const baseQuality = calculateTattooQuality(parlourTier);
  const estimatedQualityMin = Math.min(100, baseQuality + artist.quality_bonus);
  const estimatedQualityMax = Math.min(100, estimatedQualityMin + 10);

  const availableSlots = Object.entries(BODY_SLOTS).filter(
    ([key]) => !occupiedSlots.has(key)
  );

  const handleSubmit = () => {
    if (!description.trim() || !bodySlot) return;
    onSubmit({
      description: description.trim(),
      bodySlot: bodySlot as BodySlot,
      quotedPrice,
      estimatedQuality: Math.round((estimatedQualityMin + estimatedQualityMax) / 2),
    });
    setDescription("");
    setBodySlot("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Custom Design — {artist.name}</DialogTitle>
          <DialogDescription>
            Describe your dream tattoo and {artist.nickname || artist.name} will create a unique piece.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Your Design Idea</Label>
            <Textarea
              placeholder="Describe your custom tattoo vision... e.g., 'A phoenix rising from musical notes with flames'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">{description.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label>Body Placement</Label>
            <Select value={bodySlot} onValueChange={(v) => setBodySlot(v as BodySlot)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose body slot" />
              </SelectTrigger>
              <SelectContent>
                {availableSlots.map(([key, slot]) => (
                  <SelectItem key={key} value={key}>{slot.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableSlots.length === 0 && (
              <p className="text-xs text-destructive">All body slots are taken!</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-[10px] text-muted-foreground">Quoted Price</p>
              <p className="text-lg font-bold text-primary">${quotedPrice}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Est. Quality</p>
              <p className="text-lg font-bold text-green-400">{estimatedQualityMin}–{estimatedQualityMax}</p>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px]">Base: ${CUSTOM_BASE_PRICE}</Badge>
            <Badge variant="outline" className="text-[10px]">Parlour: x{parlourPriceMultiplier}</Badge>
            <Badge variant="outline" className="text-[10px]">Artist: x{artist.price_premium}</Badge>
            <Badge variant="outline" className="text-[10px]">Custom: x{CUSTOM_SURCHARGE}</Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!description.trim() || !bodySlot || isPending}
          >
            {isPending ? "Creating..." : "Commission Design"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
