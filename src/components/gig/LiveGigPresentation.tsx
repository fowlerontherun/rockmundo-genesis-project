import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { GigLiveSegment, LiveGigSessionState, LiveIncident, LiveSongResult, TacticalDecision } from '@/utils/gigLive';
import { buildLiveGigPresentationState, type LiveGigPerformerInput, type LiveGigProductionInput, type LiveGigSongPresentationInput, type LiveGigVenueInput } from '@/utils/gigLivePresentation';

interface Props {
  session: LiveGigSessionState;
  segments: GigLiveSegment[];
  songResults: Array<LiveSongResult & { segmentIndex: number; title?: string; song?: LiveGigSongPresentationInput }>;
  incidents?: LiveIncident[];
  activeDecision?: TacticalDecision | null;
  canDecide?: boolean;
  onSelectDecision?: (optionKey: string) => void;
  venue?: LiveGigVenueInput | null;
  production?: LiveGigProductionInput | null;
  performers?: LiveGigPerformerInput[];
}

export function LiveGigPresentation({ session, segments, songResults, incidents = [], activeDecision, canDecide = false, onSelectDecision, venue, production, performers = [] }: Props) {
  const [quality, setQuality] = useState<'full' | 'reduced' | 'minimal' | 'data'>('full');
  const current = segments.find((s) => s.segmentIndex === session.currentSegmentIndex) ?? segments.find((s) => s.status === 'active') ?? segments[0];
  const currentSong = current?.songId ? songResults.find((r) => r.segmentIndex === current.segmentIndex)?.song ?? { id: current.songId, title: songResults.find((r) => r.segmentIndex === current.segmentIndex)?.title } : null;
  const presentation = useMemo(() => buildLiveGigPresentationState({ session, segments, songResults, incidents, activeDecision, venue, production, performers, currentSong, reducedMotion: quality !== 'full', dataOnly: quality === 'data' }), [session, segments, songResults, incidents, activeDecision, venue, production, performers, currentSong, quality]);

  return (
    <Card className="overflow-hidden border-primary/30">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl">Live stage presentation</CardTitle>
            <p className="text-sm text-muted-foreground">Server-authoritative concert view · {presentation.stageLayout.split('_').join(' ')} · {presentation.venueTier.split('_').join(' ')}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Presentation quality settings">
            {(['full', 'reduced', 'minimal', 'data'] as const).map((mode) => <Button key={mode} type="button" size="sm" variant={quality === mode ? 'default' : 'outline'} onClick={() => setQuality(mode)}>{mode === 'data' ? 'Data-only' : mode}</Button>)}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{presentation.accessibilitySummary}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {quality !== 'data' ? (
          <div className="relative min-h-[330px] overflow-hidden rounded-2xl border bg-slate-950 text-white shadow-inner" data-scene={presentation.scene}>
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-900 to-black" />
            <div className={`absolute inset-0 opacity-70 ${presentation.lightingState === 'warm_wash' ? 'bg-amber-500/20' : presentation.lightingState === 'cool_wash' ? 'bg-cyan-500/20' : presentation.lightingState === 'failure_state' ? 'bg-red-950/40' : presentation.lightingState.includes('spot') ? 'bg-yellow-200/10' : 'bg-purple-500/10'}`} aria-hidden="true" />
            <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2">
              <Badge>{presentation.scene}</Badge>
              <Badge variant="secondary">{presentation.currentSongProfile.performanceLabel}</Badge>
            </div>
            <div className="absolute left-[8%] right-[8%] top-[24%] h-[44%] rounded-t-[48%] border border-white/15 bg-black/40 shadow-2xl">
              <div className="absolute inset-x-[12%] top-3 h-10 rounded-full bg-white/10 blur-lg" />
              {presentation.activeEffects.map((effect, index) => <span key={effect} className="absolute rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs" style={{ left: `${16 + index * 15}%`, top: `${18 + (index % 2) * 44}%` }}>{effect}</span>)}
              {presentation.performerStates.map((performer) => (
                <div key={performer.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${performer.x}%`, top: `${performer.y}%` }}>
                  <div className={`mx-auto flex h-14 w-10 items-center justify-center rounded-t-full border text-xl shadow-lg ${performer.visualState === 'incident_affected' ? 'border-red-300 bg-red-600/70' : performer.visualState === 'standout_performance' ? 'border-yellow-200 bg-yellow-500/60' : 'border-white/30 bg-slate-700/80'}`} aria-hidden="true">{performer.instrumentLabel.includes('Drum') ? '🥁' : performer.instrumentLabel.includes('Bass') ? '🎸' : performer.instrumentLabel.includes('guitar') ? '🎸' : performer.instrumentLabel.includes('Keyboard') ? '🎹' : performer.instrumentLabel.includes('Microphone') ? '🎤' : '🎵'}</div>
                  <div className="mt-1 max-w-24 rounded bg-black/60 px-1 text-[10px]">{performer.name}<br />{performer.visualState.split('_').join(' ')}</div>
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[28%] border-t border-white/10 bg-gradient-to-t from-black via-slate-900/95 to-transparent">
              <div className="absolute inset-x-3 bottom-3 grid grid-cols-8 gap-1" aria-hidden="true">
                {Array.from({ length: Math.max(2, Math.min(24, Math.round(presentation.crowdDensity / 4))) }).map((_, index) => <div key={index} className={`rounded-t-full bg-white/30 ${quality === 'full' && presentation.intensity > 65 ? 'animate-pulse' : ''}`} style={{ height: index % 3 === 0 ? '3rem' : '2.25rem' }} />)}
              </div>
              <div className="absolute bottom-2 left-4 rounded bg-black/60 px-2 py-1 text-xs">Crowd: {presentation.crowdState.split('_').join(' ')} · density {presentation.crowdDensity}%</div>
            </div>
            <div className="absolute bottom-4 right-4 max-w-xs rounded-lg bg-black/70 p-3 text-sm">
              <div className="font-semibold">{presentation.headline}</div>
              <div className="text-white/75">{presentation.currentSongProfile.genre} · {presentation.currentSongProfile.tempoLabel}</div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Crowd energy" value={session.crowdEnergy} note={presentation.crowdState.split('_').join(' ')} />
          <Metric label="Fan satisfaction" value={session.fanSatisfaction} note={session.fanSatisfaction >= 70 ? 'strong response' : 'building'} />
          <Metric label="Band stamina" value={session.bandStamina} note={session.bandStamina < 30 ? 'fatigue risk' : 'available'} />
          <Metric label="Momentum" value={session.momentum} note={session.momentum >= 0 ? 'positive flow' : 'recovery needed'} signed />
        </div>

        {activeDecision ? (
          <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/20" role="region" aria-label="Tactical decision presentation">
            <div className="font-semibold">Decision open · fallback {activeDecision.recommendedFallback.split('_').join(' ')}</div>
            <p className="text-muted-foreground">Deadline window: {Math.round(activeDecision.deadlineSeconds / 60)} min game time. Visual distraction is reduced while options are available.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {activeDecision.options.map((option) => <Button key={option.key} type="button" variant={option.safeFallback ? 'default' : 'outline'} disabled={!canDecide} onClick={() => onSelectDecision?.(option.key)} aria-label={`${option.label}. ${option.safeFallback ? 'Automatic fallback option.' : 'Tactical option.'}`}>{option.label}</Button>)}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border p-3">
            <h4 className="font-semibold">Visual setlist timeline</h4>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2" role="list" aria-label="Live setlist timeline">
              {segments.map((segment) => <div key={segment.segmentIndex} className="min-w-32 rounded-md border p-2 text-xs" role="listitem"><div className="font-medium">{segment.segmentType.split('_').join(' ')}</div><Badge variant={segment.segmentIndex === current?.segmentIndex ? 'default' : segment.status === 'resolved' ? 'secondary' : 'outline'}>{segment.status}</Badge></div>)}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <h4 className="font-semibold">Live commentary</h4>
            <ul className="mt-2 space-y-2 text-sm" aria-label="Presentation commentary feed">
              {presentation.commentary.slice(-5).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, note, signed = false }: { label: string; value: number; note: string; signed?: boolean }) {
  const pct = signed ? Math.min(100, Math.max(0, 50 + value * 4)) : value;
  return <div className="rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span><span className="font-semibold">{signed && value > 0 ? '+' : ''}{value}</span></div><Progress value={pct} aria-label={label} /><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}
