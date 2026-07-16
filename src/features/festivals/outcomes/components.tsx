import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { crowdDisplay } from "./mappers";
import type { FestivalPerformanceEffect, FestivalPerformanceHighlight, FestivalPerformanceOutcome, FestivalSongPerformanceOutcome, FestivalStageCrowdSnapshot } from "./model";

export function FestivalLiveCrowdPanel({ snapshot }: { snapshot?: FestivalStageCrowdSnapshot | null }) {
  if (!snapshot) return <Card><CardHeader><CardTitle>Live crowd</CardTitle></CardHeader><CardContent>No canonical crowd snapshot yet.</CardContent></Card>;
  return <Card><CardHeader><CardTitle>Live crowd</CardTitle></CardHeader><CardContent className="space-y-2"><p>{crowdDisplay(snapshot)}</p><p className="text-sm text-muted-foreground">Excitement {Math.round(snapshot.excitement)} · fatigue {Math.round(snapshot.fatigue)} · safety pressure {Math.round(snapshot.safety_pressure)}</p></CardContent></Card>;
}

export function FestivalSongResultCard({ song }: { song: FestivalSongPerformanceOutcome }) {
  return <Card><CardHeader><CardTitle>Song {song.setlist_position}</CardTitle></CardHeader><CardContent className="space-y-2"><Badge>{song.status}</Badge><p>Quality {Math.round(song.performance_quality)} · crowd response {Math.round(song.crowd_response)}</p><p className="text-sm text-muted-foreground">Retained {song.audience_retained}, gained {song.audience_gained}, lost {song.audience_lost}</p></CardContent></Card>;
}

export function FestivalOutcomeBreakdown({ outcome }: { outcome: FestivalPerformanceOutcome }) {
  return <Card><CardHeader><CardTitle>Performance result</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2"><p>Overall {Math.round(outcome.overall_score)}</p><p>Readiness {Math.round(outcome.readiness_score)}</p><p>Crowd {Math.round(outcome.crowd_connection_score)}</p><p>Professionalism {Math.round(outcome.professionalism_score)}</p><p className="sm:col-span-2 text-sm text-muted-foreground">Financial settlement is pending; effects are recommendations only.</p></CardContent></Card>;
}

export function FestivalHighlightsList({ highlights }: { highlights: FestivalPerformanceHighlight[] }) {
  return <Card><CardHeader><CardTitle>Canonical highlights</CardTitle></CardHeader><CardContent className="space-y-2">{highlights.length === 0 ? <p>No public highlights yet.</p> : highlights.map((h) => <div key={h.id} className="rounded border p-2"><Badge variant={h.is_positive ? "default" : "destructive"}>{h.highlight_type}</Badge><p className="mt-1 text-sm">{h.public_description}</p></div>)}</CardContent></Card>;
}

export function FestivalPendingEffectsList({ effects }: { effects: FestivalPerformanceEffect[] }) {
  return <Card><CardHeader><CardTitle>Pending effects</CardTitle></CardHeader><CardContent className="space-y-2">{effects.map((effect) => <div key={effect.id} className="rounded border p-2"><p className="font-medium">{effect.effect_type}: {effect.proposed_value}</p><p className="text-sm text-muted-foreground">{effect.explanation}</p></div>)}</CardContent></Card>;
}

export function FestivalMobileResultSummary({ outcome, strongestSong, highlight }: { outcome: FestivalPerformanceOutcome; strongestSong?: FestivalSongPerformanceOutcome; highlight?: FestivalPerformanceHighlight }) {
  return <Card className="sm:hidden"><CardHeader><CardTitle>Festival result</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-3xl font-bold">{Math.round(outcome.overall_score)}</p><p>Strongest song: {strongestSong ? `#${strongestSong.setlist_position}` : "pending"}</p><p>Key moment: {highlight?.public_description ?? "No public highlight yet."}</p><p className="text-sm text-muted-foreground">Pending settlement</p></CardContent></Card>;
}
