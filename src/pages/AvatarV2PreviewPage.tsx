import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PersonStanding } from 'lucide-react';
import { FMPageScaffold } from '@/components/fm/FMPageScaffold';
import { AvatarV2PublicPreview } from '@/features/player-model/v2/AvatarV2PublicPreview';
import type { AvatarV2Frame } from '@/features/player-model/v2/avatarV2Contract';

/** Any logged-in player can inspect real source progress, even without a character selected. */
export default function AvatarV2PreviewPage() {
  const [frame, setFrame] = useState<AvatarV2Frame>('masculine');

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
        <AvatarV2PublicPreview frame={frame} />
        <p className="text-center text-sm text-muted-foreground">
          Want to customize your current live character?{' '}
          <Link to="/avatar-designer" className="underline underline-offset-4">Return to Avatar Creator</Link>.
          The work-in-progress V2 meshes are not available for saving or performances yet.
        </p>
      </div>
    </FMPageScaffold>
  );
}
