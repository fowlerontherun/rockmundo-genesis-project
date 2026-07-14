import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { GigLiveSegment, LiveGigSessionState, LiveIncident, LiveSongResult, TacticalDecision } from '@/utils/gigLive';
import { LiveGigPresentation } from './LiveGigPresentation';

export interface LiveGigTimelineDashboardProps {
  session: LiveGigSessionState;
  segments: GigLiveSegment[];
  songResults: Array<LiveSongResult & { segmentIndex: number; title?: string }>;
  incidents?: LiveIncident[];
  activeDecision?: TacticalDecision | null;
  canDecide?: boolean;
  onSelectDecision?: (optionKey: string) => void;
}

export function LiveGigTimelineDashboard({ session, segments, songResults, incidents = [], activeDecision, canDecide = false, onSelectDecision }: LiveGigTimelineDashboardProps) {
  const resolved = segments.filter((segment) => segment.status === 'resolved').length;
  const progress = segments.length ? Math.round((resolved / segments.length) * 100) : 0;
  const current = segments.find((segment) => segment.segmentIndex === session.currentSegmentIndex) ?? segments.find((segment) => segment.status === 'active') ?? segments.find((segment) => segment.status === 'pending');

  return (
    <div className="space-y-4" aria-live="polite">
      <LiveGigPresentation
        session={session}
        segments={segments}
        songResults={songResults}
        incidents={incidents}
        activeDecision={activeDecision}
        canDecide={canDecide}
        onSelectDecision={onSelectDecision}
      />
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Live gig control room</CardTitle>
            <Badge variant={session.status === 'paused_for_decision' ? 'destructive' : 'default'}>{session.status.split('_').join(' ')}</Badge>
          </div>
          <Progress value={progress} aria-label="Live gig progress" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Metric label="Crowd energy" value={session.crowdEnergy} />
          <Metric label="Fan satisfaction" value={session.fanSatisfaction} />
          <Metric label="Band stamina" value={session.bandStamina} />
          <Metric label="Momentum" value={session.momentum} signed />
          <Metric label="Incident risk" value={session.incidentRisk} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Performance timeline</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {segments.map((segment) => (
              <div key={segment.segmentIndex} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{segment.segmentType.split('_').join(' ')}</div>
                  <div className="text-muted-foreground">{Math.round(segment.plannedDurationSeconds / 60)} min planned</div>
                </div>
                <Badge variant={segment.segmentIndex === current?.segmentIndex ? 'default' : segment.status === 'resolved' ? 'secondary' : 'outline'}>{segment.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {activeDecision ? (
            <Card className="border-amber-400">
              <CardHeader><CardTitle className="text-base">Tactical decision required</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Fallback: {activeDecision.recommendedFallback.split('_').join(' ')}. Window: {Math.round(activeDecision.deadlineSeconds / 60)} min game time.</p>
                {activeDecision.options.map((option) => (
                  <button key={option.key} type="button" disabled={!canDecide} onClick={() => onSelectDecision?.(option.key)} className="w-full rounded-md border p-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60">
                    {option.label}{option.safeFallback ? ' · safe fallback' : ''}
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle className="text-base">Recent highlights</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {songResults.flatMap((result) => result.highlights.map((highlight) => `${result.title ?? 'Song'}: ${highlight}`)).slice(-4).map((highlight) => <p key={highlight}>{highlight}</p>)}
              {incidents.slice(-3).map((incident) => <p key={`${incident.incidentType}-${incident.title}`}>{incident.title}</p>)}
              {songResults.length === 0 && incidents.length === 0 ? <p className="text-muted-foreground">The show is just getting started.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{signed && value > 0 ? '+' : ''}{value}</div>
    </div>
  );
}
