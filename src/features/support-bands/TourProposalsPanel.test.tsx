import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TourProposalsPanel } from './TourProposalsPanel';
import { listTourProposals, respondTourProposal, type TourProposal } from './completionApi';
vi.mock('./completionApi', () => ({ listTourProposals: vi.fn(), respondTourProposal: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const proposal: TourProposal = { id: 'p', tour_id: 't', tour_name: 'Summer', headliner_band_id: 'h', support_band_id: 's', headliner_name: 'Headliner', support_name: 'Support', display_status: 'pending', slot_ids: ['slot'], expires_at: '2030-01-01', note: 'Come along', itinerary: [{ slot_id: 'slot', gig_id: 'gig', scheduled_date: '2030-01-02T18:00Z', scheduled_end: null, venue_name: 'Venue', city_name: 'City', revenue_share: .2, travel_minutes_from_previous: 60 }] };
const show = (bandId: string) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TourProposalsPanel bandId={bandId} /></QueryClientProvider>);
it('shows itinerary terms and sends one decision for the whole proposal', async () => {
 vi.mocked(listTourProposals).mockResolvedValue([proposal]); vi.mocked(respondTourProposal).mockResolvedValue('accepted');
 show('s'); expect(await screen.findByText('20% ticket revenue')).toBeInTheDocument(); expect(screen.getByText('Plan arrival')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Accept itinerary' }));
 await waitFor(() => expect(respondTourProposal).toHaveBeenCalledWith('p','accept'));
 expect(respondTourProposal).toHaveBeenCalledOnce();
 expect(await screen.findByRole('status')).toHaveTextContent('Confirmed');
});
it('allows withdrawal only from the headliner view and prevents expired acceptance', async () => {
 vi.mocked(listTourProposals).mockResolvedValue([proposal]); show('h');
 expect(await screen.findByRole('button', { name: 'Withdraw proposal' })).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'Accept itinerary' })).not.toBeInTheDocument();
 cleanup(); vi.mocked(listTourProposals).mockResolvedValue([{ ...proposal, display_status: 'expired' }]); show('s');
 await screen.findAllByText('Expired'); expect(screen.queryByRole('button', { name: 'Accept itinerary' })).not.toBeInTheDocument();
});
it('shows a recoverable error after route revalidation fails', async () => {
 vi.mocked(listTourProposals).mockResolvedValue([proposal]); vi.mocked(respondTourProposal).mockRejectedValue(new Error('support_route_unreachable')); show('s');
 fireEvent.click(await screen.findByRole('button', { name: 'Accept itinerary' }));
 expect(await screen.findByRole('alert')).toHaveTextContent('travel may have changed');
});

it('shows which dates remain confirmed after an itinerary changes', async () => {
 const second = { ...proposal.itinerary[0], slot_id: 'kept', gig_id: 'kept-gig' };
 vi.mocked(listTourProposals).mockResolvedValue([{ ...proposal, display_status: 'changed', slot_ids: ['slot','kept'], slot_statuses: { slot: 'cancelled', kept: 'accepted' }, itinerary: [...proposal.itinerary, second] }]);
 show('s');
 expect(await screen.findByText('Dates changed')).toBeInTheDocument();
 expect(screen.getByText('Cancelled')).toBeInTheDocument();
 expect(screen.getByText('Confirmed')).toBeInTheDocument();
 expect(screen.getByText(/Remaining pending dates have been released/)).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'Accept itinerary' })).not.toBeInTheDocument();
});
it('lets the headliner release expired pending dates before the worker runs', async () => {
 vi.mocked(listTourProposals).mockResolvedValue([{ ...proposal, display_status: 'expired', slot_statuses: { slot: 'pending' } }]);
 vi.mocked(respondTourProposal).mockResolvedValue('expired'); show('h');
 fireEvent.click(await screen.findByRole('button', { name: 'Release expired dates' }));
 await waitFor(() => expect(respondTourProposal).toHaveBeenCalledWith('p','withdraw'));
 expect(screen.queryByRole('button', { name: 'Accept itinerary' })).not.toBeInTheDocument();
});

it('separates incoming replies, sent proposals and history and lets players recover from empty searches', async () => {
 const sent = { ...proposal, id: 'sent', tour_id: 'sent-tour', tour_name: 'Outgoing tour', headliner_band_id: 's', support_band_id: 'other' };
 const archived = { ...proposal, id: 'past', tour_id: 'past-tour', tour_name: 'Declined tour', display_status: 'declined' };
 vi.mocked(listTourProposals).mockResolvedValue([archived,sent,proposal]); show('s');
 fireEvent.click(await screen.findByRole('button', { name: /Awaiting your reply/ }));
 expect(screen.getByRole('heading', { name: 'Summer' })).toBeInTheDocument();
 expect(screen.queryByRole('heading', { name: 'Outgoing tour' })).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: /Sent invitations/ }));
 expect(screen.getByRole('heading', { name: 'Outgoing tour' })).toBeInTheDocument();
 fireEvent.change(screen.getByRole('textbox', { name: 'Search tour proposals' }), { target: { value: 'missing' } });
 expect(screen.getByText('No proposals match this view.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Show all proposals' }));
 expect(screen.getAllByRole('article')).toHaveLength(3);
 fireEvent.click(screen.getByRole('button', { name: /Past proposals/ }));
 expect(screen.getByRole('heading', { name: 'Declined tour' })).toBeInTheDocument();
 expect(screen.queryByRole('heading', { name: 'Summer' })).not.toBeInTheDocument();
});
it('does not count an elapsed deadline as needing a reply while the cached state is pending', async () => {
 vi.mocked(listTourProposals).mockResolvedValue([{ ...proposal, expires_at: '2000-01-01', display_status: 'pending' }]); show('s');
 const filter = await screen.findByRole('button', { name: /Awaiting your reply/ });
 expect(filter).toHaveTextContent('0');
 expect(screen.queryByRole('button', { name: 'Accept itinerary' })).not.toBeInTheDocument();
 expect(await screen.findByText('The reply deadline has passed. The headliner can send a new invitation.')).toBeInTheDocument();
});
