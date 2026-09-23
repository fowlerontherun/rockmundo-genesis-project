import { ACCESSORY_COLORS, EARRING_LABELS, EARRING_STYLES, GLASSES_LABELS, GLASSES_STYLES, HAT_LABELS, HAT_STYLES, type PlayerAppearance } from './appearance';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';

export function AccessoryStyling({ appearance, onChange, richClothing = [] }: { appearance: PlayerAppearance; onChange: (next: PlayerAppearance) => void; richClothing?: ResolvedEquippedClothing[] }) {
  const accessories = { hat: 'none', hatColor: '#20232b', glasses: 'none', glassesColor: '#20232b', earrings: 'none', leftEarring: appearance.accessories?.earrings ?? 'none', rightEarring: appearance.accessories?.earrings ?? 'none', earringColor: '#d8ad49', ...(appearance.accessories ?? {}) } as const;
  const edit = (next: Partial<NonNullable<PlayerAppearance['accessories']>>) => onChange({ ...appearance, accessories: { ...accessories, ...next } });
  const colours = (label: string, value: string, change: (value: string) => void) => <div className="player-model-wardrobe__colours" role="group" aria-label={`${label} colours`}>
    {ACCESSORY_COLORS.map(([name, color]) => <button key={color} type="button" title={name} aria-label={`${label} colour: ${name}`} aria-pressed={value === color} style={{ backgroundColor: color }} onClick={() => change(color)} />)}
    <label>Custom<input type="color" aria-label={`${label} colour`} value={value} onChange={event => change(event.target.value)} /></label>
  </div>;

  return <div className="player-model-head player-model-accessories">
    {richClothing.filter(row => ['headwear', 'eyewear'].includes(richGarmentSlot(row.item))).map(row => <p role="status" key={row.item.id} className="player-model-editor__hint">Wearing {row.item.name} from your collection. Remove it below to show the starter choice for that slot.</p>)}
    <label htmlFor="avatar-hat">Hat</label>
    <select id="avatar-hat" value={accessories.hat} onChange={event => edit({ hat: event.target.value as typeof HAT_STYLES[number] })}>
      {HAT_STYLES.map(style => <option key={style} value={style}>{HAT_LABELS[style]}</option>)}
    </select>
    {accessories.hat !== 'none' && colours('Hat', accessories.hatColor, hatColor => edit({ hatColor }))}
    <label htmlFor="avatar-glasses">Glasses</label>
    <select id="avatar-glasses" value={accessories.glasses} onChange={event => edit({ glasses: event.target.value as typeof GLASSES_STYLES[number] })}>
      {GLASSES_STYLES.map(style => <option key={style} value={style}>{GLASSES_LABELS[style]}</option>)}
    </select>
    {accessories.glasses !== 'none' && colours('Glasses', accessories.glassesColor, glassesColor => edit({ glassesColor }))}
    {accessories.glasses !== 'none' && <>
      <label htmlFor="avatar-lens-tint">Lenses</label>
      <select id="avatar-lens-tint" value={accessories.lensTint ?? (accessories.glasses === 'sunglasses' ? 'tinted' : 'clear')} onChange={event => edit({ lensTint: event.target.value as 'clear' | 'tinted' })}>
        <option value="clear">Clear</option><option value="tinted">Tinted</option>
      </select>
      {colours('Lens', accessories.lensColor ?? '#40566d', lensColor => edit({ lensColor }))}
    </>}
    <label htmlFor="avatar-left-earring">Left earring</label>
    <select id="avatar-left-earring" value={accessories.leftEarring ?? accessories.earrings} onChange={event => edit({ leftEarring: event.target.value as typeof EARRING_STYLES[number] })}>
      {EARRING_STYLES.map(style => <option key={style} value={style}>{EARRING_LABELS[style]}</option>)}
    </select>
    <label htmlFor="avatar-right-earring">Right earring</label>
    <select id="avatar-right-earring" value={accessories.rightEarring ?? accessories.earrings} onChange={event => edit({ rightEarring: event.target.value as typeof EARRING_STYLES[number] })}>
      {EARRING_STYLES.map(style => <option key={style} value={style}>{EARRING_LABELS[style]}</option>)}
    </select>
    {((accessories.leftEarring ?? accessories.earrings) !== 'none' || (accessories.rightEarring ?? accessories.earrings) !== 'none') && colours('Earrings', accessories.earringColor, earringColor => edit({ earringColor }))}
    <p className="player-model-editor__hint">Accessories are part of your saved stage appearance, so hats, glasses and each earring follow your character into 3D performances. Hats tuck the crown of your hair; removing a hat restores the saved haircut.</p>
  </div>;
}
