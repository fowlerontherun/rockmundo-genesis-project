import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Lock, ShoppingCart, Check, Rotate3D, UserRound, Shirt, Layers3, Images, Palette, Save, RotateCcw } from "lucide-react";
import { ClothingItem, type OwnedSkin, useSaveClothingCustomization } from "@/hooks/useSkinStore";
import { usePlayerAvatar } from "@/hooks/usePlayerAvatar";
import { buildClothingPreviewAppearance, clothingPreviewVariants, type ClothingPreviewVariant } from "@/features/clothing-preview/clothingPreview";
import { RichClothingPreview, type RichClothingPreviewStatus } from "@/features/clothing-preview/RichClothingPreview";
import { usablePreviewFrames } from "@/features/clothing-preview/previewManifest";
import {
  applyClothingZoneColours,
  clothingVariantByKey,
  playerEditableClothingZones,
  sanitizeClothingZoneColours,
  type ClothingZoneColours,
} from "@/features/clothing-preview/clothingCustomization";
import { GeneratedTurntablePreview } from "./GeneratedTurntablePreview";

export interface ClothingPurchaseCustomization {
  variantKey?: string | null;
  zoneColours?: ClothingZoneColours;
}

interface ItemPreviewDialogProps {
  item: ClothingItem | null;
  isOwned: boolean;
  ownedSkin?: OwnedSkin | null;
  onClose: () => void;
  onPurchase: (item: ClothingItem, customization?: ClothingPurchaseCustomization) => void;
}

const rarityColors: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-success/20 text-success",
  rare: "bg-primary/20 text-primary",
  epic: "bg-accent/20 text-accent",
  legendary: "bg-warning/20 text-warning",
};

function variantKeyForPersistence(item: ClothingItem, variant?: ClothingPreviewVariant) {
  if (!variant) return null;
  const hasNamedVariants = Array.isArray(item.variant_matrix) && item.variant_matrix.length > 0;
  const hasColourVariants = Array.isArray(item.color_variants) && item.color_variants.length > 0;
  return hasNamedVariants || hasColourVariants ? variant.id : null;
}

export const ItemPreviewDialog = ({ item, isOwned, ownedSkin, onClose, onPurchase }: ItemPreviewDialogProps) => {
  const { avatarConfig, isLoading: avatarLoading } = usePlayerAvatar();
  const saveMutation = useSaveClothingCustomization();
  const [variantId, setVariantId] = useState<string>("default");
  const [zoneColours, setZoneColours] = useState<ClothingZoneColours>({});
  const [previewMode, setPreviewMode] = useState<'live' | 'turntable'>('live');

  const variants = useMemo(() => item ? clothingPreviewVariants(item) : [], [item]);
  const editableZones = useMemo(() => item ? playerEditableClothingZones(item) : [], [item]);
  const selectedVariant = variants.find(variant => variant.id === variantId) || variants[0];

  const customizedItem = useMemo(
    () => item ? applyClothingZoneColours(item, zoneColours) : null,
    [item, zoneColours],
  );

  const primaryZone = editableZones.find(zone => String(zone.id) === 'main') || editableZones[0];
  const secondaryZone = editableZones.find(zone => String(zone.id) === 'trim') || editableZones[1];
  const previewVariant = useMemo<ClothingPreviewVariant | undefined>(() => {
    if (!selectedVariant) return undefined;
    const primaryOverride = primaryZone ? zoneColours[String(primaryZone.id)] : undefined;
    const secondaryOverride = secondaryZone ? zoneColours[String(secondaryZone.id)] : undefined;
    return {
      ...selectedVariant,
      ...(primaryOverride ? { color: primaryOverride } : {}),
      ...(secondaryOverride ? { secondaryColor: secondaryOverride } : {}),
    };
  }, [primaryZone, secondaryZone, selectedVariant, zoneColours]);

  const appearance = useMemo(
    () => customizedItem ? buildClothingPreviewAppearance(avatarConfig, customizedItem, previewVariant) : null,
    [avatarConfig, customizedItem, previewVariant],
  );
  const generatedFrames = useMemo(() => item ? usablePreviewFrames(item.preview_manifest) : [], [item]);
  const hasGeneratedTurntable = generatedFrames.length > 0;

  useEffect(() => {
    if (!item) return;
    const savedVariant = clothingVariantByKey(item, ownedSkin?.selected_variant_key);
    const initialVariant = savedVariant || clothingPreviewVariants(item)[0];
    setVariantId(initialVariant?.id || 'default');
    setZoneColours(sanitizeClothingZoneColours(item, ownedSkin?.customization_config || {}));
    setPreviewMode('live');
  }, [item?.id, ownedSkin?.selected_variant_key, ownedSkin?.customization_config]);

  if (!item || !customizedItem) return null;

  const colorVariants = item.color_variants as string[] | null;
  const material = (customizedItem.material_config || {}) as Record<string, any>;
  const garment = (customizedItem.garment_config || {}) as Record<string, any>;
  const pattern = (customizedItem.pattern_config || {}) as Record<string, any>;
  const fit = (customizedItem.fit_config || {}) as Record<string, any>;
  const wear = (customizedItem.wear_config || {}) as Record<string, any>;
  const detailCount = Array.isArray(customizedItem.detail_layers) ? customizedItem.detail_layers.length : 0;
  const savedVariantKey = variantKeyForPersistence(item, selectedVariant);
  const safeZoneColours = sanitizeClothingZoneColours(item, zoneColours);
  const isEquipped = ownedSkin?.is_equipped === true;

  const handleLiveStatus = (status: RichClothingPreviewStatus) => {
    if (status === 'error' && hasGeneratedTurntable) setPreviewMode('turntable');
  };

  const saveLook = (equipped: boolean | null) => {
    saveMutation.mutate({
      itemId: item.id,
      variantKey: savedVariantKey,
      zoneColours: safeZoneColours,
      equipped,
    });
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.name}
            {item.is_limited_edition && <Sparkles className="h-4 w-4 text-warning" />}
            {isEquipped && <Badge className="ml-1">Equipped</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)] gap-6">
          <div className="space-y-3">
            {hasGeneratedTurntable && <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={previewMode === 'live' ? 'default' : 'outline'} onClick={() => setPreviewMode('live')} className="gap-1.5">
                <Rotate3D className="h-4 w-4" />Live 3D on my avatar
              </Button>
              <Button size="sm" variant={previewMode === 'turntable' ? 'default' : 'outline'} onClick={() => setPreviewMode('turntable')} className="gap-1.5">
                <Images className="h-4 w-4" />Generated 360° item view
              </Button>
            </div>}

            <div className="rounded-xl overflow-hidden border bg-[#101823] min-h-[520px] relative">
              {previewMode === 'turntable' && hasGeneratedTurntable ? (
                <GeneratedTurntablePreview itemName={item.name} manifest={item.preview_manifest} />
              ) : appearance && !avatarLoading ? (
                <RichClothingPreview appearance={appearance} item={customizedItem} variant={previewVariant} onStatusChange={handleLiveStatus} />
              ) : (
                <div className="min-h-[520px] flex items-center justify-center text-sm text-muted-foreground">Preparing your avatar fitting room…</div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              {previewMode === 'turntable' ? (
                <span className="inline-flex items-center gap-1"><Images className="h-3.5 w-3.5" />Drag/swipe across the item or use the controls to rotate through generated angles.</span>
              ) : (
                <span className="inline-flex items-center gap-1"><Rotate3D className="h-3.5 w-3.5" />Drag to rotate 360°, scroll/pinch to zoom, or use the viewer controls.</span>
              )}
              <Badge variant="outline" className="gap-1">{previewMode === 'turntable' ? <Images className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}{previewMode === 'turntable' ? 'Item turntable' : 'Your avatar'}</Badge>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              {previewMode === 'turntable' ? <>
                <strong className="text-foreground">Generated fallback:</strong> these WebP frames show the published default garment. Switch to Live 3D to see your selected variant and personal colour edits.
              </> : <>
                <strong className="text-foreground">Live fitting room:</strong> variant changes and admin-approved colour-zone edits are composed directly onto the garment before it is rendered on your character.
              </>}
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize">{item.wearable_slot || item.category}</Badge>
              <Badge className={rarityColors[item.rarity || "common"]}>{item.rarity || "common"}</Badge>
            </div>

            {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}

            {variants.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Variant</p>
                <Select value={selectedVariant?.id || variants[0]?.id} onValueChange={setVariantId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{variants.map(variant => <SelectItem key={variant.id} value={variant.id}>{variant.label}</SelectItem>)}</SelectContent>
                </Select>
                {selectedVariant && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-5 h-5 rounded-full border" style={{ backgroundColor: previewVariant?.color || selectedVariant.color }} />{selectedVariant.material || material.fabric || 'Default material'}{selectedVariant.pattern && selectedVariant.pattern !== 'solid' ? ` · ${selectedVariant.pattern}` : ''}</div>}
              </div>
            )}

            {variants.length <= 1 && colorVariants && colorVariants.length > 0 && (
              <div><p className="text-sm font-medium mb-2">Available colours</p><div className="flex gap-2 flex-wrap">{colorVariants.map((color, i) => <div key={i} className="w-7 h-7 rounded-full border-2 border-border" style={{ backgroundColor: color }} title={color} />)}</div></div>
            )}

            {editableZones.length > 0 && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm flex items-center gap-2"><Palette className="h-4 w-4" />Personalise colours</div>
                  {Object.keys(zoneColours).length > 0 && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setZoneColours({})}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset all
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Only zones explicitly unlocked by the clothing designer can be changed.</p>
                <div className="space-y-2">
                  {editableZones.map(zone => {
                    const zoneId = String(zone.id);
                    const fallback = typeof zone.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(zone.color) ? zone.color : '#ffffff';
                    const value = zoneColours[zoneId] || fallback;
                    return <div key={zoneId} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                      <div className="min-w-0"><div className="text-sm truncate">{zone.name || zoneId}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{zoneId}</div></div>
                      <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                        <Input
                          type="color"
                          value={value}
                          onChange={event => setZoneColours(current => ({ ...current, [zoneId]: event.target.value.toLowerCase() }))}
                          className="h-7 w-9 border-0 p-0 bg-transparent"
                          aria-label={`${zone.name || zoneId} colour`}
                        />
                        <span className="font-mono text-[10px] text-muted-foreground">{value.toUpperCase()}</span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={!zoneColours[zoneId]}
                        onClick={() => setZoneColours(current => {
                          const next = { ...current };
                          delete next[zoneId];
                          return next;
                        })}
                        aria-label={`Reset ${zone.name || zoneId} colour`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>;
                  })}
                </div>
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-2">
              <div className="font-medium text-sm flex items-center gap-2"><Shirt className="h-4 w-4" />Garment details</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <span className="text-muted-foreground">Fabric</span><span className="capitalize">{selectedVariant?.material || material.fabric || 'standard'}</span>
                <span className="text-muted-foreground">Silhouette</span><span className="capitalize">{garment.silhouette || 'classic'}</span>
                <span className="text-muted-foreground">Fit</span><span className="capitalize">{fit.fit || 'regular'}</span>
                <span className="text-muted-foreground">Pattern</span><span className="capitalize">{selectedVariant?.pattern || pattern.type || 'solid'}</span>
                <span className="text-muted-foreground">Condition</span><span className="capitalize">{wear.condition || 'new'}</span>
                <span className="text-muted-foreground">Details</span><span>{detailCount} layers</span>
              </div>
              {detailCount > 0 && <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground"><Layers3 className="h-3.5 w-3.5" />Patches, trims, studs, zips, badges and other supported layers appear directly on the garment.</div>}
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
                <p className="mt-2 text-xs text-muted-foreground">These bonuses are active only while the item is equipped.</p>
              </div>
            )}

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {item.is_premium && <Lock className="h-4 w-4 text-warning" />}
                  <span className="text-xl font-bold">${item.price?.toLocaleString() || "Free"}</span>
                </div>
                {isOwned && <Badge variant={isEquipped ? 'default' : 'outline'}>{isEquipped ? 'Currently equipped' : 'Owned'}</Badge>}
              </div>

              {isOwned ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={saveMutation.isPending} onClick={() => saveLook(null)} className="gap-2">
                    <Save className="h-4 w-4" />Save look
                  </Button>
                  <Button disabled={saveMutation.isPending} variant={isEquipped ? 'secondary' : 'default'} onClick={() => saveLook(!isEquipped)} className="gap-2">
                    {isEquipped ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    {isEquipped ? 'Unequip' : 'Save & equip'}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => onPurchase(item, { variantKey: savedVariantKey, zoneColours: safeZoneColours })}
                  className="w-full gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />Purchase this look
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
