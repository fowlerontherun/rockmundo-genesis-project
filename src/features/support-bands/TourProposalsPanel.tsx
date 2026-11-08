import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listTourProposals, respondTourProposal } from './completionApi';
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
    {response.isSuccess && <p role="status">Proposal status: {response.data}</p>}
    {proposals.data?.filter(p => !tourId || p.tour_id === tourId).map(p => <div key={p.id} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{p.tour_name} · {p.headliner_name} with {p.support_name}</span><Badge>{p.display_status}</Badge></div>
      <p className="text-sm">Response deadline: {new Date(p.expires_at).toLocaleString()}</p>
      {p.note && <p className="whitespace-pre-wrap text-sm">{p.note}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Date and time</th><th>Venue</th><th>Support share</th><th>Travel from previous date</th></tr></thead><tbody>{p.itinerary.map((date, index) => <tr key={date.gig_id} className="border-t"><td className="py-2 pr-3">{new Date(date.scheduled_date).toLocaleString()}</td><td className="pr-3">{date.venue_name} · {date.city_name}</td><td>{Math.round(date.revenue_share * 100)}% ticket revenue</td><td>{index === 0 ? 'Plan arrival' : `${date.travel_minutes_from_previous} minutes`}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Travel feasibility is rechecked on acceptance. Arrange your members’ actual travel and return journey separately; accepting does not buy transport. Changed or cancelled dates need fresh invitations.</p>
      {p.display_status === 'pending' && <div className="flex flex-wrap gap-2">{p.support_band_id === bandId ? <>
        <Button disabled={response.isPending} onClick={() => response.mutate({ id: p.id, action: 'accept' })}>Accept itinerary</Button>
        <Button variant="outline" disabled={response.isPending} onClick={() => response.mutate({ id: p.id, action: 'decline' })}>Decline itinerary</Button>
      </> : <Button variant="outline" disabled={response.isPending} onClick={() => response.mutate({ id: p.id, action: 'withdraw' })}>Withdraw proposal</Button>}</div>}
      <a className="mr-3 text-sm underline" href="/travel">Plan travel and return</a>
      <a className="text-sm underline" href={`/tour-manager?tour=${p.tour_id}`}>Open tour</a>
    </div>)}
    {proposals.isSuccess && !proposals.data.some(p => !tourId || p.tour_id === tourId) && <p className="text-sm text-muted-foreground">No tour proposals yet.</p>}
  </section>;
}
