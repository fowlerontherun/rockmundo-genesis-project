import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GigStage3D from './GigStage3D';
import { ConcertScene } from '@/features/gig-demo-3d/ConcertScene';
import { useGigPlayerModels } from '@/features/player-model/usePlayerModel';
import { derivePlaybackState } from '../engine/PlaybackController';
import { DEFAULT_CROWD_TUNING } from '../engine/CrowdTuning';
import { makeStageReplay, performerId } from './test-fixtures';
import { defaultAppearance } from '@/features/player-model/appearance';
import type { ClothingItem } from '@/hooks/useSkinStore';

vi.mock('@/features/gig-demo-3d/ConcertScene', () => ({ ConcertScene: vi.fn() }));
vi.mock('@/features/player-model/usePlayerModel', () => ({ useGigPlayerModels: vi.fn(() => ({ data: undefined, isFetching: false, isError: false })) }));
const testQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const engine = { setSettings: vi.fn(), setFrame: vi.fn(), setEffects: vi.fn(), setCrowdTuning: vi.fn(), destroy: vi.fn() };
let onState: (state: 'loading' | 'ready' | 'error', message?: string) => void;
beforeEach(() => { vi.clearAllMocks(); vi.mocked(ConcertScene).mockImplementation((_canvas, _settings, _stats, state) => { onState = state; state('ready'); return engine as unknown as ConcertScene; }); });
afterEach(() => { cleanup(); testQueryClient.clear(); });
it('keeps one context through pause, seek, camera, quality and reduced-motion changes', async () => {
  const replay = await makeStageReplay();
  const props = { replay, experience: null, playbackState: derivePlaybackState(replay, 70_000, true), reducedMotion: false, cameraMode: 'auto' as const, tier: 'standard' as const, archetype: 'club', tuning: DEFAULT_CROWD_TUNING, pyrotechnics: true, pyroIntensity: 1 };
  const view = render(<QueryClientProvider client={testQueryClient}><MemoryRouter><GigStage3D {...props} /></MemoryRouter></QueryClientProvider>);
  expect(ConcertScene).toHaveBeenCalledOnce(); expect(engine.setFrame).toHaveBeenLastCalledWith(expect.objectContaining({ positionMs: 70_000 }));
  view.rerender(<QueryClientProvider client={testQueryClient}><MemoryRouter><GigStage3D {...props} playbackState={derivePlaybackState(replay, 42_000, false)} cameraMode="band_pov" reducedMotion tier="low" pyrotechnics={false} /></MemoryRouter></QueryClientProvider>);
  expect(ConcertScene).toHaveBeenCalledOnce(); expect(engine.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ camera: 'stage', quality: 'low', playing: false, reducedMotion: true }));
  expect(engine.setFrame).toHaveBeenLastCalledWith(expect.objectContaining({ positionMs: 42_000 })); expect(engine.setEffects).toHaveBeenLastCalledWith(false, 1);
  act(() => onState('error', 'Lost graphics context')); fireEvent.click(screen.getByRole('button', { name: 'Retry 3D stage' })); expect(engine.destroy).toHaveBeenCalledOnce(); expect(ConcertScene).toHaveBeenCalledTimes(2);
  view.unmount(); expect(engine.destroy).toHaveBeenCalledTimes(2);
});
it('provides recovery when WebGL cannot start', async () => {
  vi.mocked(ConcertScene).mockImplementation(() => { throw new Error('Unsupported'); });
  const replay = await makeStageReplay();
  render(<QueryClientProvider client={testQueryClient}><MemoryRouter><GigStage3D replay={replay} experience={null} playbackState={derivePlaybackState(replay, 0)} reducedMotion cameraMode="venue_wide" tier="low" archetype="pub" tuning={DEFAULT_CROWD_TUNING} pyrotechnics={false} pyroIntensity={0} /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByRole('alert')).toHaveTextContent('3D graphics could not start'); expect(screen.getByRole('button', { name: 'Retry 3D stage' })).toBeEnabled();
});

it('uses the immutable replay wardrobe instead of loading a changed live outfit', async () => {
  const replay = await makeStageReplay();
  const frozen = {
    appearances: { [performerId(0)]: defaultAppearance() },
    richClothing: {
      [performerId(0)]: [{
        item: {
          id: 'ab000000-0000-4000-8000-000000000003',
          name: 'Haunted Pumpkin Hat 2026',
          category: 'hat',
          wearable_slot: 'headwear',
          curated_asset_key: 'clothing.halloween.2026.pumpkin-hat',
          render_config: { headwearStyle: 'pumpkin' },
        } as unknown as ClothingItem,
      }],
    },
  };
  replay.playerModelsSnapshot = frozen;
  render(<QueryClientProvider client={testQueryClient}><MemoryRouter><GigStage3D replay={replay} experience={null}
    playbackState={derivePlaybackState(replay, 0)} reducedMotion
    cameraMode="venue_wide" tier="standard" archetype="club"
    tuning={DEFAULT_CROWD_TUNING} pyrotechnics={false} pyroIntensity={0} /></MemoryRouter></QueryClientProvider>);
  // No current-wardrobe query is allowed once replay evidence exists.
  expect(vi.mocked(useGigPlayerModels)).toHaveBeenCalledWith([]);
  expect(ConcertScene).toHaveBeenCalledOnce();
  const stageOptions = vi.mocked(ConcertScene).mock.calls[0][4];
  const singer = stageOptions?.performers.find(p => p.id === performerId(0));
  expect(singer?.richClothing?.[0]?.item.curated_asset_key).toBe('clothing.halloween.2026.pumpkin-hat');
});
