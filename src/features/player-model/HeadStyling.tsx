import {
  EYE_COLORS,
  EYEBROW_LABELS,
  EYEBROW_STYLES,
  FACE_SHAPE_LABELS,
  FACE_SHAPES,
  FACIAL_HAIR_LABELS,
  FACIAL_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_LABELS,
  HAIR_STYLES,
  SKIN_DETAIL_LABELS,
  SKIN_DETAILS,
  STYLES,
  STYLE_LABELS,
  type PlayerAppearance,
  type Style,
} from './appearance';

export function HeadStyling({ appearance, onChange }: { appearance: PlayerAppearance; onChange: (next: PlayerAppearance) => void }) {
  const head = appearance.head;
  const edit = (next: Partial<PlayerAppearance['head']>) => onChange({ ...appearance, head: { ...head, ...next } });
  const palette = (label: string, value: string, colours: readonly (readonly [string, string])[], change: (color: string) => void) => <div className="player-model-wardrobe__colours" role="group" aria-label={`${label} colours`}>
    {colours.map(([name, color]) => <button key={color} type="button" title={name} aria-label={`${label} colour: ${name}`} aria-pressed={value === color} style={{ backgroundColor: color }} onClick={() => change(color)} />)}
    <label>Custom<input type="color" aria-label={`${label} colour`} value={value} onChange={event => change(event.target.value)} /></label>
  </div>;

  return <div className="player-model-head">
    <label htmlFor="face-shape">Face shape</label>
    <select id="face-shape" value={head.faceShape ?? 'classic'} onChange={event => edit({ faceShape: event.target.value as typeof FACE_SHAPES[number] })}>
      {FACE_SHAPES.map(shape => <option key={shape} value={shape}>{FACE_SHAPE_LABELS[shape]}</option>)}
    </select>

    <label htmlFor="skin-detail">Skin detail</label>
    <select id="skin-detail" value={head.skinDetail ?? 'smooth'} onChange={event => edit({ skinDetail: event.target.value as typeof SKIN_DETAILS[number] })}>
      {SKIN_DETAILS.map(detail => <option key={detail} value={detail}>{SKIN_DETAIL_LABELS[detail]}</option>)}
    </select>

    <label>Eye colour</label>
    {palette('Eye', head.eyeColor ?? '#65442d', EYE_COLORS, eyeColor => edit({ eyeColor }))}

    <label htmlFor="eyebrow-style">Eyebrows</label>
    <select id="eyebrow-style" value={head.eyebrowStyle ?? 'natural'} onChange={event => edit({ eyebrowStyle: event.target.value as typeof EYEBROW_STYLES[number] })}>
      {EYEBROW_STYLES.map(style => <option key={style} value={style}>{EYEBROW_LABELS[style]}</option>)}
    </select>
    <label className="player-model-head__match"><input type="checkbox" checked={head.eyebrowColor === undefined} onChange={event => edit({ eyebrowColor: event.target.checked ? undefined : head.hair })} /> Match eyebrow colour to hair</label>
    {head.eyebrowColor !== undefined && palette('Eyebrow', head.eyebrowColor, HAIR_COLORS, eyebrowColor => edit({ eyebrowColor }))}

    <label htmlFor="hair-style">Hairstyle</label>
    <select id="hair-style" value={head.hairStyle ?? 'original'} onChange={event => edit({ hairStyle: event.target.value as typeof HAIR_STYLES[number] })}>{HAIR_STYLES.map(style => <option key={style} value={style}>{HAIR_LABELS[style]}</option>)}</select>
    {(head.hairStyle ?? 'original') === 'original' && <><label htmlFor="head-style">Original haircut</label><select id="head-style" value={head.style} onChange={event => edit({ style: event.target.value as Style })}>{STYLES.map(style => <option key={style} value={style}>{STYLE_LABELS[style]}</option>)}</select></>}
    {palette('Hair', head.hair, HAIR_COLORS, hair => edit({ hair }))}

    <label htmlFor="facial-hair-style">Facial hair</label>
    <select id="facial-hair-style" value={head.facialHair ?? 'none'} onChange={event => edit({ facialHair: event.target.value as typeof FACIAL_HAIR_STYLES[number] })}>{FACIAL_HAIR_STYLES.map(style => <option key={style} value={style}>{FACIAL_HAIR_LABELS[style]}</option>)}</select>
    {head.facialHair && head.facialHair !== 'none' && <>
      <label className="player-model-head__match"><input type="checkbox" checked={head.facialHairColor === undefined} onChange={event => edit({ facialHairColor: event.target.checked ? undefined : head.hair })} /> Match facial hair colour</label>
      {head.facialHairColor !== undefined && palette('Facial hair', head.facialHairColor, HAIR_COLORS, facialHairColor => edit({ facialHairColor }))}
    </>}
    <p className="player-model-editor__hint">Face shape, eyes, brows, skin detail, hair and facial hair all use the same animated Head rig in the creator and performances. Use Face close-up to inspect the result.</p>
  </div>;
}
