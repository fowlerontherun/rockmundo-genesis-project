import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { useScheduledActivities } from '@/hooks/useScheduledActivities';
import { ArtworkImage } from '@/components/game-art/GameArtwork';
import { Button } from '@/components/ui/button';
import { activitySceneImage, selectActivityScene } from './activitySceneModel';

export function ActivityScene({ userId }: { userId?: string }) {
  const { profileId } = useActiveProfile();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const schedule = useScheduledActivities(new Date(now), userId);
  useEffect(() => {
    if (!userId || !profileId) return;
    const timer = window.setInterval(() => { if (!document.hidden) void schedule.refetch(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [userId, profileId, schedule.refetch]);
  const selected = selectActivityScene(schedule.data ?? [], profileId ?? '', now);
  if (!userId || !profileId) return null;
  const unavailable = schedule.isError;
  const loading = schedule.isPending;
  const activity = !unavailable && !loading ? selected?.activity : null;
  return <section className="relative isolate overflow-hidden rounded-xl border bg-[#171324] text-white" aria-label="Your day in Rockmundo">
    <ArtworkImage src={`/hub-tiles/${activity ? activitySceneImage(activity.activity_type) : 'current-city'}.png`} className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#171324] via-[#171324]/80 to-transparent" />
    <div className="flex min-h-40 flex-col justify-center gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-purple-200">{unavailable ? 'Schedule unavailable' : loading ? 'Checking your day' : selected?.phase ?? 'Your day'}</p>
        <h2 className="break-words text-xl font-bold sm:text-2xl">{activity?.title ?? (unavailable ? 'Your schedule could not load' : loading ? 'Loading activities…' : 'No more activities scheduled today')}</h2>
        {activity && <p className="text-sm text-white/80">{activity.location && `${activity.location} · `}{format(new Date(activity.scheduled_start), 'EEE HH:mm')}–{format(new Date(activity.scheduled_end), 'EEE HH:mm')}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {unavailable && <Button variant="secondary" onClick={() => void schedule.refetch()}>Retry</Button>}
        <Button asChild><Link to="/schedule">Open schedule</Link></Button>
      </div>
    </div>
  </section>;
}
