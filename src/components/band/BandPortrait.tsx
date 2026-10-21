import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArtworkImage } from '@/components/game-art/GameArtwork';
const PortraitLineup = lazy(() => import('./PortraitLineup'));
export interface PortraitMember { id: string; profileId: string | null; name: string; instrument: string | null; photoUrl?: string | null }

export function BandPortrait({ bandName, members }: { bandName: string; members: PortraitMember[] }) {
  const [enabled, setEnabled] = useState(false);
  const [backdrop, setBackdrop] = useState('band');
  return <section className="relative isolate overflow-hidden rounded-xl border bg-[#171324] text-white" aria-label="Band portrait">
    <ArtworkImage src={`/hub-tiles/${backdrop}.png`} className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#171324] via-[#171324]/60 to-transparent" />
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-purple-200">The lineup</p><h2 className="break-words text-2xl font-bold">{bandName}</h2></div>
        <label className="text-xs text-white/80">Backdrop<select aria-label="Band portrait backdrop" className="ml-2 rounded border border-white/30 bg-[#24163f] p-2 text-white" value={backdrop} onChange={e => setBackdrop(e.target.value)}><option value="band">Publicity</option><option value="rehearsals">Rehearsal</option><option value="gig-booking">Stage</option></select></label>
      </div>
      {enabled ? <Suspense fallback={<p role="status">Loading portraits…</p>}><PortraitLineup members={members} /></Suspense> : <div className="flex min-h-28 flex-wrap items-center justify-between gap-4">
        <p className="max-w-lg text-sm text-white/80">See your members’ saved avatars, outfits and stage instruments together.</p>
        <Button onClick={() => setEnabled(true)} disabled={!members.length}>Show band portrait</Button>
      </div>}
    </div>
  </section>;
}
