import { ACCESSORY_COLORS, GLASSES_LABELS, GLASSES_STYLES, HAT_LABELS, HAT_STYLES, type PlayerAppearance } from './appearance';

export function AccessoryStyling({ appearance, onChange }: { appearance: PlayerAppearance; onChange: (next: PlayerAppearance) => void }) {
  const accessories = appearance.accessories ?? { hat: 'none', hatColor: '#20232b', glasses: 'none', glassesColor: '#20232b' };
  const edit = (next: Partial<NonNullable<PlayerAppearance['accessories']>>) => onChange({ ...appearance, accessories: { ...accessories, ...next } });
  const colours = (label: string, value: string, change: (value: string) => void) => <div className="player-model-wardrobe__colours" role="group" aria-label={`${label} colours`}>
    {ACCESSORY_COLORS.map(([name, color]) => <button key={color} type="button" title={name} aria-label={`${label} colour: ${name}`} aria-pressed={value === color} style={{ backgroundColor: color }} onClick={() => change(color)} />)}
    <label>Custom<input type="color" aria-label={`${label} colour`} value={value} onChange={event => change(event.target.value)} /></label>
  </div>;

  return <div className="player-model-head player-model-accessories">
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
    <p className="player-model-editor__hint">Accessories are part of your saved stage appearance, so the same hat and glasses follow your character into 3D performances.</p>
  </div>;
}
