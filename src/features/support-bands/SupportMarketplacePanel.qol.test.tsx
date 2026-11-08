import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupportMarketplacePanel } from './SupportMarketplacePanel';
import { getSupportPreferences, listSupportAvailability, saveSupportPreferences } from './api';
import { listPlayTogetherCities, listTourProposals, type TourProposal } from './completionApi';
import { listBandFriendships } from './friendshipApi';
import { listLabelSuggestions } from './labelSuggestionsApi';
vi.mock('./api', () => ({ getSupportPreferences: vi.fn(), listSupportAvailability: vi.fn(), saveSupportPreferences: vi.fn(), addSupportAvailability: vi.fn(), setSupportAvailabilityStatus: vi.fn(), findAvailableSupportBands: vi.fn(), createGigSupportOffer: vi.fn(), respondToGigSupportOffer: vi.fn() }));
vi.mock('./groupedOffersApi', () => ({ respondToTourSupportOffers: vi.fn() }));
vi.mock('./completionApi', () => ({ listPlayTogetherCities: vi.fn(), listTourProposals: vi.fn() }));
vi.mock('./friendshipApi', () => ({ listBandFriendships: vi.fn() }));
vi.mock('./labelSuggestionsApi', () => ({ listLabelSuggestions: vi.fn() }));
vi.mock('./TouringAvailabilityPanel', () => ({ TouringAvailabilityPanel: ({ disabled }: { disabled: boolean }) => <div>{disabled ? 'Touring area locked until preferences saved' : 'Touring area ready'}</div> }));
vi.mock('./TourProposalsPanel', () => ({ TourProposalsPanel: () => <div>Proposals view</div> }));
vi.mock('./BandFriendsPanel', () => ({ BandFriendsPanel: () => <div>Friends view</div> }));
vi.mock('./LabelSuggestionsPanel', () => ({ LabelSuggestionsPanel: () => <div>Labels view</div> }));
vi.mock('./PlayTogetherPicker', () => ({ PlayTogetherPicker: () => null }));
vi.mock('./ConfirmedSupportSlotsPanel', () => ({ ConfirmedSupportSlotsPanel: () => null }));
vi.mock('./SupportHistoryPanel', () => ({ SupportHistoryPanel: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
 const data = table === 'gig_support_slots' ? [
  { id: 'legacy', status: 'pending', gig: { scheduled_date: '2030-01-01' } },
  { id: 'owned', status: 'pending', gig: { scheduled_date: '2030-01-01' } },
  { id: 'past', status: 'pending', gig: { scheduled_date: '2000-01-01' } },
 ] : [];
 const builder = { select: () => builder, eq: () => builder, in: () => builder, gte: () => builder, order: () => builder,
  then: (resolve: (value: { data: typeof data; error: null }) => unknown) => Promise.resolve(resolve({ data, error: null })) };
 return builder;
} } }));
const prefs = { band_id: 'a', enabled: false, single_gigs_enabled: true, tour_enabled: true, travel_enabled: false, max_travel_minutes: null, minimum_headliner_fame: 0, minimum_venue_capacity: 0, preferred_genres: [] };
function proposal(id: string, support: string, expires = '2030-01-01'): TourProposal { return { id, support_band_id: support, headliner_band_id: support === 'a' ? 'other' : 'a', display_status: 'pending', expires_at: expires, slot_ids: id === 'incoming' ? ['owned'] : [], itinerary: [], tour_id: id, tour_name: id, headliner_name: 'Headline', support_name: 'Support', note: '' }; }
afterEach(() => { cleanup(); vi.resetAllMocks(); });
beforeEach(() => {
 vi.mocked(getSupportPreferences).mockResolvedValue(prefs); vi.mocked(listSupportAvailability).mockResolvedValue([]);
 vi.mocked(saveSupportPreferences).mockResolvedValue({ ...prefs, enabled: true });
 vi.mocked(listPlayTogetherCities).mockResolvedValue({ data: [], error: null });
 vi.mocked(listTourProposals).mockResolvedValue([proposal('incoming','a'),proposal('sent','other'),proposal('expired','a','2000-01-01')]);
 vi.mocked(listBandFriendships).mockResolvedValue([{ band_id: 'b', band_name: 'B', status: 'pending', incoming: true }]);
 vi.mocked(listLabelSuggestions).mockResolvedValue([{ id: 'label', label_id: 'l', label_name: 'L', headliner_band_id: 'a', support_band_id: 'b', headliner_name: 'A', support_name: 'B', note: '', roster_current: true, headliner_response: 'pending', support_response: 'interested' }]);
});
function Probe() { const location = useLocation(); const navigate = useNavigate(); return <><output aria-label="Current route">{location.search}</output><button onClick={() => navigate(-1)}>Go back</button></>; }
function setup() { return render(<MemoryRouter initialEntries={['/gig-booking?tab=play-together&section=availability&bandId=a&targetBand=b']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SupportMarketplacePanel bandId="a" /><Probe /></QueryClientProvider></MemoryRouter>); }
it('counts only actionable incoming bookings and preserves invite context when navigating and going back', async () => {
 setup();
 const overview = await screen.findByRole('region', { name: 'Play Together shortcuts' });
 await within(overview).findByText('2 invitations need your reply.');
 fireEvent.click(within(overview).getByRole('button', { name: /Review invitations/ }));
 await waitFor(() => expect(screen.getByRole('tab', { name: /Offers/ })).toHaveAttribute('aria-selected','true'));
 expect(screen.getByLabelText('Current route')).toHaveTextContent('section=offers');
 expect(screen.getByLabelText('Current route')).toHaveTextContent('targetBand=b');
 expect(screen.getByLabelText('Current route')).toHaveTextContent('bandId=a');
 fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
 await waitFor(() => expect(screen.getByRole('tab', { name: 'Availability' })).toHaveAttribute('aria-selected','true'));
 expect(within(overview).getByRole('button', { name: /Friends & label suggestions/ })).toHaveTextContent('2 to review');
});
it('does not advertise unsaved preference changes and guides saving before area changes', async () => {
 setup();
 const toggle = await screen.findByRole('switch', { name: 'Open to support offers' });
 fireEvent.click(toggle);
 expect(screen.getByText('Not advertising availability')).toBeInTheDocument();
 expect(screen.queryByText('Touring open')).not.toBeInTheDocument();
 expect(screen.getByText('Touring area locked until preferences saved')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
 await waitFor(() => expect(saveSupportPreferences).toHaveBeenCalledWith('a',expect.objectContaining({ enabled: true })));
 expect(await screen.findByText('Touring open')).toBeInTheDocument();
});
it('shows retry instead of false empty offers when the initial data load fails', async () => {
 vi.mocked(getSupportPreferences).mockRejectedValue(new Error('Offline')); setup();
 expect(await screen.findByRole('button', { name: 'Retry Play Together' })).toBeInTheDocument();
 expect(screen.queryByText('Not advertising availability')).not.toBeInTheDocument();
 vi.mocked(getSupportPreferences).mockResolvedValue(prefs);
 fireEvent.click(screen.getByRole('button', { name: 'Retry Play Together' }));
 expect(await screen.findByRole('switch', { name: 'Open to support offers' })).toBeInTheDocument();
});
