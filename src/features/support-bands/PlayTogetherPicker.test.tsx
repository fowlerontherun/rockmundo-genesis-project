import { listBandFriendships, changeBandFriendship } from './friendshipApi';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { PlayTogetherPicker } from './PlayTogetherPicker';
import { getBandDiscoveryContext, setBandShortlisted } from './discoveryApi';
vi.mock('./discoveryApi', () => ({ getBandDiscoveryContext: vi.fn(), setBandShortlisted: vi.fn() }));
vi.mock('./friendshipApi', () => ({ listBandFriendships: vi.fn(), changeBandFriendship: vi.fn() }));
const candidates = [{ id: 'b', name: 'Label Band', fame: 100, detail: '2/3 dates' }, { id: 'c', name: 'Saved Band', fame: 200, detail: '3/3 dates' }];
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listBandFriendships).mockResolvedValue([]);
  vi.mocked(changeBandFriendship).mockResolvedValue(undefined);
  vi.mocked(getBandDiscoveryContext).mockResolvedValue([
    { band_id: 'b', shortlisted: false, labelmate: true },
    { band_id: 'c', shortlisted: true, labelmate: false },
    { band_id: 'unavailable', shortlisted: true, labelmate: true },
  ]);
  vi.mocked(setBandShortlisted).mockResolvedValue(undefined);
});
function setup() {
  const onSelect = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <PlayTogetherPicker bandId="a" candidates={candidates} onSelect={onSelect} />
  </QueryClientProvider>);
  return onSelect;
}
it('filters eligible bands by private shortlist and active label membership', async () => {
  const onSelect = setup();
  await screen.findByText('Same label');
  fireEvent.click(screen.getByRole('button', { name: 'Labelmates' }));
  expect(screen.queryByText('Saved Band')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Select band' }));
  expect(onSelect).toHaveBeenCalledWith('b');
  fireEvent.click(screen.getAllByRole('button', { name: 'Shortlist' })[0]);
  expect(screen.getByText('Saved Band')).toBeInTheDocument();
  expect(screen.queryByText('Label Band')).not.toBeInTheDocument();
  expect(screen.queryByText('unavailable')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove from shortlist' }));
  await waitFor(() => expect(setBandShortlisted).toHaveBeenCalledWith('a','c',false));
});
it('keeps eligible results usable and reports unavailable recommendations', async () => {
  vi.mocked(getBandDiscoveryContext).mockRejectedValue(new Error('offline'));
  setup();
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Labelmates' })).toBeDisabled();
  expect(screen.getByText('Saved Band')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search available bands' }), { target: { value: 'label' } });
  expect(screen.queryByText('Saved Band')).not.toBeInTheDocument();
  expect(screen.getByText('Label Band')).toBeInTheDocument();
});

it('filters accepted friends without adding unavailable bands and sends requests separately from bookings', async () => {
  vi.mocked(listBandFriendships).mockResolvedValue([
    { band_id: 'b', band_name: 'Label Band', status: 'accepted', incoming: false },
    { band_id: 'unavailable', band_name: 'Unavailable Friend', status: 'accepted', incoming: false },
  ]);
  const onSelect = setup();
  await screen.findByText('Band friends');
  fireEvent.click(screen.getByRole('button', { name: 'Friends' }));
  expect(screen.queryByText('Saved Band')).not.toBeInTheDocument();
  expect(screen.queryByText('Unavailable Friend')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'All available' }));
  fireEvent.click(screen.getByRole('button', { name: 'Request friendship' }));
  await waitFor(() => expect(changeBandFriendship).toHaveBeenCalledWith('a', 'c', 'request'));
  expect(onSelect).not.toHaveBeenCalled();
});

it('sorts eligible bands and clears a dead-end filter without changing availability', async () => {
 setup(); await screen.findByText('Same label');
 fireEvent.change(screen.getByRole('combobox', { name: 'Sort available bands' }), { target: { value: 'fame' } });
 const profiles = screen.getAllByRole('link', { name: /profile \(opens in a new tab\)/ });
 expect(profiles[0]).toHaveTextContent('Saved Band');
 expect(profiles[0]).toHaveAttribute('target','_blank');
 fireEvent.change(screen.getByRole('textbox', { name: 'Search available bands' }), { target: { value: 'Missing' } });
 expect(screen.getByText('No available bands match these filters.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Clear band filters' }));
 expect(screen.getByText('Label Band')).toBeInTheDocument();
 expect(screen.getByText('Saved Band')).toBeInTheDocument();
 expect(screen.queryByText('unavailable')).not.toBeInTheDocument();
});
