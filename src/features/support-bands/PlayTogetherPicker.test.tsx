import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { PlayTogetherPicker } from './PlayTogetherPicker';
import { getBandDiscoveryContext, setBandShortlisted } from './discoveryApi';
vi.mock('./discoveryApi', () => ({ getBandDiscoveryContext: vi.fn(), setBandShortlisted: vi.fn() }));
const candidates = [{ id: 'b', name: 'Label Band', fame: 100, detail: '2/3 dates' }, { id: 'c', name: 'Saved Band', fame: 200, detail: '3/3 dates' }];
beforeEach(() => {
  vi.clearAllMocks();
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
