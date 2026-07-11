import { AlertTriangle, CheckCircle2, Clock, DollarSign, ShieldAlert, Sparkles, Users, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PreshowIncident, PreshowSessionStatus } from '@/utils/gigPreshow';

const categoryIcon = { equipment: Wrench, crew: Users, performer: Users, production: Sparkles, venue: ShieldAlert, commercial: DollarSign, media_social: Sparkles, crowd_safety: ShieldAlert } as const;
const severityVariant = (severity: string) => severity === 'critical' || severity === 'major' ? 'destructive' : severity === 'moderate' ? 'secondary' : 'outline';

export interface GigPreshowDashboardProps { status: PreshowSessionStatus; venueName: string; performanceTime: string; readinessScore: number; forecastSummary: string; incidents: PreshowIncident[]; resolvedIncidents?: PreshowIncident[]; canDecide: boolean; onSelectOption?: (incidentId: string, optionKey: string) => void }

export function GigPreshowDashboard({ status, venueName, performanceTime, readinessScore, forecastSummary, incidents, resolvedIncidents = [], canDecide, onSelectOption }: GigPreshowDashboardProps) {
  const active = incidents.filter((incident) => incident.status === 'awaiting_decision' || incident.status === 'open');
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Backstage pre-show</CardTitle>
              <CardDescription>{venueName} · {new Date(performanceTime).toLocaleString()}</CardDescription>
            </div>
            <Badge variant={status === 'awaiting_decision' || active.length ? 'destructive' : 'outline'}>{status.replace(/_/g, ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Final readiness</p><p className="text-2xl font-semibold">{readinessScore}%</p></div>
          <div className="rounded-md border p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Forecast</p><p className="text-sm">{forecastSummary}</p></div>
        </CardContent>
      </Card>

      {active.length === 0 ? <Card><CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" /> No active backstage decisions. The gig will continue automatically if nobody is online.</CardContent></Card> : active.map((incident) => {
        const Icon = categoryIcon[incident.category];
        return <Card key={incident.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5" /> {incident.title}</CardTitle><CardDescription>{incident.description}</CardDescription></div>
              <div className="flex gap-2"><Badge variant="outline">{incident.category.replace(/_/g, ' ')}</Badge><Badge variant={severityVariant(incident.severity) as any}>{incident.severity}</Badge></div>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Decision deadline {new Date(incident.decisionDeadline).toLocaleString()}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">{incident.affectedSystems.map((system) => <Badge key={system} variant="secondary">{system.replace(/_/g, ' ')}</Badge>)}</div>
            <div className="grid gap-3 md:grid-cols-2">{incident.options.map((option) => {
              const locked = Boolean(option.unavailableReason) || !canDecide;
              return <div key={option.key} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{option.label}</p><p className="text-sm text-muted-foreground">{option.description}</p></div>{option.costPreview ? <Badge variant="outline">${option.costPreview}</Badge> : null}</div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{option.requirements.map((r) => <li key={r}>{r}</li>)}<li>{option.timeRequiredMinutes} minute(s)</li>{option.skillCheck ? <li>{option.skillCheck.finalChance}% success chance after preparation and skill modifiers</li> : null}</ul>
                {option.unavailableReason ? <p className="mt-2 flex gap-1 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" />{option.unavailableReason}</p> : null}
                <Button className="mt-3 w-full" variant={option.requiresConfirmation ? 'default' : 'outline'} disabled={locked} onClick={() => onSelectOption?.(incident.id, option.key)}>{option.requiresConfirmation ? 'Review and confirm' : 'Choose option'}</Button>
              </div>;
            })}</div>
          </CardContent>
        </Card>;
      })}

      {resolvedIncidents.length > 0 ? <Card><CardHeader><CardTitle className="text-base">Backstage history</CardTitle></CardHeader><CardContent className="space-y-2">{resolvedIncidents.map((incident) => <div key={incident.id} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>{incident.title}</span><Badge variant="outline">{incident.status}</Badge></div>)}</CardContent></Card> : null}
    </div>
  );
}
