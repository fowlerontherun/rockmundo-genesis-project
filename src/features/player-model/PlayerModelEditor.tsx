import { STAGE_INSTRUMENTS, stageAssignment, type InstrumentId } from '@/features/gig-demo-3d/instrumentCatalog';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { useState } from 'react';
import { PlayerModelPreview } from './PlayerModelPreview';
import { useEquippedRichClothing, usePlayerModel } from './usePlayerModel';
import { defaultAppearance, SLOTS, STYLES, STYLE_LABELS, type PlayerAppearance, type Style } from './appearance';
import { HeadStyling } from './HeadStyling';
import { StarterWardrobe } from './StarterWardrobe';
import './player-model.css';

const SKIN_COLORS = ['#f3d3b7', '#dfb18c', '#c58c63', '#a96f46', '#805132', '#593a2d', '#382a24'];
export default function PlayerModelEditor() {
  const model = usePlayerModel();
  const richClothing = useEquippedRichClothing(model.profileId);
  if (model.isLoading || (model.profileId && model.query.isPending)) return <p role="status" className="p-8">Loading your character’s stage model…</p>;
  if (model.error || model.query.isError) return <div role="alert" className="p-8"><p>Your saved model could not load.</p><button type="button" className="underline" onClick={() => void model.query.refetch()}>Try again</button></div>;
  if (!model.profileId || !model.query.data) return <p className="p-8">Select a character to create a stage model.</p>;
  return <EditorSession key={model.profileId} profileId={model.profileId} initial={model.query.data} model={model} richClothing={richClothing.data ?? []} richClothingError={richClothing.isError} />;
}

function EditorSession({ profileId, initial, model, richClothing, richClothingError }: { profileId: string; initial: { appearance: PlayerAppearance; revision: number | null }; model: ReturnType<typeof usePlayerModel>; richClothing: ResolvedEquippedClothing[]; richClothingError: boolean }) {
  const [draft, setDraft] = useState(initial.appearance), [baseline, setBaseline] = useState(initial), [role, setRole] = useState('other');
  const [feedback, setFeedback] = useState(''), [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline.appearance);
  const change = (next: PlayerAppearance) => { setDraft(next); setFeedback(''); setError(''); };
  const setBody = (value: Partial<PlayerAppearance['body']>) => change({ ...draft, body: { ...draft.body, ...value } });
  const outfit = (style: Style) => change({ ...draft, equipment: { ...draft.equipment, ...Object.fromEntries(SLOTS.map(slot => [slot, { ...draft.equipment[slot], itemId: `starter.${slot}.${style}` }])) } });
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
    <div className="player-model-editor__intro"><div><span className="player-model-editor__eyebrow">YOUR LOOK. YOUR STAGE.</span><h2>Create your full-body avatar</h2><p>Shape your character, dress them head to toe, and take the same look on stage.</p></div><span className="player-model-editor__badge">18 STARTER PIECES · SKIN STORE LAYERS</span></div>
    <div className="player-model-editor__layout">
      <div className="player-model-editor__showcase">
        <PlayerModelPreview appearance={draft} role={stageAssignment(role).role} instrument={role in STAGE_INSTRUMENTS ? role as InstrumentId : undefined} richClothing={richClothing} />
        {richClothing.length > 0 && <p className="player-model-editor__hint">Your currently equipped Skin Store clothing is layered over the starter base model and will also appear in 3D gigs.</p>}
        {richClothingError && <p role="status" className="player-model-editor__hint">Your equipped Skin Store clothing could not be loaded; the starter base outfit is shown.</p>}
        <div className="player-model-editor__preview-role"><label htmlFor="preview-instrument">Try a performance pose</label><select id="preview-instrument" value={role} onChange={event => setRole(event.target.value)}><option value="other">Backstage</option>{Object.entries(STAGE_INSTRUMENTS).map(([id, spec]) => <option key={id} value={id}>{spec.label}</option>)}</select><p>Your band role decides which instrument you play at gigs.</p></div>
      </div>
      <form className="player-model-editor__form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset disabled={model.save.isPending}>
          <legend>01 <span>Character</span></legend>
          <div className="player-model-editor__choices" role="group" aria-label="Body frame">{(['masculine', 'feminine'] as const).map(frame => <button key={frame} type="button" aria-pressed={draft.body.frame === frame} onClick={() => setBody({ frame })}>{frame === 'masculine' ? 'Masculine' : 'Feminine'}</button>)}</div>
          <label className="player-model-editor__range">Height <output>{Math.round(draft.body.height * 178)} cm</output><input type="range" min="0.9" max="1.1" step="0.01" value={draft.body.height} onChange={event => setBody({ height: Number(event.target.value) })} /></label>
          <label className="player-model-editor__range">Build <output>{Math.round(draft.body.build * 100)}%</output><input type="range" min="0.85" max="1.15" step="0.01" value={draft.body.build} onChange={event => setBody({ build: Number(event.target.value) })} /></label>
          <div className="player-model-editor__skin"><span>Skin tone</span><div role="group" aria-label="Skin tones">{SKIN_COLORS.map((color, index) => <button key={color} type="button" aria-label={`Skin tone ${index + 1}`} aria-pressed={draft.body.skin === color} style={{ backgroundColor: color }} onClick={() => setBody({ skin: color })} />)}<input type="color" aria-label="Custom skin tone" value={draft.body.skin} onChange={event => setBody({ skin: event.target.value })} /></div></div>
          <HeadStyling appearance={draft} onChange={change} />
        </fieldset>
        <fieldset disabled={model.save.isPending}>
          <legend>02 <span>Wardrobe</span></legend>
          <div className="player-model-editor__choices" role="group" aria-label="Outfit presets">{STYLES.map(style => <button key={style} type="button" onClick={() => outfit(style)}>{STYLE_LABELS[style]}</button>)}</div>
          <p className="player-model-editor__hint">These starter pieces form your base outfit. Equipped Skin Store items are layered over matching areas and are managed from the Skin Store.</p>
          {SLOTS.map(slot => <StarterWardrobe key={slot} slot={slot} appearance={draft} onChange={change} />)}
          <div className="player-model-editor__item"><label htmlFor="instrument-finish">Instrument finish</label><span>Standard</span><input id="instrument-finish" type="color" value={draft.equipment.instrument.color} onChange={event => change({ ...draft, equipment: { ...draft.equipment, instrument: { ...draft.equipment.instrument, color: event.target.value } } })} /></div>
          <p className="player-model-editor__hint">Mix starter pieces and colours here. Rich purchased clothing, variants and editable colour zones are managed in the Skin Store.</p>
        </fieldset>
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
