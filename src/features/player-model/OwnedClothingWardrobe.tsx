import { Link } from 'react-router-dom';
import { Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClothingItems, useOwnedSkins, useSaveClothingCustomization } from '@/hooks/useSkinStore';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';

export function OwnedClothingWardrobe({ profileId }: { profileId: string }) {
  const catalogue = useClothingItems(), owned = useOwnedSkins(profileId), save = useSaveClothingCustomization();
  const items = (catalogue.data ?? []).filter(item => ['top', 'bottom', 'footwear'].includes(richGarmentSlot(item))).flatMap(item => {
    const ownership = owned.data?.find(row => row.item_type === 'clothing' && row.item_id === item.id);
    return ownership ? [{ item, ownership }] : [];
  });
  return <div className="player-model-wardrobe" aria-label="Owned skin pack clothing">
    <div className="player-model-wardrobe__heading"><h3>Skin pack wardrobe</h3><Button asChild variant="outline" size="sm"><Link to="/skin-store?tab=collections"><Shirt className="mr-1 h-4 w-4" />Skin packs</Link></Button></div>
    {catalogue.isError || owned.isError ? <div role="alert">Clothing could not load.<Button type="button" variant="ghost" onClick={() => { void catalogue.refetch(); void owned.refetch(); }}>Retry</Button></div>
      : catalogue.isPending || owned.isPending ? <p role="status">Loading wardrobe…</p>
      : items.length === 0 ? <p className="text-xs text-muted-foreground">No skin pack clothes owned.</p>
      : items.map(({ item, ownership }) => <div key={item.id} className="flex items-center justify-between gap-2 border-b border-border py-2 text-xs"><span className="min-w-0">{item.name}<span className="block text-muted-foreground">{ownership.is_equipped ? 'Equipped' : 'Owned'}</span></span><Button type="button" size="sm" variant={ownership.is_equipped ? 'secondary' : 'outline'} disabled={save.isPending} onClick={() => save.mutate({ profileId, itemId: item.id, variantKey: ownership.selected_variant_key, zoneColours: ownership.customization_config ?? {}, equipped: !ownership.is_equipped })}>{ownership.is_equipped ? 'Remove' : 'Equip'}</Button></div>)}
    {save.isError && <p role="alert" className="text-xs text-destructive">{save.error.message}</p>}
  </div>;
}