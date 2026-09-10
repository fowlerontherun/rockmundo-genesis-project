import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Lock, ShoppingCart, Check, Rotate3D, UserRound, Shirt } from "lucide-react";
import { ClothingItem } from "@/hooks/useSkinStore";
import { usePlayerAvatar } from "@/hooks/usePlayerAvatar";
import { PlayerModelPreview } from "@/features/player-model/PlayerModelPreview";
import { buildClothingPreviewAppearance, clothingPreviewVariants, previewFidelity } from "@/features/clothing-preview/clothingPreview";

interface ItemPreviewDialogProps {
  item: ClothingItem | null;
  isOwned: boolean;
  onClose: () => void;
  onPurchase: (item: ClothingItem) => void;
}

const rarityColors: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-success/20 text-success",
  rare: "bg-primary/20 text-primary",
  epic: "bg-accent/20 text-accent",
  legendary: "bg-warning/20 text-warning",
};

export const ItemPreviewDialog = ({ item, isOwned, onClose, onPurchase }: ItemPreviewDialogProps) => {
  const { avatarConfig, isLoading: avatarLoading } = usePlayerAvatar();
  const [variantId, setVariantId] = useState<string>("default");

  const variants = useMemo(() => item ? clothingPreviewVariants(item) : [], [item]);
  const selectedVariant = variants.find(variant => variant.id === variantId) || variants[0];
  const appearance = useMemo(() => item ? buildClothingPreviewAppearance(avatarConfig, item, selectedVariant) : null, [avatarConfig, item, selectedVariant]);

  if (!item) return null;

  const colorVariants = item.color_variants as string[] | null;
  const fidelity = previewFidelity(item);
  const material = (item.material_config || {}) as Record<string, any>;
  const garment = (item.garment_config || {}) as Record<string, any>;
  const pattern = (item.pattern_config || {}) as Record<string, any>;
  const fit = (item.fit_config || {}) as Record<string, any>;
  const wear = (item.wear_config || {}) as Record<string, any>;

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.name}
            {item.is_limited_edition && <Sparkles className="h-4 w-4 text-warning" />}
          </DialogTitle>
        </DialogHeader>

        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)] gap-6">
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden border bg-[#101823] min-h-[520px] relative">
              {appearance && !avatarLoading ? (
                <PlayerModelPreview appearance={appearance} />
              ) : (
                <div className="min-h-[520px] flex items-center justify-center text-sm text-muted-foreground">Preparing your avatar fitting room…</div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Rotate3D className="h-3.5 w-3.5" />Drag to rotate 360°, scroll/pinch to zoom, or use the viewer controls.</span>
              <Badge variant="outline" className="gap-1"><UserRound className="h-3 w-3" />Your avatar</Badge>
            </div>
            {fidelity !== 'asset' && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Preview fidelity:</strong> this item is using the procedural wardrobe proxy while the dedicated garment asset pipeline is completed. Colour, outfit context and 360° avatar fit are live; exact mesh details will automatically improve when an item-specific asset is available.
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize">{item.wearable_slot || item.category}</Badge>
              <Badge className={rarityColors[item.rarity || "common"]}>{item.rarity || "common"}</Badge>
            </div>

            {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}

            {variants.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Preview variant</p>
                <Select value={selectedVariant?.id || variants[0]?.id} onValueChange={setVariantId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{variants.map(variant => <SelectItem key={variant.id} value={variant.id}>{variant.label}</SelectItem>)}</SelectContent>
                </Select>
                {selectedVariant && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-5 h-5 rounded-full border" style={{ backgroundColor: selectedVariant.color }} />{selectedVariant.material || material.fabric || 'Default material'}{selectedVariant.pattern && selectedVariant.pattern !== 'solid' ? ` · ${selectedVariant.pattern}` : ''}</div>}
              </div>
            )}

            {variants.length <= 1 && colorVariants && colorVariants.length > 0 && (
              <div><p className="text-sm font-medium mb-2">Available colours</p><div className="flex gap-2 flex-wrap">{colorVariants.map((color, i) => <div key={i} className="w-7 h-7 rounded-full border-2 border-border" style={{ backgroundColor: color }} title={color} />)}</div></div>
            )}

            <div className="rounded-lg border p-3 space-y-2">
              <div className="font-medium text-sm flex items-center gap-2"><Shirt className="h-4 w-4" />Garment details</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <span className="text-muted-foreground">Fabric</span><span className="capitalize">{selectedVariant?.material || material.fabric || 'standard'}</span>
                <span className="text-muted-foreground">Silhouette</span><span className="capitalize">{garment.silhouette || 'classic'}</span>
                <span className="text-muted-foreground">Fit</span><span className="capitalize">{fit.fit || 'regular'}</span>
                <span className="text-muted-foreground">Pattern</span><span className="capitalize">{selectedVariant?.pattern || pattern.type || 'solid'}</span>
                <span className="text-muted-foreground">Condition</span><span className="capitalize">{wear.condition || 'new'}</span>
                <span className="text-muted-foreground">Details</span><span>{Array.isArray(item.detail_layers) ? item.detail_layers.length : 0} layers</span>
              </div>
            </div>

            {item.bonus_enabled && item.bonus_config && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="text-sm font-medium mb-2">Equipped bonuses</div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {item.bonus_config.daily_xp ? <Badge variant="secondary">+{item.bonus_config.daily_xp} daily XP</Badge> : null}
                  {item.bonus_config.daily_ap ? <Badge variant="secondary">+{item.bonus_config.daily_ap} daily AP</Badge> : null}
                  {item.bonus_config.performance_pct ? <Badge variant="secondary">+{item.bonus_config.performance_pct}% performance</Badge> : null}
                  {item.bonus_config.recording_pct ? <Badge variant="secondary">+{item.bonus_config.recording_pct}% recording</Badge> : null}
                  {item.bonus_config.songwriting_pct ? <Badge variant="secondary">+{item.bonus_config.songwriting_pct}% songwriting</Badge> : null}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t gap-3">
              <div className="flex items-center gap-2">
                {item.is_premium && <Lock className="h-4 w-4 text-warning" />}
                <span className="text-xl font-bold">${item.price?.toLocaleString() || "Free"}</span>
              </div>
              {isOwned ? (
                <Button disabled className="gap-2"><Check className="h-4 w-4" />Owned</Button>
              ) : (
                <Button onClick={() => onPurchase(item)} className="gap-2"><ShoppingCart className="h-4 w-4" />Purchase</Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
