import { Shirt, Footprints } from 'lucide-react';
import { CLOTHING_COLORS, SLOT_LABELS, STARTER_ITEMS, equipmentItem, type EquipmentSlot, type PlayerAppearance } from './appearance';

export function StarterWardrobe({ slot, appearance, onChange }: { slot: EquipmentSlot; appearance: PlayerAppearance; onChange: (next: PlayerAppearance) => void }) {
  const equipped = appearance.equipment[slot];
  const edit = (value: Partial<typeof equipped>) => onChange({ ...appearance, equipment: { ...appearance.equipment, [slot]: { ...equipped, ...value } } });
  return <div className="player-model-wardrobe" role="group" aria-label={SLOT_LABELS[slot]}>
    <div className="player-model-wardrobe__heading"><h3>{SLOT_LABELS[slot]}</h3><span>6 included</span></div>
    <div className="player-model-wardrobe__grid">
      {STARTER_ITEMS[slot].map(item => <button key={item.id} type="button" aria-pressed={equipped.itemId === item.id} onClick={() => edit({ itemId: item.id })}>
        <span aria-hidden="true" className={`player-model-wardrobe__tile fabric-${item.fabric}`} style={{ color: equipped.color }}>
          {slot === 'top' ? <Shirt size={34} strokeWidth={1.5} /> : slot === 'footwear' ? <Footprints size={34} strokeWidth={1.5} /> : <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3h14l2 25h-7l-2-16-2 16H7L9 3Z" /><path d="M9 7h14M16 3v9" /></svg>}
        </span><span>{item.label}</span>
      </button>)}
    </div>
    <p className="player-model-wardrobe__equipped">Selected: {equipmentItem(appearance, slot).label}</p>
    <div className="player-model-wardrobe__colours" role="group" aria-label={`${SLOT_LABELS[slot]} colours`}>
      {CLOTHING_COLORS.map(([name, color]) => <button key={color} type="button" title={name} aria-label={`${SLOT_LABELS[slot]} colour: ${name}`} aria-pressed={equipped.color === color} style={{ backgroundColor: color }} onClick={() => edit({ color })} />)}
      <label>Custom<input type="color" aria-label={`Custom ${slot} colour`} value={equipped.color} onChange={event => edit({ color: event.target.value })} /></label>
    </div>
  </div>;
}
