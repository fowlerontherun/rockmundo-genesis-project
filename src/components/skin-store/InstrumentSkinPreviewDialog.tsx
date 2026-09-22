import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Guitar, Palette, RotateCcw, Save, ShoppingCart } from 'lucide-react';
import { STAGE_INSTRUMENTS } from '@/features/gig-demo-3d/instrumentCatalog';
import { InstrumentSkinPreview } from '@/features/instrument-skins/InstrumentSkinPreview';
import {
  editableInstrumentSkinZones,
  instrumentSkinVariants,
  resolveInstrumentSkinVisual,
  sanitizeInstrumentZoneColours,
  type InstrumentSkinItem,
} from '@/features/instrument-skins/instrumentSkin';
import type { OwnedSkin } from '@/hooks/useSkinStore';
import { useSaveInstrumentSkinCustomization } from '@/hooks/useSkinStore';

export interface InstrumentSkinPurchaseCustomization {
  variantKey: string | null;
  zoneColours: Record<string, string>;
}

export function InstrumentSkinPreviewDialog({
  item, ownedSkin, onClose, onPurchase,
}: {
  item: InstrumentSkinItem | null;
  ownedSkin?: OwnedSkin | null;
  onClose: () => void;
  onPurchase: (item: InstrumentSkinItem, customization: InstrumentSkinPurchaseCustomization) => void;
}) {
  const saveMutation = useSaveInstrumentSkinCustomization();
  const [variantKey, setVariantKey] = useState('default');
  const [zoneColours, setZoneColours] = useState<Record<string, string>>({});
  const variants = useMemo(() => item ? instrumentSkinVariants(item) : [], [item]);
  const zones = useMemo(() => item ? editableInstrumentSkinZones(item) : [], [item]);

  useEffect(() => {
    if (!item) return;
    const saved = variants.find(variant => variant.id === ownedSkin?.selected_variant_key);
    setVariantKey(saved?.id || variants[0]?.id || 'default');
    setZoneColours(sanitizeInstrumentZoneColours(item, ownedSkin?.customization_config));
  }, [item?.id, ownedSkin?.selected_variant_key, ownedSkin?.customization_config, variants]);

  if (!item) return null;
  const visual = resolveInstrumentSkinVisual(item, variantKey === 'default' ? null : variantKey, zoneColours);
  const safeColours = sanitizeInstrumentZoneColours(item, zoneColours);
  const persistenceKey = variants.length > 1 && variantKey !== 'default' ? variantKey : null;
  const instrumentLabel = STAGE_INSTRUMENTS[item.target_instrument]?.label || item.target_instrument.replaceAll('_', ' ');
  const isOwned = !!ownedSkin;
  const isEquipped = ownedSkin?.is_equipped === true;

  const save = (equipped: boolean | null) => saveMutation.mutate({
    itemId: item.id,
    variantKey: persistenceKey,
    zoneColours: safeColours,
    equipped,
  });

  return <Dialog open={!!item} onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2"><Guitar className="h-5 w-5" />{item.name}{isEquipped && <Badge>Equipped</Badge>}</DialogTitle></DialogHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
        <div className="overflow-hidden rounded-xl border bg-[#101823]"><InstrumentSkinPreview item={item} visual={visual} /></div>
        <div className="space-y-5">
          <div className="flex justify-between gap-2"><Badge variant="outline">{instrumentLabel}</Badge><Badge variant="secondary" className="capitalize">{item.rarity || 'common'}</Badge></div>
          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
          <div className="rounded-lg border p-3 text-sm">
            <div className="font-medium mb-2">Design</div>
            <div className="grid grid-cols-2 gap-2 text-xs"><span className="text-muted-foreground">Pattern</span><span className="capitalize">{visual.designKey.replaceAll('_', ' ')}</span><span className="text-muted-foreground">Instrument</span><span>{instrumentLabel}</span></div>
          </div>
          {variants.length > 1 && <div className="space-y-2">
            <div className="text-sm font-medium">Style / colourway</div>
            <Select value={variantKey} onValueChange={setVariantKey}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{variants.map(variant => <SelectItem key={variant.id} value={variant.id!}>{variant.label}</SelectItem>)}</SelectContent></Select>
          </div>}
          {zones.length > 0 && <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-medium"><Palette className="h-4 w-4" />Personalise finish</div><Button size="sm" variant="ghost" onClick={() => setZoneColours({})}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</Button></div>
            <p className="text-xs text-muted-foreground">Recolour the instrument zones unlocked for this skin. Your saved finish is used on stage.</p>
            {zones.map(zone => {
              const id = String(zone.id);
              const fallback = id === 'body' ? visual.bodyColor : id === 'secondary' ? visual.secondaryColor : id === 'pickguard' ? visual.pickguardColor : id === 'hardware' ? visual.hardwareColor : '#ffffff';
              const value = zoneColours[id] || (typeof zone.color === 'string' ? zone.color : fallback);
              return <div key={id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div><div className="text-sm">{zone.name || id}</div><div className="text-[10px] uppercase text-muted-foreground">{id}</div></div>
                <div className="flex items-center gap-2 rounded-md border px-2 py-1"><Input type="color" className="h-7 w-9 border-0 p-0" value={/^#[0-9a-f]{6}$/i.test(value) ? value : fallback} onChange={event => setZoneColours(current => ({ ...current, [id]: event.target.value.toLowerCase() }))} /><span className="font-mono text-[10px]">{value.toUpperCase()}</span></div>
              </div>;
            })}
          </div>}
          <div className="flex gap-2">
            {[visual.bodyColor, visual.secondaryColor, visual.pickguardColor, visual.hardwareColor].map((colour, index) => <span key={index} className="h-8 w-8 rounded-full border" style={{ backgroundColor: colour }} title={colour} />)}
          </div>
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between"><strong className="text-xl">${Number(item.price || 0).toLocaleString()}</strong>{isOwned && <Badge variant="outline">{isEquipped ? 'Currently equipped' : 'Owned'}</Badge>}</div>
            {isOwned ? <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={saveMutation.isPending} onClick={() => save(null)}><Save className="mr-2 h-4 w-4" />Save finish</Button>
              <Button disabled={saveMutation.isPending} variant={isEquipped ? 'secondary' : 'default'} onClick={() => save(!isEquipped)}>{isEquipped ? <RotateCcw className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}{isEquipped ? 'Unequip' : 'Save & equip'}</Button>
            </div> : <Button className="w-full" onClick={() => onPurchase(item, { variantKey: persistenceKey, zoneColours: safeColours })}><ShoppingCart className="mr-2 h-4 w-4" />Purchase this instrument skin</Button>}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
