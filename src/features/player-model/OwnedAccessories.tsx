import { Link } from 'react-router-dom';
import { useClothingItems, useOwnedSkins, useSaveClothingCustomization } from '@/hooks/useSkinStore';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';

/** Inventory actions save immediately, independently of the unsaved starter
 * appearance. Preserve the owned item's existing variant and custom colours. */
export function OwnedAccessories({ profileId }: { profileId: string }) {
  const catalogue = useClothingItems(), owned = useOwnedSkins(), save = useSaveClothingCustomization();
  const items = (catalogue.data ?? []).filter(item => ['headwear', 'eyewear'].includes(richGarmentSlot(item)))
    .flatMap(item => {
      const ownership = owned.data?.find(row => row.item_id === item.id);
      return ownership ? [{ item, ownership }] : [];
    });
  return <div className="player-model-wardrobe" aria-label="Owned accessories">
    <div className="player-model-wardrobe__heading"><h3>Your collection</h3><Link to="/skin-store">Skin Store</Link></div>
    <p className="player-model-editor__hint">Equip and remove collection items immediately. Starter choices above use Save avatar.</p>
    {catalogue.isError || owned.isError ? <p role="alert">Your collection could not load. <button type="button" onClick={() => { void catalogue.refetch(); void owned.refetch(); }}>Try again</button></p>
      : catalogue.isPending || owned.isPending ? <p role="status">Loading your accessories…</p>
      : items.length === 0 ? <p className="player-model-editor__hint">No hats or glasses in your collection yet. You can use any of the free starters above.</p>
      : items.map(({ item, ownership }) => <div className="player-model-accessories__owned" key={item.id}>
        <span>{item.name}</span>
        <button type="button" disabled={save.isPending} onClick={() => save.mutate({ profileId, itemId: item.id, variantKey: ownership.selected_variant_key, zoneColours: ownership.customization_config ?? {}, equipped: !ownership.is_equipped })}>
          {ownership.is_equipped ? 'Remove' : 'Equip'} {item.name}
        </button>
      </div>)}
    {save.isError && <p role="alert">The accessory could not be saved. Please try again.</p>}
  </div>;
}
