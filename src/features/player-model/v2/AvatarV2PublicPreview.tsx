import { lazy, Suspense, useEffect, useState } from 'react';
import type { AvatarV2Frame } from './avatarV2Contract';
import {
  avatarV2ReferenceImageUrl,
  avatarV2ReferenceManifestUrl,
  avatarV2ReferenceModelUrl,
  parseAvatarV2ReferenceManifest,
  type AvatarV2ReferenceManifest,
  type AvatarV2ReferenceVariant,
  type AvatarV2ReferenceView,
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
          <div className="avatar-v2-public__inspect">
            <button type="button" className="avatar-v2-public__inspect-toggle"
              aria-pressed={show3D} onClick={() => setShow3D(value => !value)}>
              {show3D ? 'Close interactive 3D' : 'Inspect actual V2 in interactive 3D'}
            </button>
            {show3D && (
              <>
                <div className="avatar-v2-public__controls" role="group" aria-label="3D mesh variant">
                  {(['lookdev', 'source'] as const).map(option => (
                    <button key={option} type="button" aria-pressed={variant === option}
                      onClick={() => setVariant(option)}>
                      {option === 'lookdev' ? 'Improved V2 model' : 'Original source model'}
                    </button>
                  ))}
                </div>
                <Suspense fallback={<p role="status">Preparing 3D reference viewer…</p>}>
                  <ReferenceCanvas
                    key={`${frame}-${variant}`}
                    url={avatarV2ReferenceModelUrl(frame, variant)}
                    focus={view === 'face' ? 'face' : 'full'}
                  />
                </Suspense>
              </>
            )}
          </div>
          <p className="avatar-v2-public__disclaimer">
            This is a verified visual preview of the real Blender source, not your saved playable avatar.
            V2 has not yet passed rigging, facial animation, clothing and LOD validation, so
            your live character and gig visuals remain on V1. Appearance controls and Save avatar
            still apply only to your current live character.
            {' '}<a href={GALLERY} target="_blank" rel="noreferrer">View verified source proofs</a>
          </p>
        </>
      )}
    </section>
  );
}
