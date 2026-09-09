import { HAIR_STYLES, HAIR_LABELS, FACIAL_HAIR_STYLES, FACIAL_HAIR_LABELS, HAIR_COLORS, STYLES, STYLE_LABELS, type PlayerAppearance, type Style } from './appearance';

export function HeadStyling({ appearance, onChange }: { appearance: PlayerAppearance; onChange: (next: PlayerAppearance) => void }) {
  const head = appearance.head;
  const edit = (next: Partial<PlayerAppearance['head']>) => onChange({ ...appearance, head: { ...head, ...next } });
  const palette = (label: string, value: string, change: (color: string) => void) => <div className="player-model-wardrobe__colours" role="group" aria-label={`${label} colours`}>
    {HAIR_COLORS.map(([name, color]) => <button key={color} type="button" title={name} aria-label={`${label} colour: ${name}`} aria-pressed={value === color} style={{ backgroundColor: color }} onClick={() => change(color)} />)}
    <label>Custom<input type="color" aria-label={`${label} colour`} value={value} onChange={event => change(event.target.value)} /></label>
  </div>;
  return <div className="player-model-head">
    <label htmlFor="hair-style">Hairstyle</label>
    <select id="hair-style" value={head.hairStyle ?? 'original'} onChange={event => edit({ hairStyle: event.target.value as typeof HAIR_STYLES[number] })}>{HAIR_STYLES.map(style => <option key={style} value={style}>{HAIR_LABELS[style]}</option>)}</select>
    {(head.hairStyle ?? 'original') === 'original' && <><label htmlFor="head-style">Original haircut</label><select id="head-style" value={head.style} onChange={event => edit({ style: event.target.value as Style })}>{STYLES.map(style => <option key={style} value={style}>{STYLE_LABELS[style]}</option>)}</select></>}
    {palette('Hair', head.hair, hair => edit({ hair }))}
    <label htmlFor="facial-hair-style">Facial hair</label>
    <select id="facial-hair-style" value={head.facialHair ?? 'none'} onChange={event => edit({ facialHair: event.target.value as typeof FACIAL_HAIR_STYLES[number] })}>{FACIAL_HAIR_STYLES.map(style => <option key={style} value={style}>{FACIAL_HAIR_LABELS[style]}</option>)}</select>
    {head.facialHair && head.facialHair !== 'none' && <>
      <label className="player-model-head__match"><input type="checkbox" checked={head.facialHairColor === undefined} onChange={event => edit({ facialHairColor: event.target.checked ? undefined : head.hair })} /> Match hair colour</label>
      {head.facialHairColor !== undefined && palette('Facial hair', head.facialHairColor, facialHairColor => edit({ facialHairColor }))}
    </>}
    <p className="player-model-editor__hint">Every style is free and works with either body frame. Use Face close-up to see the details.</p>
  </div>;
}
