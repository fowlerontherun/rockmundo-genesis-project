import { isDress } from './skirtGeometry';
import { useState } from 'react';
import { garmentCategory } from './wardrobeStyling';
import { Shirt, Footprints } from 'lucide-react';
import { CLOTHING_COLORS, CLOTHING_PATTERNS, type ClothingPattern, LIVE_STARTER_ITEM_IDS, SLOT_LABELS, equipmentItem, starterItemsForWardrobe, type EquipmentSlot, type PlayerAppearance } from './appearance';

const ITEM_DEFAULT_COLOURS: Record<string, string> = {
  'starter.top.plain-black': '#20232b',
  'starter.top.plain-white': '#eee8db',
  'starter.top.vintage-charcoal': '#657386',
  'starter.bottom.blue-jeans': '#426baa',
  'starter.bottom.black-jeans': '#20232b',
  'starter.bottom.dark-slim-jeans': '#283954',
  'starter.footwear.black-boots': '#20232b',
  'starter.footwear.brown-boots': '#ad6241',
};

export function StarterWardrobe({ slot, appearance, onChange, topIsOverridden = false }: { slot: EquipmentSlot; appearance: PlayerAppearance; onChange: (next: PlayerAppearance) => void; topIsOverridden?: boolean }) {
  const [keepColour, setKeepColour] = useState(false);
  const [category, setCategory] = useState('All');
  const equipped = appearance.equipment[slot];
  const items = starterItemsForWardrobe(slot);
  const categories = ['All', ...new Set(items.map(item => garmentCategory(slot, item.id)))];
  const selectedCategory = garmentCategory(slot, equipped.itemId);
  const edit = (value: Partial<typeof equipped>) => onChange({ ...appearance, equipment: { ...appearance.equipment, [slot]: { ...equipped, ...value } } });
  return <div className="player-model-wardrobe" role="group" aria-label={SLOT_LABELS[slot]}>
    <div className="player-model-wardrobe__heading"><h3>{SLOT_LABELS[slot]}</h3><span>{items.length} included</span></div>
    <div className="player-model-wardrobe__filters">
      <label>Item type <select aria-label={`${SLOT_LABELS[slot]} item type`} value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label><input type="checkbox" checked={keepColour} onChange={event => setKeepColour(event.target.checked)} />Keep my colour when switching items</label>
    </div>
    {slot === 'bottom' && !topIsOverridden && isDress(appearance.equipment.top.itemId) && <p>A dress covers your bottoms. Your selection will reappear when you switch to a separate top.</p>}
    {slot === 'top' && !topIsOverridden && isDress(equipped.itemId) && <p>Style applies to the whole dress. Two-tone uses the second colour for the skirt.</p>}
    <div className="player-model-wardrobe__grid">
      {items.filter(item => category === 'All' || garmentCategory(slot, item.id) === category).map(item => <button key={item.id} type="button" aria-pressed={equipped.itemId === item.id} onClick={() => edit({ itemId: item.id, ...(!keepColour && ITEM_DEFAULT_COLOURS[item.id] ? { color: ITEM_DEFAULT_COLOURS[item.id] } : {}) })}>
        <span aria-hidden="true" className={`player-model-wardrobe__tile fabric-${item.fabric}`} style={{ color: item.id === equipped.itemId || keepColour ? equipped.color : ITEM_DEFAULT_COLOURS[item.id] ?? equipped.color }}>
          {/dress|skirt/.test(item.id) ? <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={slot === 'top' ? 'M11 3h3l2 3 2-3h3l-2 11 8 15H5l8-15-2-11Z' : 'M11 7h10l7 22H4L11 7Z'} /><path d="M12 14h8" /></svg> : /vest/.test(item.id) ? <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3h4c0 7 6 7 6 0h4v8l3 18H6l3-18V3Z" /></svg> : slot === 'top' ? <Shirt size={34} strokeWidth={1.5} /> : slot === 'footwear' ? <Footprints size={34} strokeWidth={1.5} /> : <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3h14l2 25h-7l-2-16-2 16H7L9 3Z" /><path d="M9 7h14M16 3v9" /></svg>}
        </span><span>{item.label}</span>
      </button>)}
    </div>
    <p className="player-model-wardrobe__equipped">Selected: {equipmentItem(appearance, slot).label} · {selectedCategory}</p>
    {!LIVE_STARTER_ITEM_IDS.has(equipped.itemId) && <p className="player-model-wardrobe__equipped">This saved item is temporarily shown with a stable V1 fallback until its fitted asset is ready.</p>}
    {selectedCategory !== 'No top' && <div className="player-model-wardrobe__colours" role="group" aria-label={`${SLOT_LABELS[slot]} colours`}>
      {CLOTHING_COLORS.map(([name, color]) => <button key={color} type="button" title={name} aria-label={`${SLOT_LABELS[slot]} colour: ${name}`} aria-pressed={equipped.color === color} style={{ backgroundColor: color }} onClick={() => edit({ color })} />)}
      <label>Custom<input type="color" aria-label={`Custom ${slot} colour`} value={equipped.color} onChange={event => edit({ color: event.target.value })} /></label>
      <label>Pattern<select aria-label={`${slot} pattern`} value={equipped.pattern ?? 'original'} onChange={event => edit({ pattern: event.target.value === 'original' ? undefined : event.target.value as ClothingPattern })}>
        <option value="original">Original design</option>
        {CLOTHING_PATTERNS.map(pattern => <option key={pattern} value={pattern}>{({ solid: 'Solid colour', stripes: 'Stripes', checks: 'Checks', dots: 'Polka dots', 'two-tone': 'Two-tone' })[pattern]}</option>)}
      </select></label>
      {equipped.pattern && equipped.pattern !== 'solid' && <label>Second colour<input type="color" aria-label={`${slot} second colour`} value={equipped.secondaryColor ?? '#eee8db'} onChange={event => edit({ secondaryColor: event.target.value })} /></label>}
    </div>}
  </div>;
}
