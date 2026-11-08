import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listTourProposals, respondTourProposal } from './completionApi';
const stateLabels: Record<string, string> = { cancelled: 'Cancelled', completed: 'Completed', pending: 'Awaiting reply', accepted: 'Confirmed', declined: 'Declined', withdrawn: 'Withdrawn', expired: 'Expired', changed: 'Dates changed' };
const stateMessages: Record<string, string> = {
  pending: 'Review all dates before accepting this itinerary.',
  accepted: 'The itinerary is confirmed. Check your member schedules and arrange travel.',
  declined: 'The invited band declined this itinerary. The dates are available for another invitation.',
  withdrawn: 'The headliner withdrew this itinerary. Its pending dates have been released.',
  expired: 'The reply deadline has passed. The headliner can send a new invitation.',
  changed: 'A date was removed or changed. Remaining pending dates have been released. Unchanged confirmed dates remain booked.',
};
export function TourProposalsPanel({ bandId, tourId }: { bandId: string; tourId?: string }) {
  const client = useQueryClient();
  const proposals = useQuery({ queryKey: ['support-tour-proposals', bandId], queryFn: () => listTourProposals(bandId), refetchInterval: 30_000 });
  const response = useMutation({ mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' | 'withdraw' }) => respondTourProposal(id, action),
    onSettled: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['support-tour-proposals'] }), client.invalidateQueries({ queryKey: ['tour-support-assignments'] }), client.invalidateQueries({ queryKey: ['tour-support-candidates'] }), client.invalidateQueries({ queryKey: ['tour-support-show-candidates'] })]); } });
  return <section className="space-y-3">
    <h3 className="font-semibold">Tour proposals</h3>
    {proposals.isPending && <p>Loading proposals…</p>}
    {proposals.isError && <p role="alert">Proposals could not be loaded. <Button onClick={() => void proposals.refetch()}>Retry proposals</Button></p>}
    {response.isError && <p role="alert">The proposal could not be confirmed. Dates, availability or travel may have changed. Review the refreshed itinerary before retrying.</p>}
    {response.isSuccess && <p role="status">Proposal status: {stateLabels[response.data] ?? response.data}</p>}
    {proposals.data?.filter(p => !tourId || p.tour_id === tourId).map(p => <div key={p.id} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{p.tour_name} · {p.headliner_name} with {p.support_name}</span><Badge variant={p.display_status === 'accepted' ? 'default' : 'outline'}>{stateLabels[p.display_status] ?? p.display_status}</Badge></div>
      <p className="text-sm">{stateMessages[p.display_status]}</p>
      <p className="text-sm">Response deadline: {new Date(p.expires_at).toLocaleString()}</p>
      {p.note && <p className="whitespace-pre-wrap text-sm">{p.note}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Date and time</th><th>Venue</th><th>Status</th><th>Support share</th><th>Travel from previous date</th></tr></thead><tbody>{p.itinerary.map((date, index) => <tr key={date.gig_id} className="border-t"><td className="py-2 pr-3">{new Date(date.scheduled_date).toLocaleString()}<div className="text-xs text-muted-foreground">{date.scheduled_end ? `Ends ${new Date(date.scheduled_end).toLocaleString()}` : 'Approximately 3 hours'}</div></td><td className="pr-3">{date.venue_name} · {date.city_name}</td><td className="pr-3">{stateLabels[p.display_status === 'expired' && p.slot_statuses?.[date.slot_id] === 'pending' ? 'expired' : p.slot_statuses?.[date.slot_id] ?? p.display_status] ?? p.slot_statuses?.[date.slot_id] ?? p.display_status}</td><td>{Math.round(date.revenue_share * 100)}% ticket revenue</td><td>{index === 0 ? 'Plan arrival' : `${date.travel_minutes_from_previous} minutes`}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Times are shown in your device’s timezone. Travel feasibility is rechecked on acceptance. Arrange your members’ actual travel and return journey separately; accepting does not buy transport. Changed or cancelled dates need fresh invitations.</p>
      {p.display_status === 'pending' && <div className="flex flex-wrap gap-2">{p.support_band_id === bandId ? <>
        <Button disabled={response.isPending} onClick={() => response.mutate({ id: p.id, action: 'accept' })}>Accept itinerary</Button>
        <Button variant="outline" disabled={response.isPending} onClick={() => response.mutate({ id: p.id, action: 'decline' })}>Decline itinerary</Button>
      </> : <Button variant="outline" disabled={response.isPending} onClick={() => response.mutate({ id: p.id, action: 'withdraw' })}>Withdraw proposal</Button>}</div>}
      {p.headliner_band_id === bandId && p.display_status === 'expired' && Object.values(p.slot_statuses ?? {}).includes('pending') && <Button variant="outline" disabled={response.isPending} onClick={() => response.mutate({ id: p.id, action: 'withdraw' })}>Release expired dates</Button>}
      <a className="mr-3 text-sm underline" href="/travel">Plan travel and return</a>
      <a className="text-sm underline" href={`/tour-manager?tour=${p.tour_id}`}>Open tour</a>
    </div>)}
    {proposals.isSuccess && !proposals.data.some(p => !tourId || p.tour_id === tourId) && <p className="text-sm text-muted-foreground">No tour proposals yet.</p>}
  </section>;
}
