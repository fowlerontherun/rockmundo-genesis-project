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
 expect(await screen.findByRole('status')).toHaveTextContent('accepted');
});
it('allows withdrawal only from the headliner view and prevents expired acceptance', async () => {
 vi.mocked(listTourProposals).mockResolvedValue([proposal]); show('h');
 expect(await screen.findByRole('button', { name: 'Withdraw proposal' })).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'Accept itinerary' })).not.toBeInTheDocument();
 cleanup(); vi.mocked(listTourProposals).mockResolvedValue([{ ...proposal, display_status: 'expired' }]); show('s');
 await screen.findByText('expired'); expect(screen.queryByRole('button', { name: 'Accept itinerary' })).not.toBeInTheDocument();
});
it('shows a recoverable error after route revalidation fails', async () => {
 vi.mocked(listTourProposals).mockResolvedValue([proposal]); vi.mocked(respondTourProposal).mockRejectedValue(new Error('support_route_unreachable')); show('s');
 fireEvent.click(await screen.findByRole('button', { name: 'Accept itinerary' }));
 expect(await screen.findByRole('alert')).toHaveTextContent('travel may have changed');
});
