import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAppearance } from '@/features/player-model/appearance';
const mocks = vi.hoisted(() => ({ models: vi.fn(), capture: vi.fn() }));
vi.mock('@/features/player-model/usePlayerModel', () => ({ useGigPlayerModels: mocks.models }));
vi.mock('./portraitCaptureCache', () => ({ portraitCapture: mocks.capture }));
import PortraitLineup from './PortraitLineup';
const members = [{ id: 'm', profileId: 'p', name: 'Alex', instrument: 'electric guitar' }];
beforeEach(() => { mocks.capture.mockReset(); mocks.capture.mockResolvedValue('data:image/png;base64,avatar'); });
afterEach(cleanup);
describe('band portrait saved identity', () => {
  it('requests complete visual data and passes the saved appearance to capture', async () => {
    const appearance = defaultAppearance();
    mocks.models.mockReturnValue({ data: { appearances: { p: appearance }, richClothing: { p: [] } }, isError: false, isFetching: false });
    render(<PortraitLineup members={members} />);
    await screen.findByAltText('Alex in their saved outfit');
    expect(mocks.models).toHaveBeenCalledWith(['p'], true);
    expect(mocks.capture.mock.calls[0][0].appearance).toEqual(appearance);
    expect(mocks.capture.mock.calls[0][0].instrument).toBe('electric_guitar');
  });
  it('does not invent an avatar when there is no saved appearance', async () => {
    mocks.models.mockReturnValue({ data: { appearances: {}, richClothing: {} }, isError: false, isFetching: false });
    render(<PortraitLineup members={members} />);
    await screen.findByText('No portrait available');
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it('shows an existing profile photo when a bandmate never saved Avatar V1', async () => {
    mocks.models.mockReturnValue({
      data: { appearances: {}, richClothing: {}, profilePhotos: { p: 'https://example.test/profile-photo.png' } },
      isError: false, isFetching: false,
    });
    render(<PortraitLineup members={members} />);
    await screen.findByAltText('Alex profile photo (no saved 3D avatar)');
    expect(screen.getByText(/3D avatar not saved/)).toBeTruthy();
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it('does not mistake missing saved data for a failed WebGL capture', async () => {
    mocks.models.mockReturnValue({ data: { appearances: {}, richClothing: {}, profilePhotos: {} }, isError: false, isFetching: false });
    render(<PortraitLineup members={members} />);
    await screen.findByText('No portrait available');
    expect(screen.getByText(/Some members have not saved an Avatar V1 appearance/)).toBeTruthy();
    expect(screen.queryByText('Some saved visuals could not load.')).toBeNull();
  });
  it('hides cached portraits when a visual refresh fails', async () => {
    mocks.models.mockReturnValue({ data: { appearances: { p: defaultAppearance() }, richClothing: {} }, isError: false, isFetching: false });
    const { rerender } = render(<PortraitLineup members={members} />);
    await screen.findByAltText('Alex in their saved outfit');
    mocks.models.mockReturnValue({ data: { appearances: { p: defaultAppearance() }, richClothing: {} }, isError: true, isFetching: false });
    rerender(<PortraitLineup members={members} />);
    await waitFor(() => expect(screen.queryByAltText('Alex in their saved outfit')).toBeNull());
    expect(screen.getByRole('button', { name: 'Retry portraits' })).toBeVisible();
  });
});
