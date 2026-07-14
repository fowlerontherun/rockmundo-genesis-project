import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GigPostConsequencesDTO } from '../types';
function mv(m: any) { return m?.status === 'available' ? (m.value > 0 ? `+${m.value}` : String(m.value)) : '—'; }
export function PostGigConsequencesPanel({ consequences }: { consequences: GigPostConsequencesDTO }) {
  const visible = consequences.consequences.slice(0, 8);
  return <Card>
    <CardHeader><CardTitle>Post-Gig Consequences</CardTitle></CardHeader>
    <CardContent className="space-y-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-4">
        <div><span className="text-muted-foreground">Live rep</span><strong className="block">{mv(consequences.liveReputationDelta)}</strong></div>
        <div><span className="text-muted-foreground">Fans</span><strong className="block">{mv(consequences.fanDelta)}</strong></div>
        <div><span className="text-muted-foreground">Followers</span><strong className="block">{mv(consequences.followerDelta)}</strong></div>
        <div><span className="text-muted-foreground">Demand</span><strong className="block">{mv(consequences.bookingDemandDelta)}</strong></div>
      </div>
      {consequences.processingStatus === 'legacy_missing' ? <p className="text-muted-foreground">This historical gig predates post-gig processing, so no consequences were applied retroactively.</p> : null}
      {visible.length > 0 ? <div className="space-y-2">{visible.map(c => <details key={`${c.key}-${c.targetId ?? 'target'}`} className="rounded-md border p-2"><summary className="cursor-pointer font-medium">{c.category.split('_').join(' ')} · {c.status}{typeof c.deltaValue === 'number' ? ` (${c.deltaValue > 0 ? '+' : ''}${c.deltaValue})` : ''}</summary><p className="mt-1 text-muted-foreground">{c.explanation}</p><p className="mt-1 text-xs text-muted-foreground">Sources: {c.sourceFactors.join(', ') || 'stored result'}</p></details>)}</div> : null}
      <div><h4 className="font-medium">Timeline</h4><ol className="mt-1 list-decimal pl-5 text-muted-foreground">{consequences.timeline.map(step => <li key={step}>{step}</li>)}</ol></div>
      <div><h4 className="font-medium">Next actions</h4><ul className="mt-1 list-disc pl-5 text-muted-foreground">{consequences.nextActions.map(a => <li key={a.key}><a className="underline" href={a.href}>{a.label}</a></li>)}</ul></div>
    </CardContent>
  </Card>;
}
