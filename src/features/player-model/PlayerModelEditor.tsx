import { STAGE_INSTRUMENTS, stageAssignment, type InstrumentId } from '@/features/gig-demo-3d/instrumentCatalog';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { useState } from 'react';
import { PlayerModelPreview } from './PlayerModelPreview';
import { useEquippedRichClothing, usePlayerModel, usePlayerStageTattoos } from './usePlayerModel';
import { BODY_MUSCLE_LABELS, BODY_MUSCLE_TYPES, defaultAppearance, SLOTS, STYLES, STYLE_LABELS, type PlayerAppearance, type Style } from './appearance';
import { HeadStyling } from './HeadStyling';
import { AccessoryStyling } from './AccessoryStyling';
import { OwnedAccessories } from './OwnedAccessories';
import { StarterWardrobe } from './StarterWardrobe';
import { OutfitLooks } from './OutfitLooks';
import { BandMerchWardrobe } from './BandMerchWardrobe';
import { useAvatarMerchWearables } from './useAvatarMerchWearables';
import './player-model.css';

const SKIN_COLORS = ['#f3d3b7', '#dfb18c', '#c58c63', '#a96f46', '#805132', '#593a2d', '#382a24'];
const BREAST_SIZE_PRESETS = [
  ['Small', .82],
  ['Medium', 1],
  ['Full', 1.22],
  ['Large', 1.48],
  ['Very large', 1.75],
] as const;
const EDITOR_TABS = ['body', 'head', 'accessories', 'outfit'] as const;
type EditorTab = typeof EDITOR_TABS[number];
const TAB_LABELS: Record<EditorTab, string> = { body: 'Body', head: 'Face & hair', accessories: 'Accessories', outfit: 'Outfit' };
const BASIC_OUTFITS = [
  { id: 'rockmundo', label: 'RockMundo basic', top: ['starter.top.casual', '#eee8db'], bottom: ['starter.bottom.blue-jeans', '#426baa'], footwear: ['starter.footwear.canvas-trainers', '#20232b'] },
  { id: 'all-black', label: 'All black', top: ['starter.top.plain-black', '#20232b'], bottom: ['starter.bottom.black-jeans', '#20232b'], footwear: ['starter.footwear.black-boots', '#20232b'] },
  { id: 'white-tee', label: 'White tee & jeans', top: ['starter.top.plain-white', '#eee8db'], bottom: ['starter.bottom.blue-jeans', '#426baa'], footwear: ['starter.footwear.canvas-trainers', '#eee8db'] },
  { id: 'rehearsal', label: 'Rehearsal', top: ['starter.top.vintage-charcoal', '#657386'], bottom: ['starter.bottom.dark-slim-jeans', '#283954'], footwear: ['starter.footwear.combat-boots', '#20232b'] },
] as const;
export default function PlayerModelEditor() {
  const model = usePlayerModel();
  const richClothing = useEquippedRichClothing(model.profileId);
  const tattoos = usePlayerStageTattoos(model.profileId);
  const merch = useAvatarMerchWearables(model.profileId);
  if (model.isLoading || (model.profileId && model.query.isPending)) return <p role="status" className="p-8">Loading your character’s stage model…</p>;
  if (model.error || model.query.isError) return <div role="alert" className="p-8"><p>Your saved model could not load.</p><button type="button" className="underline" onClick={() => void model.query.refetch()}>Try again</button></div>;
  if (!model.profileId || !model.query.data) return <p className="p-8">Select a character to create a stage model.</p>;
  return <EditorSession key={model.profileId} profileId={model.profileId} initial={model.query.data} model={model} richClothing={richClothing.data ?? []} richClothingError={richClothing.isError} tattoos={tattoos.data ?? []} tattooError={tattoos.isError} merchWearable={merch.query.data?.equipped ?? null} />;
}

function EditorSession({ profileId, initial, model, richClothing, richClothingError, tattoos, tattooError, merchWearable }: { profileId: string; initial: { appearance: PlayerAppearance; revision: number | null }; model: ReturnType<typeof usePlayerModel>; richClothing: ResolvedEquippedClothing[]; richClothingError: boolean; tattoos: import('./tattoos').ResolvedTattooVisual[]; tattooError: boolean; merchWearable: import('./merchWearables').ResolvedMerchWearable | null }) {
  const [draft, setDraft] = useState(initial.appearance), [baseline, setBaseline] = useState(initial), [role, setRole] = useState('other'), [activeTab, setActiveTab] = useState<EditorTab>('body');
  const [feedback, setFeedback] = useState(''), [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline.appearance);
  const change = (next: PlayerAppearance) => { setDraft(next); setFeedback(''); setError(''); };
  const setBody = (value: Partial<PlayerAppearance['body']>) => change({ ...draft, body: { ...draft.body, ...value } });
  const outfit = (style: Style) => change({ ...draft, equipment: { ...draft.equipment, ...Object.fromEntries(SLOTS.map(slot => [slot, { ...draft.equipment[slot], itemId: `starter.${slot}.${style}` }])) } });
  const basicOutfit = (preset: typeof BASIC_OUTFITS[number]) => change({ ...draft, equipment: {
    ...draft.equipment,
    top: { itemId: preset.top[0], color: preset.top[1] },
    bottom: { itemId: preset.bottom[0], color: preset.bottom[1] },
    footwear: { itemId: preset.footwear[0], color: preset.footwear[1] },
  } });
  async function save() {
    setError(''); setFeedback('');
    try { const saved = await model.save.mutateAsync({ profileId, appearance: draft, revision: baseline.revision }); setBaseline(saved); setDraft(saved.appearance); setFeedback('Avatar saved. Your character will wear this look in gig viewers.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Your model could not be saved. Please try again.'); }
  }
  async function reload() {
    const result = await model.query.refetch();
    if (result.data && !result.error) { setBaseline(result.data); setDraft(result.data.appearance); setError(''); setFeedback('Saved model reloaded.'); }
    else setError('Your saved model could not be reloaded. Your edits are still here.');
  }
  return <section className="player-model-editor" aria-label="Full-body avatar creator">
    <div className="player-model-editor__intro"><div><span className="player-model-editor__eyebrow">YOUR LOOK. YOUR STAGE.</span><h2>Create your full-body avatar</h2><p>Shape your face and character, dress them head to toe, add accessories and tattoos, and take the same look on stage.</p></div><span className="player-model-editor__badge">LIVE AVATAR · VERSION 1</span></div>
    <div className="player-model-editor__layout">
      <div className="player-model-editor__showcase">
        <PlayerModelPreview appearance={draft} role={stageAssignment(role).role} instrument={role in STAGE_INSTRUMENTS ? role as InstrumentId : undefined} richClothing={richClothing} tattoos={tattoos} merchWearable={merchWearable} />
        {richClothing.length > 0 && <p className="player-model-editor__hint">Your currently equipped Skin Store clothing is layered over the base avatar and will also appear in 3D gigs.</p>}
        {richClothingError && <p role="status" className="player-model-editor__hint">Your equipped Skin Store clothing could not be loaded; the starter base outfit is shown.</p>}
        {tattoos.length > 0 && <p className="player-model-editor__hint">{tattoos.length} tattoo{tattoos.length === 1 ? '' : 's'} from the Tattoo Parlour {tattoos.length === 1 ? 'is' : 'are'} rendered directly on this stage model.</p>}
        {tattooError && <p role="status" className="player-model-editor__hint">Your tattoo visuals could not be loaded. Your saved tattoos have not been changed.</p>}
        <div className="player-model-editor__preview-role"><label htmlFor="preview-instrument">Try a performance pose</label><select id="preview-instrument" value={role} onChange={event => setRole(event.target.value)}><option value="other">Backstage</option>{Object.entries(STAGE_INSTRUMENTS).map(([id, spec]) => <option key={id} value={id}>{spec.label}</option>)}</select><p>Your band role decides which instrument you play at gigs.</p></div>
      </div>
      <form className="player-model-editor__form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <nav className="player-model-editor__tabs" aria-label="Avatar editing areas">
          {EDITOR_TABS.map(tab => <button key={tab} type="button" className={activeTab === tab ? 'is-active' : ''} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)}>{TAB_LABELS[tab]}</button>)}
        </nav>
        {activeTab === 'body' && <fieldset disabled={model.save.isPending}>
          <legend>01 <span>Body</span></legend>
          <div className="player-model-editor__choices" role="group" aria-label="Body frame">{(['masculine', 'feminine'] as const).map(frame => <button key={frame} type="button" aria-pressed={draft.body.frame === frame} onClick={() => setBody({ frame })}>{frame === 'masculine' ? 'Masculine' : 'Feminine'}</button>)}</div>
          <label className="player-model-editor__range">Height <output>{Math.round(draft.body.height * 178)} cm</output><input type="range" min="0.9" max="1.1" step="0.01" value={draft.body.height} onChange={event => setBody({ height: Number(event.target.value) })} /></label>
          <label className="player-model-editor__range">Build <output>{Math.round(draft.body.build * 100)}%</output><input type="range" min="0.85" max="1.15" step="0.01" value={draft.body.build} onChange={event => setBody({ build: Number(event.target.value) })} /></label>
          {draft.body.frame === 'feminine' && <div className="player-model-editor__body-option">
            <label className="player-model-editor__range">Breast size <output>{Math.round((draft.body.breastSize ?? 1) * 100)}%</output><input type="range" min="0.7" max="1.85" step="0.01" value={draft.body.breastSize ?? 1} onChange={event => setBody({ breastSize: Number(event.target.value) })} /></label>
            <div className="player-model-editor__choices" role="group" aria-label="Breast size presets">
              {BREAST_SIZE_PRESETS.map(([label, value]) => <button key={label} type="button" aria-pressed={Math.abs((draft.body.breastSize ?? 1) - value) < .005} onClick={() => setBody({ breastSize: value })}>{label}</button>)}
            </div>
            <p className="player-model-editor__hint">Upper-body clothing follows this setting in the preview and during gigs.</p>
          </div>}
          <div className="player-model-editor__body-option"><span>Muscle definition</span><div className="player-model-editor__choices" role="group" aria-label="Muscle definition">{BODY_MUSCLE_TYPES.map(muscle => <button key={muscle} type="button" aria-pressed={(draft.body.muscle ?? 'natural') === muscle} onClick={() => setBody({ muscle })}>{BODY_MUSCLE_LABELS[muscle]}</button>)}</div></div>
          <div className="player-model-editor__skin"><span>Skin tone</span><div role="group" aria-label="Skin tones">{SKIN_COLORS.map((color, index) => <button key={color} type="button" aria-label={`Skin tone ${index + 1}`} aria-pressed={draft.body.skin === color} style={{ backgroundColor: color }} onClick={() => setBody({ skin: color })} />)}<input type="color" aria-label="Custom skin tone" value={draft.body.skin} onChange={event => setBody({ skin: event.target.value })} /></div></div>
        </fieldset>}
        {activeTab === 'head' && <fieldset disabled={model.save.isPending}><legend>02 <span>Face & hair</span></legend><HeadStyling appearance={draft} onChange={change} /></fieldset>}
        {activeTab === 'accessories' && <fieldset disabled={model.save.isPending}><legend>03 <span>Accessories</span></legend><AccessoryStyling appearance={draft} onChange={change} richClothing={richClothing} /><OwnedAccessories profileId={profileId} /></fieldset>}
        {activeTab === 'outfit' && <fieldset disabled={model.save.isPending}>
          <legend>04 <span>Outfit</span></legend>
          <h3 className="player-model-editor__section-title">Complete looks</h3>
          <div className="player-model-editor__outfit-presets">{BASIC_OUTFITS.map(preset => <button key={preset.id} type="button" onClick={() => basicOutfit(preset)}>{preset.label}</button>)}</div>
          <h3 className="player-model-editor__section-title">Style presets</h3>
          <div className="player-model-editor__choices" role="group" aria-label="Outfit presets">{STYLES.map(style => <button key={style} type="button" onClick={() => outfit(style)}>{STYLE_LABELS[style]}</button>)}</div>
          <p className="player-model-editor__hint">Starter pieces update the live preview immediately. Equipped Skin Store items remain layered over matching areas.</p>
          <OutfitLooks appearance={draft} onChange={change} />
          {SLOTS.map(slot => <StarterWardrobe key={slot} slot={slot} appearance={draft} onChange={change} />)}
          <BandMerchWardrobe profileId={profileId} />
          <div className="player-model-editor__item"><label htmlFor="instrument-finish">Instrument finish</label><span>Standard</span><input id="instrument-finish" type="color" value={draft.equipment.instrument.color} onChange={event => change({ ...draft, equipment: { ...draft.equipment, instrument: { ...draft.equipment.instrument, color: event.target.value } } })} /></div>
        </fieldset>}
        <div className="player-model-editor__save">
          <div className="player-model-editor__save-state" aria-live="polite">{baseline.revision == null ? 'Create your first saved stage model' : dirty ? 'You have unsaved changes' : 'Your stage model is saved'}</div>
          <button type="submit" className="player-model-editor__primary" disabled={model.save.isPending || (!dirty && baseline.revision != null)}>{model.save.isPending ? 'Saving…' : 'Save avatar'}</button>
          <div className="player-model-editor__secondary"><button type="button" disabled={model.save.isPending || !dirty} onClick={() => change(baseline.appearance)}>Discard edits</button><button type="button" disabled={model.save.isPending} onClick={() => change(defaultAppearance(profileId))}>Starter look</button><button type="button" disabled={model.save.isPending || model.query.isFetching} onClick={() => void reload()}>Reload saved</button></div>
          {feedback && <p role="status" className="player-model-editor__success">{feedback}</p>}{error && <p role="alert" className="player-model-editor__error">{error}</p>}
        </div>
      </form>
    </div>
  </section>;
}
