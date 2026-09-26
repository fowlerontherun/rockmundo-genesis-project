import { lazy, Suspense, useEffect, useState } from 'react';
import type { AvatarV2Frame } from './avatarV2Contract';
import './avatar-v2-public.css';
import {
  avatarV2ReferenceImageUrl,
  avatarV2ReferenceManifestUrl,
  avatarV2ReferenceModelUrl,
  avatarV2StarterTeeImageUrl,
  avatarV2StarterTeeModelUrl,
  parseAvatarV2ReferenceManifest,
  type AvatarV2ReferenceManifest,
  type AvatarV2ReferenceVariant,
  type AvatarV2ReferenceView,
  type AvatarV2StarterTeeStyle,
} from './avatarV2ReferencePreview';

const ReferenceCanvas = lazy(() =>
  import('./AvatarV2ReferenceCanvas').then(module => ({ default: module.AvatarV2ReferenceCanvas })),
);

const VIEWS: ReadonlyArray<{ id: AvatarV2ReferenceView; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'quarter', label: 'Three-quarter' },
  { id: 'side', label: 'Side' },
  { id: 'face', label: 'Face detail' },
];
const GALLERY = 'https://github.com/fowlerontherun/rockmundo-genesis-project/tree/avatar-v2-reference-previews';

/**
 * Player-visible look at the REAL V2 source assets, without ever saving,
 * outfitting, animating or routing these unfinished models into live gigs.
 * Only complete, hash-inventoried, explicitly non-production previews appear.
 */
export function AvatarV2PublicPreview({ frame }: { frame: AvatarV2Frame }) {
  const [manifest, setManifest] = useState<AvatarV2ReferenceManifest | null>(null);
  const [status, setStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<AvatarV2ReferenceView>('front');
  const [variant, setVariant] = useState<AvatarV2ReferenceVariant>('lookdev');
  const [show3D, setShow3D] = useState(false);
  const [teeView, setTeeView] = useState<'front' | 'quarter'>('front');
  const [starter3D, setStarter3D] = useState<AvatarV2StarterTeeStyle | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setManifest(null);
    void fetch(avatarV2ReferenceManifestUrl, { signal: controller.signal, cache: 'no-cache' })
      .then(async response => {
        if (!response.ok) throw new Error('Reference source is unavailable');
        const raw: unknown = await response.json();
        const parsed = parseAvatarV2ReferenceManifest(raw);
        if (!parsed) throw new Error('Reference source failed non-production safety verification');
        if (controller.signal.aborted) return;
        setManifest(parsed);
        setStatus('available');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setShow3D(false);
          setStatus('unavailable');
        }
      });
    return () => controller.abort();
  }, [attempt]);

  const frameData = manifest?.frames.find(item => item.frame === frame);
  return (
    <section className="avatar-v2-public" aria-label="Avatar V2 real Blender work-in-progress preview">
      <div className="avatar-v2-public__heading">
        <div>
          <span className="avatar-v2-public__eyebrow">NEXT-GENERATION AVATARS · ACTUAL BLENDER MODELS</span>
          <h3>See the real Avatar V2 progress</h3>
          <p>Compare the actual {frame} source mesh against its improved skin, eye, lip, eyebrow
            and eyelash look. The selected body frame follows your Avatar Creator selection.</p>
        </div>
        <span className="avatar-v2-public__status">Work in progress · Preview only</span>
      </div>
      {status === 'loading' && <p role="status" className="avatar-v2-public__message">Loading verified V2 renders…</p>}
      {status === 'unavailable' && (
        <div className="avatar-v2-public__message" role="status">
          <p>The verified Blender gallery could not be reached, so no placeholder character is being shown as V2.</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry genuine V2 preview</button>
          <a href={GALLERY} target="_blank" rel="noreferrer">View the source previews on GitHub</a>
        </div>
      )}
      {status === 'available' && frameData && (
        <>
          <div className="avatar-v2-public__controls" role="group" aria-label="Preview viewpoint">
            {VIEWS.map(item => (
              <button key={item.id} type="button" aria-pressed={view === item.id}
                onClick={() => setView(item.id)}>{item.label}</button>
            ))}
          </div>
          <div className="avatar-v2-public__compare">
            {(['source', 'lookdev'] as const).map(option => (
              <figure key={option}>
                <img
                  key={`${frame}-${option}-${view}`}
                  src={avatarV2ReferenceImageUrl(frame, option, view)}
                  alt={`${frame} ${option === 'source' ? 'original CC0 body' : 'improved V2 Blender lookdev'} ${view} proof`}
                  loading="lazy"
                  onError={event => {
                    event.currentTarget.alt += ' (image currently unavailable)';
                  }}
                />
                <figcaption>
                  <strong>{option === 'source' ? 'Original real source' : 'Improved V2 lookdev'}</strong>
                  <span>{option === 'source' ? 'Unchanged CC0 body' : 'Actual 3D eye, face and material improvements'}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          {frameData.headMotionEvidence && frameData.headMotion && (
            <div className="avatar-v2-public__experiment">
              <div className="avatar-v2-public__experiment-heading">
                <h4>New: real head-turn and eye-gaze experiment</h4>
                <span>Preliminary weights · Not playable</span>
              </div>
              <img
                key={`${frame}-head-motion-${view}`}
                src={avatarV2ReferenceImageUrl(frame, 'headMotion', view)}
                alt={`${frame} actual V2 Blender head and eye deformation experiment ${view} proof`}
                loading="lazy"
              />
              <p>
                The real Blender body and separate eye meshes are driven by an experimental
                armature. The test measures {(frameData.headMotionEvidence.headMeanDisplacementMm).toFixed(1)} mm
                average head movement while holding the sampled torso near-still.
                These are automated draft weights and unapproved head/neck pivots,
                not finished facial animation, clothing deformation or rigging.
              </p>
              <button type="button" onClick={() => { setVariant('headMotion'); setShow3D(true); }}>
                Inspect the experimental skinned mesh in 3D
              </button>
            </div>
          )}
          {frameData.starterTees && (
            <div className="avatar-v2-public__starter">
              <div className="avatar-v2-public__experiment-heading">
                <div>
                  <h4>Real Starter Wardrobe T-shirt prototypes</h4>
                  <p>Four existing items on the actual {frame} Blender body, not new store purchases.</p>
                </div>
                <span>Source-fitted artist proofs · No live V2 garments yet</span>
              </div>
              <div className="avatar-v2-public__controls" role="group" aria-label="Starter garment proof angle">
                {(['front', 'quarter'] as const).map(angle => (
                  <button key={angle} type="button" aria-pressed={teeView === angle}
                    onClick={() => setTeeView(angle)}>
                    {angle === 'front' ? 'Front' : 'Three-quarter'}
                  </button>
                ))}
              </div>
              <div className="avatar-v2-public__starter-grid">
                {frameData.starterTees.map(tee => (
                  <figure key={tee.style}>
                    <img
                      key={`${frame}-starter-${tee.style}-${teeView}`}
                      loading="lazy"
                      src={avatarV2StarterTeeImageUrl(frame, tee.style, teeView)}
                      alt={`${frame} real sculpt-fitted ${tee.catalogueKey} ${teeView} Blender material proof`}
                    />
                    <figcaption>
                      <strong>{tee.style === 'logo-tee' ? 'Rockmundo Logo Tee'
                        : tee.style === 'plain-black-tee' ? 'Plain Black Tee'
                          : tee.style === 'plain-white-tee' ? 'Plain White Tee'
                            : 'Vintage Charcoal Tee'}</strong>
                      <span>{tee.style === 'logo-tee'
                        ? 'Original Rockmundo brand art on the real curved chest surface'
                        : 'Original item, new real body-conforming source mesh'}</span>
                      <button type="button"
                        onClick={() => setStarter3D(starter3D === tee.style ? null : tee.style)}>
                        {starter3D === tee.style ? 'Close 3D outfit proof' : 'Inspect real dressed source in 3D'}
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              {starter3D && (
                <Suspense fallback={<p role="status">Loading genuine garment reference viewer…</p>}>
                  <ReferenceCanvas
                    key={`${frame}-starter-${starter3D}`}
                    url={avatarV2StarterTeeModelUrl(frame, starter3D)}
                    focus="full"
                  />
                </Suspense>
              )}
              <p>
                These meshes reuse the original four catalogue keys and are physically
                projected onto real Blender source geometry. The original logo uses
                the existing Rockmundo artwork, not floating text. They still need
                artist-authored fabric folds, approved body/garment skinning, four
                distinct performance LODs and collision testing. Your purchased
                V1 clothing and item boosts are unchanged.
              </p>
            </div>
          )}
          <div className="avatar-v2-public__inspect">
            <button type="button" className="avatar-v2-public__inspect-toggle"
              aria-pressed={show3D} onClick={() => setShow3D(value => !value)}>
              {show3D ? 'Close interactive 3D' : 'Inspect actual V2 in interactive 3D'}
            </button>
            {show3D && (
              <>
                <div className="avatar-v2-public__controls" role="group" aria-label="3D mesh variant">
                  {(['lookdev', 'source', ...(frameData.headMotionEvidence ? ['headMotion'] as const : [])] as const).map(option => (
                    <button key={option} type="button" aria-pressed={variant === option}
                      onClick={() => setVariant(option)}>
                      {option === 'lookdev' ? 'Improved V2 model' :
                        option === 'headMotion' ? 'Draft skinned head experiment' : 'Original source model'}
                    </button>
                  ))}
                </div>
                <Suspense fallback={<p role="status">Preparing 3D reference viewer…</p>}>
                  <ReferenceCanvas
                    key={`${frame}-${variant}`}
                    url={avatarV2ReferenceModelUrl(frame, variant)}
                    focus={view === 'face' ? 'face' : 'full'}
                    experimentalRig={variant === 'headMotion'}
                  />
                </Suspense>
              </>
            )}
          </div>
          <p className="avatar-v2-public__disclaimer">
            This is a verified visual preview of the real Blender source, not your saved playable avatar.
            The head-motion experiment has preliminary partial weights and the Starter
            shirt previews have source-fitted fabric surfaces, but V2 has not
            passed full rigging, facial animation, clothing and LOD validation, so
            your live character and gig visuals remain on V1. Appearance controls and Save avatar
            still apply only to your current live character.
            {' '}<a href={GALLERY} target="_blank" rel="noreferrer">View verified source proofs</a>
          </p>
        </>
      )}
    </section>
  );
}
