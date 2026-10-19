import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarShareStudio } from './CharacterShareStudio';

const mocks = vi.hoisted(() => ({
  model: vi.fn(),
  clothing: vi.fn(),
  tattoos: vi.fn(),
  merch: vi.fn(),
  luthiery: vi.fn(),
  renderAvatar: vi.fn(),
  captureAvatar: vi.fn(),
}));

vi.mock('@/features/player-model/usePlayerModel', () => ({
  usePlayerModel: mocks.model,
  useEquippedRichClothing: mocks.clothing,
  usePlayerStageTattoos: mocks.tattoos,
  useEquippedStageLuthieryInstruments: mocks.luthiery,
}));
vi.mock('@/features/player-model/useAvatarMerchWearables', () => ({
  useAvatarMerchWearables: mocks.merch,
}));
vi.mock('./avatarCapture', () => ({
  captureAvatarV1ForShare: mocks.renderAvatar,
  captureAvatarCanvas: mocks.captureAvatar,
}));
vi.mock('./ShareMomentSheet', () => ({
  ShareMomentSheet: ({ moment, avatarStatus, onAvatarRetry, onPromptAccepted }: {
    moment: { avatar?: { dataUrl: string } | null; promptOnly?: boolean };
    avatarStatus: string;
    onAvatarRetry: () => void;
    onPromptAccepted?: () => void;
  }) => <div>
    <span data-testid="avatar-status">{avatarStatus}</span>
    <span data-testid="avatar-url">{moment.avatar?.dataUrl ?? 'none'}</span>
    <button onClick={onAvatarRetry}>Retry avatar</button>
    {moment.promptOnly && <button onClick={onPromptAccepted}>Accept share prompt</button>}
  </div>,
}));

const moment = {
  version: 1 as const,
  type: 'character_profile' as const,
  id: 'promo:profile-1',
  headline: 'Artist',
  createdAt: '2026-10-18T00:00:00.000Z',
};

describe('AvatarShareStudio image capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.model.mockReturnValue({
      profileId: 'profile-1',
      query: { data: { appearance: { body: { height: 1 } }, revision: 1 }, isError: false },
    });
    mocks.clothing.mockReturnValue({ data: [{ item_id: 'coat' }], isPending: false, isFetching: false });
    mocks.tattoos.mockReturnValue({ data: [{ id: 'tattoo' }], isPending: false, isFetching: false });
    // When no band exists this optional React Query query is disabled:
    // isPending stays true indefinitely, but isFetching is false.
    mocks.merch.mockReturnValue({ query: { data: undefined, isPending: true, isFetching: false } });
    mocks.luthiery.mockReturnValue({ data: [], isPending: false, isFetching: false });
    mocks.renderAvatar.mockResolvedValue({} as HTMLCanvasElement);
    mocks.captureAvatar.mockReturnValue({ dataUrl: 'data:image/png;base64,avatar', width: 720, height: 1080 });
  });

  it('captures the current character even without a band/merch query', async () => {
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('avatar-status')).toHaveTextContent('ready'));
    expect(mocks.renderAvatar).toHaveBeenCalledWith(expect.objectContaining({
      appearance: { body: { height: 1 } },
      richClothing: [{ item_id: 'coat' }],
      tattoos: [{ id: 'tattoo' }],
      merchWearable: null,
    }));
    expect(screen.getByTestId('avatar-url')).toHaveTextContent('data:image/png;base64,avatar');
  });

  it('does not remain loading forever when no active character exists', async () => {
    mocks.model.mockReturnValue({
      profileId: null,
      isLoading: false,
      query: { data: undefined, isError: false },
    });
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('avatar-status')).toHaveTextContent('unavailable'));
    expect(mocks.renderAvatar).not.toHaveBeenCalled();
  });

  it('keeps the equipped outfit intact when wardrobe loading fails', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mocks.clothing.mockReturnValue({ data: undefined, isPending: false, isFetching: false, isError: true, refetch });
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('avatar-status')).toHaveTextContent('unavailable'));
    expect(mocks.renderAvatar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry avatar' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(mocks.renderAvatar).not.toHaveBeenCalled();
  });

  it('does not silently omit tattoos after their request fails', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mocks.tattoos.mockReturnValue({ data: undefined, isPending: false, isFetching: false, isError: true, refetch });
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('avatar-status')).toHaveTextContent('unavailable'));
    expect(mocks.renderAvatar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry avatar' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('waits while the appearance layers are actually loading', () => {
    mocks.clothing.mockReturnValue({ data: undefined, isPending: true, isFetching: true });
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('avatar-status')).toHaveTextContent('loading');
    expect(mocks.renderAvatar).not.toHaveBeenCalled();
  });

  it('defers milestone avatar capture until the player accepts the share prompt', async () => {
    render(<AvatarShareStudio open moment={{ ...moment, type: 'achievement', promptOnly: true }} onOpenChange={vi.fn()} />);
    expect(mocks.renderAvatar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Accept share prompt' }));
    await waitFor(() => expect(screen.getByTestId('avatar-status')).toHaveTextContent('ready'));
    expect(mocks.renderAvatar).toHaveBeenCalledTimes(1);
  });

  it('allows a failed capture to be retried', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.renderAvatar.mockRejectedValueOnce(new Error('webgl context lost')).mockResolvedValueOnce({} as HTMLCanvasElement);
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('avatar-status')).toHaveTextContent('unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry avatar' }));
    await waitFor(() => expect(screen.getByTestId('avatar-status')).toHaveTextContent('ready'));
    expect(mocks.renderAvatar).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('regenerates a corrupt historical avatar rather than retrying its broken image', async () => {
    const saved = { ...moment, avatar: { dataUrl: 'data:image/png;base64,invalid', width: 400, height: 600 } };
    render(<AvatarShareStudio open moment={saved} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId('avatar-url')).toHaveTextContent('data:image/png;base64,invalid');
    expect(mocks.renderAvatar).not.toHaveBeenCalled();

    // ShareMomentSheet calls this when the saved data URL cannot be decoded.
    fireEvent.click(screen.getByRole('button', { name: 'Retry avatar' }));
    await waitFor(() => expect(screen.getByTestId('avatar-status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('avatar-url')).toHaveTextContent('data:image/png;base64,avatar');
    expect(mocks.renderAvatar).toHaveBeenCalledTimes(1);
  });

  it('preserves a historical snapshot instead of rendering the current avatar', () => {
    render(<AvatarShareStudio open moment={{ ...moment, avatar: { dataUrl: 'data:image/png;base64,older', width: 400, height: 600 } }} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId('avatar-url')).toHaveTextContent('data:image/png;base64,older');
    expect(mocks.renderAvatar).not.toHaveBeenCalled();
  });
});
