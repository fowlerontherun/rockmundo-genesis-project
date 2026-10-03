import { merchGarmentColor, merchWearableDonorItem } from './merchWearables';
import { useAvatarMerchWearables } from './useAvatarMerchWearables';

export function BandMerchWardrobe({ profileId }: { profileId: string }) {
  const merch = useAvatarMerchWearables(profileId);
  if (merch.band.isPending || merch.query.isPending) return <p className="player-model-editor__hint">Loading your band merch…</p>;
  if (!merch.band.data) return <p className="player-model-editor__hint">Join an active band to wear its Merch Studio designs.</p>;
  if (merch.query.isError) return <p role="status" className="player-model-editor__hint">Band merch could not be loaded. Your current outfit has not changed.</p>;

  const { designs = [], equippedDesignId } = merch.query.data ?? {};
  if (!designs.length) return <p className="player-model-editor__hint">Your band has no wearable Merch Studio apparel yet. Save a T-shirt, hoodie, long-sleeve or crewneck design in Merch Studio first.</p>;

  return <section className="player-model-wardrobe" aria-label="Band merch">
    <div className="player-model-wardrobe__heading"><h3>Band merch</h3><span>{designs.length} wearable</span></div>
    <p className="player-model-editor__hint">These use the fitted V1 garment shapes; the Merch Studio design supplies the colour and artwork.</p>
    <div className="player-model-wardrobe__grid">
      {designs.map(design => {
        const equipped = equippedDesignId === design.id;
        return <button key={design.id} type="button" aria-pressed={equipped} disabled={merch.equip.isPending} onClick={() => merch.equip.mutate(equipped ? null : design.id)}>
          <span aria-hidden="true" className="player-model-wardrobe__tile fabric-cotton" style={{ color: merchGarmentColor(design) }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 10, lineHeight: 1.05, padding: 6, textAlign: 'center' }}>{design.artwork_url ? 'ART' : design.design_name.slice(0, 12)}</span>
          </span>
          <span>{design.design_name}</span>
          <small>{design.product_type} · {merchWearableDonorItem(design.product_type)?.replace('starter.top.', '').replaceAll('-', ' ')}</small>
        </button>;
      })}
    </div>
    {merch.equip.isError && <p role="alert" className="player-model-editor__error">{merch.equip.error instanceof Error ? merch.equip.error.message : 'Band merch could not be equipped.'}</p>}
  </section>;
}
