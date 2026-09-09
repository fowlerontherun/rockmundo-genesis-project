import { useState } from 'react';
import { PlayerModelPreview } from './PlayerModelPreview';
import { usePlayerModel } from './usePlayerModel';
import { defaultAppearance, SLOTS, STARTER_ITEMS, STYLES, STYLE_LABELS, type PlayerAppearance, type Style } from './appearance';
import type { StageRole } from '@/features/gig-demo-3d/liveTypes';
import './player-model.css';

const SKIN_COLORS = ['#f3d3b7', '#dfb18c', '#c58c63', '#a96f46', '#805132', '#593a2d', '#382a24'];
export default function PlayerModelEditor() {
  const model = usePlayerModel();
  if (model.isLoading || (model.profileId && model.query.isPending)) return <p role="status" className="p-8">Loading your character’s stage model…</p>;
  if (model.error || model.query.isError) return <div role="alert" className="p-8"><p>Your saved model could not load.</p><button type="button" className="underline" onClick={() => void model.query.refetch()}>Try again</button></div>;
  if (!model.profileId || !model.query.data) return <p className="p-8">Select a character to create a stage model.</p>;
  return <EditorSession key={model.profileId} profileId={model.profileId} initial={model.query.data} model={model} />;
}

function EditorSession({ profileId, initial, model }: { profileId: string; initial: { appearance: PlayerAppearance; revision: number | null }; model: ReturnType<typeof usePlayerModel> }) {
  const [draft, setDraft] = useState(initial.appearance), [baseline, setBaseline] = useState(initial), [role, setRole] = useState<StageRole>('other');
  const [feedback, setFeedback] = useState(''), [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline.appearance);
  const change = (next: PlayerAppearance) => { setDraft(next); setFeedback(''); setError(''); };
  const setBody = (value: Partial<PlayerAppearance['body']>) => change({ ...draft, body: { ...draft.body, ...value } });
  const outfit = (style: Style) => change({ ...draft, equipment: { ...draft.equipment, ...Object.fromEntries(SLOTS.map(slot => [slot, { ...draft.equipment[slot], itemId: `starter.${slot}.${style}` }])) } });
  async function save() {
    setError(''); setFeedback('');
    try { const saved = await model.save.mutateAsync({ profileId, appearance: draft, revision: baseline.revision }); setBaseline(saved); setDraft(saved.appearance); setFeedback('Stage model saved. Your character will wear this look in gig viewers.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Your model could not be saved. Please try again.'); }
  }
  async function reload() {
    const result = await model.query.refetch();
    if (result.data && !result.error) { setBaseline(result.data); setDraft(result.data.appearance); setError(''); setFeedback('Saved model reloaded.'); }
    else setError('Your saved model could not be reloaded. Your edits are still here.');
  }
  return <section className="player-model-editor" aria-label="Stage model designer">
    <div className="player-model-editor__intro"><div><span className="player-model-editor__eyebrow">YOUR LOOK. YOUR STAGE.</span><h2>Create your stage identity</h2><p>Build a look for this character and see it on stage with your band.</p></div><span className="player-model-editor__badge">STARTER WARDROBE · FREE</span></div>
    <div className="player-model-editor__layout">
      <div className="player-model-editor__showcase">
        <PlayerModelPreview appearance={draft} role={role} />
        <div className="player-model-editor__preview-role"><label htmlFor="preview-instrument">Try a performance pose</label><select id="preview-instrument" value={role} onChange={event => setRole(event.target.value as StageRole)}><option value="other">Backstage</option><option value="vocals">Vocals</option><option value="guitar">Guitar</option><option value="bass">Bass</option><option value="drums">Drums</option><option value="keyboard">Keyboard</option><option value="dj">DJ</option><option value="strings">Strings</option><option value="brass">Brass</option><option value="percussion">Percussion</option></select><p>Your band role decides which instrument you play at gigs.</p></div>
      </div>
      <form className="player-model-editor__form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset disabled={model.save.isPending}>
          <legend>01 <span>Character</span></legend>
          <div className="player-model-editor__choices" role="group" aria-label="Body frame">{(['masculine', 'feminine'] as const).map(frame => <button key={frame} type="button" aria-pressed={draft.body.frame === frame} onClick={() => setBody({ frame })}>{frame === 'masculine' ? 'Masculine' : 'Feminine'}</button>)}</div>
          <label className="player-model-editor__range">Height <output>{Math.round(draft.body.height * 178)} cm</output><input type="range" min="0.9" max="1.1" step="0.01" value={draft.body.height} onChange={event => setBody({ height: Number(event.target.value) })} /></label>
          <label className="player-model-editor__range">Build <output>{Math.round(draft.body.build * 100)}%</output><input type="range" min="0.85" max="1.15" step="0.01" value={draft.body.build} onChange={event => setBody({ build: Number(event.target.value) })} /></label>
          <div className="player-model-editor__skin"><span>Skin tone</span><div role="group" aria-label="Skin tones">{SKIN_COLORS.map((color, index) => <button key={color} type="button" aria-label={`Skin tone ${index + 1}`} aria-pressed={draft.body.skin === color} style={{ backgroundColor: color }} onClick={() => setBody({ skin: color })} />)}<input type="color" aria-label="Custom skin tone" value={draft.body.skin} onChange={event => setBody({ skin: event.target.value })} /></div></div>
          <div className="player-model-editor__item"><label htmlFor="head-style">Hair & head</label><select id="head-style" value={draft.head.style} onChange={event => change({ ...draft, head: { ...draft.head, style: event.target.value as Style } })}>{STYLES.map(style => <option key={style} value={style}>{STYLE_LABELS[style]}</option>)}</select><input type="color" aria-label="Hair colour" value={draft.head.hair} onChange={event => change({ ...draft, head: { ...draft.head, hair: event.target.value } })} /></div>
        </fieldset>
        <fieldset disabled={model.save.isPending}>
          <legend>02 <span>Wardrobe</span></legend>
          <div className="player-model-editor__choices" role="group" aria-label="Outfit presets">{STYLES.map(style => <button key={style} type="button" onClick={() => outfit(style)}>{STYLE_LABELS[style]}</button>)}</div>
          {SLOTS.map(slot => <div className="player-model-editor__item" key={slot}><label htmlFor={`model-${slot}`}>{({ top: 'Top', bottom: 'Trousers', footwear: 'Footwear' })[slot]}</label><select id={`model-${slot}`} value={draft.equipment[slot].itemId} onChange={event => change({ ...draft, equipment: { ...draft.equipment, [slot]: { ...draft.equipment[slot], itemId: event.target.value } } })}>{STARTER_ITEMS[slot].map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input type="color" aria-label={`${slot} colour`} value={draft.equipment[slot].color} onChange={event => change({ ...draft, equipment: { ...draft.equipment, [slot]: { ...draft.equipment[slot], color: event.target.value } } })} /></div>)}
          <div className="player-model-editor__item"><label htmlFor="instrument-finish">Instrument finish</label><span>Standard</span><input id="instrument-finish" type="color" value={draft.equipment.instrument.color} onChange={event => change({ ...draft, equipment: { ...draft.equipment, instrument: { ...draft.equipment.instrument, color: event.target.value } } })} /></div>
          <p className="player-model-editor__hint">Mix individual pieces and colours. Clothing and instrument finishes are cosmetic.</p>
        </fieldset>
        <div className="player-model-editor__save">
          <div className="player-model-editor__save-state" aria-live="polite">{baseline.revision == null ? 'Create your first saved stage model' : dirty ? 'You have unsaved changes' : 'Your stage model is saved'}</div>
          <button type="submit" className="player-model-editor__primary" disabled={model.save.isPending || (!dirty && baseline.revision != null)}>{model.save.isPending ? 'Saving…' : 'Save stage model'}</button>
          <div className="player-model-editor__secondary"><button type="button" disabled={model.save.isPending || !dirty} onClick={() => change(baseline.appearance)}>Discard edits</button><button type="button" disabled={model.save.isPending} onClick={() => change(defaultAppearance(profileId))}>Starter look</button><button type="button" disabled={model.save.isPending || model.query.isFetching} onClick={() => void reload()}>Reload saved</button></div>
          {feedback && <p role="status" className="player-model-editor__success">{feedback}</p>}{error && <p role="alert" className="player-model-editor__error">{error}</p>}
        </div>
      </form>
    </div>
  </section>;
}
