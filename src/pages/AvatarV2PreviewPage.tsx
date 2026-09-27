import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PersonStanding } from 'lucide-react';
import { FMPageScaffold } from '@/components/fm/FMPageScaffold';
import { AvatarV2PublicPreview } from '@/features/player-model/v2/AvatarV2PublicPreview';
import type { AvatarV2Frame } from '@/features/player-model/v2/avatarV2Contract';
import { defaultAppearance, EYE_COLORS } from '@/features/player-model/appearance';

const SKIN_TONES = [
  ['Porcelain', '#f1d5c0'], ['Fair', '#edc7a5'], ['Warm', '#d4a373'],
  ['Olive', '#b88b65'], ['Brown', '#8d5524'], ['Deep', '#593a2d'],
] as const;

/** Any logged-in player can inspect real source progress, even without a character selected. */
export default function AvatarV2PreviewPage() {
  const [frame, setFrame] = useState<AvatarV2Frame>('masculine');
  const [appearance, setAppearance] = useState(() => defaultAppearance('avatar-v2-preview'));
  const updateBody = (key: 'height' | 'build', value: number) =>
    setAppearance(current => ({ ...current, body: { ...current.body, [key]: value } }));

  return (
    <FMPageScaffold
      title="Avatar V2 Preview"
      subtitle="Explore genuine next-generation avatar development — not a playable model yet."
      icon={PersonStanding}
      backTo="/hub/character"
    >
      <div className="mx-auto w-full max-w-5xl space-y-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-slate-950/80 p-4 text-sm">
          <div>
            <h2 className="font-semibold">Choose a body frame</h2>
            <p className="mt-1 text-slate-300">Inspect genuine Blender renders and rotate both source and improved 3D models.</p>
          </div>
          <div role="group" aria-label="Avatar V2 body frame" className="flex flex-wrap gap-2">
            {(['masculine', 'feminine'] as const).map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={frame === value}
                onClick={() => setFrame(value)}
                className={`rounded-lg border px-4 py-2 capitalize transition-colors ${frame === value ? 'border-teal-300 bg-teal-900/60 text-teal-100' : 'border-slate-500 text-slate-200 hover:bg-slate-700'}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <section className="rounded-xl border border-teal-500/30 bg-slate-950/80 p-4" aria-label="Experimental Avatar Creator controls">
          <h3 className="font-semibold">Avatar Creator · V2 body preview</h3>
          <p className="mt-1 text-sm text-slate-300">Try body proportions on the real 3D source. These controls are experimental, do not save and do not affect the fixed Blender comparison renders.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(['height', 'build'] as const).map(key => (
              <label key={key} className="flex flex-col gap-2 text-sm capitalize">
                <span>{key} · {Math.round(appearance.body[key] * 100)}%</span>
                <input type="range" min={key === 'height' ? .9 : .85} max={key === 'height' ? 1.1 : 1.15}
                  step=".01" value={appearance.body[key]}
                  onChange={event => updateBody(key, Number(event.target.value))}
                  aria-label={`Preview body ${key}`} />
              </label>
            ))}
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Experimental skin tone · recognised skin materials only</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {SKIN_TONES.map(([label, color]) => (
                <button key={color} type="button" aria-label={`${label} skin tone`}
                  aria-pressed={appearance.body.skin === color}
                  title={label}
                  onClick={() => setAppearance(current => ({ ...current, body: { ...current.body, skin: color } }))}
                  className={`h-10 w-10 rounded-full border-2 ${appearance.body.skin === color ? 'border-teal-300 ring-2 ring-teal-400/60' : 'border-slate-400'}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">If the source GLB has no separately labelled skin material, the model remains unchanged.</p>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Eye colour · genuine Blender iris surfaces</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {EYE_COLORS.map(([label, color]) => (
                <button key={color} type="button" aria-label={`${label} eyes`}
                  aria-pressed={appearance.head.eyeColor === color} title={label}
                  onClick={() => setAppearance(current => ({ ...current, head: { ...current.head, eyeColor: color } }))}
                  className={`h-10 w-10 rounded-full border-2 ${appearance.head.eyeColor === color ? 'border-teal-300 ring-2 ring-teal-400/60' : 'border-slate-400'}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
          </fieldset>
          <button type="button" className="mt-4 rounded border px-3 py-2 text-sm" onClick={() => setAppearance(defaultAppearance('avatar-v2-preview'))}>
            Reset preview proportions
          </button>
        </section>
        <AvatarV2PublicPreview frame={frame} appearance={{ ...appearance, body: { ...appearance.body, frame } }} />
        <p className="text-center text-sm text-muted-foreground">
          Want to customize your current live character?{' '}
          <Link to="/avatar-designer" className="underline underline-offset-4">Return to Avatar Creator</Link>.
          The work-in-progress V2 meshes are not available for saving or performances yet.
        </p>
      </div>
    </FMPageScaffold>
  );
}
