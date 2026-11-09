import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { listTourProposals, respondTourProposal, type TourProposal } from './completionApi';
const stateLabels: Record<string, string> = { cancelled: 'Cancelled', completed: 'Completed', pending: 'Awaiting reply', accepted: 'Confirmed', declined: 'Declined', withdrawn: 'Withdrawn', expired: 'Expired', changed: 'Dates changed' };
const stateMessages: Record<string, string> = {
  pending: 'Review all dates before accepting this itinerary.',
  accepted: 'The itinerary is confirmed. Check each date’s status and arrange travel.',
  declined: 'The invited band declined this itinerary. The dates are available for another invitation.',
  withdrawn: 'The headliner withdrew this itinerary. Its pending dates have been released.',
  expired: 'The reply deadline has passed. The headliner can send a new invitation.',
  changed: 'A date was removed or changed. Remaining pending dates have been released. Unchanged confirmed dates remain booked.',
};
type Filter = 'all' | 'reply' | 'sent' | 'confirmed' | 'past';
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All proposals' }, { id: 'reply', label: 'Awaiting your reply' },
  { id: 'sent', label: 'Sent invitations' }, { id: 'confirmed', label: 'Confirmed tours' }, { id: 'past', label: 'Past proposals' },
];
function effectiveState(p: TourProposal, now: number) {
  return p.display_status === 'pending' && new Date(p.expires_at).getTime() <= now ? 'expired' : p.display_status;
}
function upcoming(p: TourProposal, now: number) {
  return p.itinerary.some(date => (date.scheduled_end ? new Date(date.scheduled_end).getTime() : new Date(date.scheduled_date).getTime() + 3*60*60*1000) > now);
}
function Itinerary({ proposal, state }: { proposal: TourProposal; state: string }) {
  return <ol aria-label="Proposed tour dates" className="grid gap-3 md:grid-cols-2">{proposal.itinerary.map((date, index) => {
    const stored = proposal.slot_statuses?.[date.slot_id] ?? state;
    const status = state === 'expired' && stored === 'pending' ? 'expired' : stored;
    return <li key={date.gig_id} className="min-w-0 space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><time className="font-medium" dateTime={date.scheduled_date}>{new Date(date.scheduled_date).toLocaleString()}</time><Badge variant="outline">{stateLabels[status] ?? status}</Badge></div>
      <p className="text-xs text-muted-foreground">{date.scheduled_end ? `Ends ${new Date(date.scheduled_end).toLocaleString()}` : 'Approximately 3 hours'}</p>
      <p className="break-words text-sm">{date.venue_name} · {date.city_name}</p>
      <dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Support share</dt><dd>{Math.round(date.revenue_share * 100)}% ticket revenue</dd></div><div><dt className="text-xs text-muted-foreground">Travel from previous date</dt><dd>{index === 0 ? 'Plan arrival' : `${date.travel_minutes_from_previous} minutes`}</dd></div></dl>
    </li>;
  })}</ol>;
}
export function TourProposalsPanel({ bandId, tourId }: { bandId: string; tourId?: string }) {
  const client = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const proposals = useQuery({ queryKey: ['support-tour-proposals', bandId], queryFn: () => listTourProposals(bandId), refetchInterval: 30_000 });
  const response = useMutation({ mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' | 'withdraw' }) => respondTourProposal(id, action),
    onSettled: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['support-tour-proposals'] }), client.invalidateQueries({ queryKey: ['tour-support-assignments'] }), client.invalidateQueries({ queryKey: ['tour-support-candidates'] }), client.invalidateQueries({ queryKey: ['tour-support-show-candidates'] })]); } });
  const now = Date.now();
  const scoped = (proposals.data ?? []).filter(p => !tourId || p.tour_id === tourId);
  const matches = (p: TourProposal, value: Filter) => {
    const state = effectiveState(p, now);
    if (value === 'all') return true;
    if (value === 'reply') return state === 'pending' && p.support_band_id === bandId;
    if (value === 'sent') return state === 'pending' && p.headliner_band_id === bandId;
    if (value === 'confirmed') return state === 'accepted' && upcoming(p, now);
    return state !== 'pending' && (state !== 'accepted' || !upcoming(p, now));
  };
  const priority = (p: TourProposal) => matches(p, 'reply') ? 0 : matches(p, 'sent') ? 1 : matches(p, 'confirmed') ? 2 : 3;
  const visible = scoped.filter(p => matches(p, filter)).filter(p => [p.tour_name, p.headliner_name, p.support_name, ...p.itinerary.flatMap(date => [date.city_name, date.venue_name])].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a,b) => priority(a)-priority(b) || (priority(a)<2 ? new Date(a.expires_at).getTime()-new Date(b.expires_at).getTime() : 0));
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Tour proposals</h3><Button size="sm" variant="outline" disabled={proposals.isFetching} onClick={() => void proposals.refetch()}>Refresh proposals</Button></div>
    {proposals.isPending && <p>Loading proposals…</p>}
    {proposals.isError && <p role="alert">Proposals could not be loaded. <Button onClick={() => void proposals.refetch()}>Retry proposals</Button></p>}
    {scoped.length > 0 && <>
      <div className="flex flex-wrap gap-2" aria-label="Filter tour proposals">{filters.map(item => <Button key={item.id} size="sm" variant={filter === item.id ? 'default' : 'outline'} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label} <span className="ml-1 rounded bg-background/20 px-1.5 tabular-nums">{scoped.filter(p => matches(p,item.id)).length}</span></Button>)}</div>
      <Input aria-label="Search tour proposals" placeholder="Search by band, tour, city or venue…" value={search} onChange={event => setSearch(event.target.value)} />
    </>}
    {response.isError && <p role="alert">The proposal could not be confirmed. Dates, availability or travel may have changed. Review the refreshed itinerary before retrying.</p>}
    {response.isSuccess && <p role="status">Proposal status: {stateLabels[response.data] ?? response.data}</p>}
    {visible.map(p => {
      const state = effectiveState(p,now);
      const expanded = state === 'pending' || (state === 'accepted' && upcoming(p,now));
      const hoursLeft = Math.ceil((new Date(p.expires_at).getTime()-now)/3600000);
      return <article key={p.id} className="min-w-0 space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words font-semibold">{p.tour_name}</h4><p className="break-words text-sm text-muted-foreground">{p.headliner_name} with {p.support_name} · {p.itinerary.length} {p.itinerary.length === 1 ? 'date' : 'dates'}</p></div><Badge variant={state === 'accepted' ? 'default' : 'outline'}>{stateLabels[state] ?? state}</Badge></div>
        <p className="text-sm">{stateMessages[state]}</p>
        <p className="text-sm">Response deadline: <time dateTime={p.expires_at}>{new Date(p.expires_at).toLocaleString()}</time>{state === 'pending' && hoursLeft <= 24 && <strong className="ml-2 text-amber-600">Less than {Math.max(1,hoursLeft)} {hoursLeft <= 1 ? 'hour' : 'hours'} left</strong>}</p>
        {p.note && <p className="whitespace-pre-wrap break-words rounded bg-muted/30 p-3 text-sm">{p.note}</p>}
        {expanded ? <Itinerary proposal={p} state={state} /> : <details><summary className="cursor-pointer py-2 text-sm font-medium">View {p.itinerary.length} {p.itinerary.length === 1 ? 'date' : 'dates'}</summary><Itinerary proposal={p} state={state} /></details>}
        <p className="text-xs text-muted-foreground">Times use your device’s timezone. Travel is rechecked on acceptance. Book your members’ travel and return journey separately.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {state === 'pending' && (p.support_band_id === bandId ? <>
            <Button disabled={response.isPending} onClick={() => response.mutate({ id:p.id,action:'accept' })}>Accept itinerary</Button>
            <Button variant="outline" disabled={response.isPending} onClick={() => response.mutate({ id:p.id,action:'decline' })}>Decline itinerary</Button>
          </> : <Button variant="outline" disabled={response.isPending} onClick={() => response.mutate({ id:p.id,action:'withdraw' })}>Withdraw proposal</Button>)}
          {p.headliner_band_id === bandId && state === 'expired' && Object.values(p.slot_statuses ?? {}).includes('pending') && <Button variant="outline" disabled={response.isPending} onClick={() => response.mutate({ id:p.id,action:'withdraw' })}>Release expired dates</Button>}
          <Button asChild variant="secondary"><a href={`/tour-manager?tour=${p.tour_id}`}>Open tour</a></Button><Button asChild variant="outline"><a href="/travel">Plan travel and return</a></Button>
        </div>
      </article>;
    })}
    {proposals.isSuccess && !scoped.length && <p className="text-sm text-muted-foreground">No tour proposals yet. Invite a band from a booked tour, or mark your band open to touring to be discovered.</p>}
    {proposals.isSuccess && scoped.length > 0 && !visible.length && <div className="rounded-lg border border-dashed p-4 text-sm"><p>No proposals match this view.</p><Button variant="outline" className="mt-2" onClick={() => { setFilter('all'); setSearch(''); }}>Show all proposals</Button></div>}
  </section>;
}
