import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TattooAvatarPreview } from './TattooAvatarPreview';
import { usePlayerModel, usePlayerStageTattoos } from '@/features/player-model/usePlayerModel';
import { defaultAppearance } from '@/features/player-model/appearance';

vi.mock('@/features/player-model/usePlayerModel', () => ({
  usePlayerModel: vi.fn(),
  usePlayerStageTattoos: vi.fn(),
}));

const preview = vi.fn();
vi.mock('@/features/player-model/PlayerModelPreview', () => ({
  PlayerModelPreview: (props: unknown) => {
    preview(props);
    return <div>3D tattoo preview</div>;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePlayerModel).mockReturnValue({
    profileId: 'character-one',
    isLoading: false,
    error: null,
    query: {
      data: { appearance: defaultAppearance('character-one'), revision: 1 },
      isPending: false,
      isError: false,
    },
  } as unknown as ReturnType<typeof usePlayerModel>);
  vi.mocked(usePlayerStageTattoos).mockReturnValue({
    data: [{
      id: 'tattoo-1',
      profile_id: 'character-one',
      body_slot: 'chest',
      ink_color: '#111111',
      quality_score: 92,
      is_infected: false,
      category: 'blackwork',
    }],
    isError: false,
  } as unknown as ReturnType<typeof usePlayerStageTattoos>);
});

afterEach(cleanup);

it('uses the dedicated unclothed presentation without changing the saved avatar outfit', () => {
  render(<TattooAvatarPreview />);
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({
    presentation: 'tattoo',
    tattoos: [expect.objectContaining({ id: 'tattoo-1', body_slot: 'chest' })],
  }));
  expect(screen.getByText(/Clothing is temporarily removed/i)).toBeVisible();
  expect(screen.getByText(/saved outfit is not changed/i)).toBeVisible();
});
