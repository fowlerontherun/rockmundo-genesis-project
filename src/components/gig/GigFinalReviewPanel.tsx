import { AlertTriangle, CheckCircle2, RefreshCw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { GigForecastSnapshot, ForecastRange } from '@/utils/gigForecast';

const fmtMoney = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtRange = (r: ForecastRange, money = false) => `${money ? fmtMoney(r.low) : r.low}–${money ? fmtMoney(r.high) : r.high}`;
const statusLabel = (s: string) => s.split('_').join(' ');

export function GigFinalReviewPanel({ forecast, loading, onRefresh, onNavigate }: { forecast?: GigForecastSnapshot | null; loading?: boolean; onRefresh?: () => void; onNavigate?: (section: string) => void }) {
  if (loading) return <Card><CardHeader><CardTitle>Final review</CardTitle><CardDescription>Generating the latest pre-gig forecast…</CardDescription></CardHeader><CardContent className="text-sm text-muted-foreground">Checking setlist, crew, equipment, production, soundcheck and finance.</CardContent></Card>;
  if (!forecast) return <Card><CardHeader><CardTitle>Final review</CardTitle><CardDescription>No forecast is available yet.</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={onRefresh}><RefreshCw className="mr-2 h-4 w-4" />Generate forecast</Button></CardContent></Card>;
  const statusVariant = forecast.preparationStatus === 'not_ready' ? 'destructive' : forecast.preparationStatus === 'fully_prepared' ? 'default' : 'outline';
  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Final preparation review</CardTitle><CardDescription>Forecasts are ranges, not guarantees. Updated {new Date(forecast.generatedAt).toLocaleString()}.</CardDescription></div>
        <div className="flex gap-2"><Badge variant={statusVariant as any} className="capitalize">{statusLabel(forecast.preparationStatus)}</Badge><Badge variant="outline" className="capitalize">{forecast.confidence} confidence</Badge><Button variant="ghost" size="sm" onClick={onRefresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Attendance" value={fmtRange(forecast.expectedAttendance)} detail={`Likely ${forecast.expectedAttendance.likely} / ${forecast.expectedAttendance.capacity} (${forecast.expectedAttendance.sellThroughPercent}%)`} />
        <Metric label="Revenue" value={fmtRange(forecast.expectedRevenue.total, true)} detail={`Likely ${fmtMoney(forecast.expectedRevenue.total.likely)}`} />
        <Metric label="Costs" value={fmtMoney(forecast.expectedCosts.total)} detail={`Break-even ${forecast.breakEvenAttendance ?? 'n/a'} attendees`} />
        <Metric label="Profit / loss" value={fmtRange(forecast.expectedProfit, true)} detail={`Likely ${fmtMoney(forecast.expectedProfit.likely)}`} />
        <Metric label="Performance quality" value={fmtRange(forecast.expectedPerformanceQuality)} detail={`${forecast.expectedPerformanceQuality.expectedRating}; likely ${forecast.expectedPerformanceQuality.likely}`} />
        <Metric label="Fan satisfaction" value={fmtRange(forecast.expectedFanSatisfaction)} detail={`Likely ${forecast.expectedFanSatisfaction.likely}`} />
        <Metric label="Crowd energy" value={fmtRange(forecast.expectedCrowdEnergy)} detail={`Open ${forecast.expectedCrowdEnergy.opening.likely}, close ${forecast.expectedCrowdEnergy.closing.likely}`} />
        <Metric label="Readiness" value={`${forecast.readinessScore}`} detail={`${forecast.confidenceScore}% forecast confidence`} />
      </div>
      {forecast.blockingIssues.length > 0 && <div className="rounded-md border border-destructive/40 p-3"><h4 className="mb-2 flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" /> Blocking issues</h4><ul className="list-disc space-y-1 pl-5 text-sm">{forecast.blockingIssues.map((i) => <li key={i}>{i}</li>)}</ul></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <List title="Top strengths" items={forecast.strengths.map(s => ({ key: s.key, title: s.title, text: s.explanation, section: s.linkedPreparationSection, good: true }))} onNavigate={onNavigate} />
        <List title="Top risks" items={forecast.risks.map(r => ({ key: r.key, title: `${r.title} (${r.severity})`, text: r.explanation, section: r.linkedPreparationSection }))} onNavigate={onNavigate} />
      </div>
      <div><h4 className="mb-2 font-medium">Final checklist</h4><div className="grid gap-2 md:grid-cols-2">{forecast.checklist.map(item => <button key={item.key} type="button" onClick={() => item.linkedPreparationSection && onNavigate?.(item.linkedPreparationSection)} className="rounded-md border p-3 text-left text-sm hover:bg-muted/50"><div className="flex items-center justify-between gap-2"><span className="font-medium">{item.label}</span><Badge variant={item.status === 'blocked' ? 'destructive' : item.status === 'complete' ? 'outline' : 'secondary'} className="capitalize">{statusLabel(item.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.explanation}</p></button>)}</div></div>
      {forecast.assumptions.length > 0 && <p className="text-xs text-muted-foreground">Assumptions: {forecast.assumptions.join(' ')}</p>}
    </CardContent>
  </Card>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></div>; }
function List({ title, items, onNavigate }: { title: string; items: Array<{ key: string; title: string; text: string; section?: string; good?: boolean }>; onNavigate?: (section: string) => void }) { return <div><h4 className="mb-2 font-medium">{title}</h4><div className="space-y-2">{items.length === 0 ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">None identified.</p> : items.map(item => <div key={item.key} className="rounded-md border p-3 text-sm"><div className="flex items-start gap-2">{item.good ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />}<div className="flex-1"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.text}</p>{item.section && <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onNavigate?.(item.section!)}>Go to {item.section}</Button>}</div></div></div>)}</div></div>; }
