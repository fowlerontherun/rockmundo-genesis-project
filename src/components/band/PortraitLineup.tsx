import { useEffect, useMemo, useState } from 'react';
import { useGigPlayerModels } from '@/features/player-model/usePlayerModel';
import { stageAssignment } from '@/features/gig-demo-3d/instrumentCatalog';
import { Button } from '@/components/ui/button';
import { portraitCapture } from './portraitCaptureCache';
import type { PortraitMember } from './BandPortrait';

export default function PortraitLineup({ members }: { members: PortraitMember[] }) {
  const models = useGigPlayerModels(members.flatMap(m => m.profileId ? [m.profileId] : []), true);
  const [attempt, setAttempt] = useState(0);
  const data = models.data;
  const key = useMemo(() => JSON.stringify([members, data, attempt]), [members, data, attempt]);
  const [result, setResult] = useState<{ key: string; images: Record<string, string | null>; done: boolean } | null>(null);
  const hasPlayers = members.some(m => m.profileId);
  useEffect(() => {
    if (!data || models.isError || models.isFetching) return;
    let cancelled = false;
    setResult({ key, images: {}, done: false });
    void (async () => {
      const images: Record<string, string | null> = {};
      for (const member of members) {
        if (cancelled) return;
        const id = member.profileId;
        if (!id) { images[member.id] = null; continue; }
        // A profile photo is truthful historical data, never a fabricated 3D outfit.
        if (!data.appearances[id]) { images[member.id] = data.profilePhotos?.[id] ?? null; continue; }
        const assignment = stageAssignment(member.instrument);
        const instrument = assignment.instrument;
        const crafted = data.luthieryInstruments?.[id]?.find(item => (item.instrumentKind === 'electric_bass' && instrument === 'bass_guitar') || (item.instrumentKind === 'electric_guitar' && instrument === 'electric_guitar')) ?? null;
        try {
          images[member.id] = await portraitCapture({
            appearance: data.appearances[id], role: assignment.role, instrument: instrument ?? undefined,
            richClothing: data.richClothing[id] ?? [], tattoos: data.tattoos?.[id] ?? [],
            merchWearable: data.merchWearables?.[id] ?? null, luthieryInstrument: crafted,
            instrumentSkin: data.instrumentSkins?.[id]?.find(skin => skin.instrumentId === instrument) ?? null,
          }, () => cancelled);
        } catch { images[member.id] = null; }
      }
      if (!cancelled) setResult({ key, images, done: true });
    })();
    return () => { cancelled = true; };
  }, [data, key, members, models.isError, models.isFetching]);
  const current = result?.key === key && !models.isError && !models.isFetching ? result : null;
  const loading = hasPlayers && !models.isError && (!current?.done || models.isFetching);
  const failed = models.isError || (current?.done && members.some(m => m.profileId && data?.appearances[m.profileId] && !current.images[m.id]));
  const missingStage = !models.isError && !!current?.done && members.some(m => m.profileId && !data?.appearances[m.profileId]);
  return <div className="space-y-3">
    {loading && <p role="status" className="text-sm text-white/80">Preparing your saved avatars…</p>}
    <div className="flex snap-x gap-3 overflow-x-auto pb-2">
      {members.map(member => <figure key={member.id} className="w-32 shrink-0 snap-start rounded-lg border border-white/15 bg-black/20 p-2 sm:w-40">
        {current?.images[member.id] ? (
          <img src={current.images[member.id]!}
            alt={data?.appearances[member.profileId ?? ''] ? `${member.name} in their saved outfit` : `${member.name} profile photo (no saved 3D avatar)`}
            className="aspect-[2/3] w-full object-contain"
            onError={event => { event.currentTarget.style.display = 'none'; }}
          />
        ) : <div className="flex aspect-[2/3] items-center justify-center p-3 text-center text-xs text-white/60">{member.profileId && loading ? 'Loading avatar' : 'No portrait available'}</div>}
        <figcaption className="mt-2 break-words text-center text-sm font-semibold">{member.name}
          <span className="block text-xs font-normal text-white/70">{member.instrument || 'Band member'}</span>
          {member.profileId && !data?.appearances[member.profileId] && data?.profilePhotos?.[member.profileId] &&
            <span className="block text-[10px] font-normal text-amber-100">Profile photo · 3D avatar not saved</span>}
        </figcaption>
      </figure>)}
    </div>
    {missingStage && <p role="status" className="text-xs text-amber-100/90">
      Some members have not saved an Avatar V1 appearance. Their existing profile photo is shown when available; otherwise ask them to save a character in the Avatar Editor.
    </p>}
    {failed && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-white/80">Some saved visuals could not load.</p><Button variant="secondary" size="sm" onClick={() => { setAttempt(a => a + 1); void models.refetch(); }}>Retry portraits</Button></div>}
  </div>;
}
