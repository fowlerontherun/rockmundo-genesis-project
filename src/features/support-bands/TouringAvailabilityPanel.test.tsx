import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TouringAvailabilityPanel } from './TouringAvailabilityPanel';
import { playTogetherRpc } from './completionApi';
vi.mock('./completionApi', () => ({ playTogetherRpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { availability_scope: 'worldwide', touring_countries: [], touring_from: null, touring_until: null, travel_enabled: true, max_travel_minutes: null }, error: null }) }) }) }) } }));
afterEach(cleanup);
it('saves country opt-in without requiring city advertisements or dates', async () => {
 render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TouringAvailabilityPanel bandId="band" countries={['UK','France']} /></QueryClientProvider>);
 const area = await screen.findByLabelText('Touring area');
 fireEvent.change(area, { target: { value: 'countries' } });
 expect(screen.getByRole('button', { name: 'Save touring area' })).toBeDisabled();
 fireEvent.click(screen.getByLabelText('UK'));
 fireEvent.click(screen.getByRole('button', { name: 'Save touring area' }));
 await waitFor(() => expect(playTogetherRpc).toHaveBeenCalledWith('set_support_touring_scope', { p_band_id: 'band', p_scope: 'countries', p_countries: ['UK'], p_from: null, p_until: null, p_travel: true, p_max_minutes: null }));
});
