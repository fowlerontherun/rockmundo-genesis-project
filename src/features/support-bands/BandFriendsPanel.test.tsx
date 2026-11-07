import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { BandFriendsPanel } from './BandFriendsPanel';
import { changeBandFriendship, listBandFriendships, searchFriendBands } from './friendshipApi';
vi.mock('./friendshipApi', () => ({ changeBandFriendship: vi.fn(), listBandFriendships: vi.fn(), searchFriendBands: vi.fn() }));
it('lets recipients respond while outgoing requests can only be withdrawn', async () => {
  vi.mocked(listBandFriendships).mockResolvedValue([
    { band_id: 'b', band_name: 'Incoming', status: 'pending', incoming: true },
    { band_id: 'c', band_name: 'Outgoing', status: 'pending', incoming: false },
  ]);
  vi.mocked(changeBandFriendship).mockResolvedValue(undefined);
  vi.mocked(searchFriendBands).mockResolvedValue([{ id: 'd', name: 'New Band' }]);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BandFriendsPanel bandId="a" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Accept friendship' }));
  await waitFor(() => expect(changeBandFriendship).toHaveBeenCalledWith('a', 'b', 'accept'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw request' }));
  await waitFor(() => expect(changeBandFriendship).toHaveBeenCalledWith('a', 'c', 'remove'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Find a band to befriend' }), { target: { value: 'New' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search bands' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Request friendship' }));
  await waitFor(() => expect(changeBandFriendship).toHaveBeenCalledWith('a', 'd', 'request'));
});
