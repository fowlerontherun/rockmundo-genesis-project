import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GigStage3D from './GigStage3D';
import { ConcertScene } from '@/features/gig-demo-3d/ConcertScene';
import { derivePlaybackState } from '../engine/PlaybackController';
import { DEFAULT_CROWD_TUNING } from '../engine/CrowdTuning';
import { makeStageReplay } from './test-fixtures';

vi.mock('@/features/gig-demo-3d/ConcertScene', () => ({ ConcertScene: vi.fn() }));
vi.mock('@/features/player-model/usePlayerModel', () => ({ useGigPlayerModels: () => ({ data: undefined, isFetching: false, isError: false }) }));
const engine = { setSettings: vi.fn(), setFrame: vi.fn(), setEffects: vi.fn(), setCrowdTuning: vi.fn(), destroy: vi.fn() };
let onState: (state: 'loading' | 'ready' | 'error', message?: string) => void;
beforeEach(() => { vi.clearAllMocks(); vi.mocked(ConcertScene).mockImplementation((_canvas, _settings, _stats, state) => { onState = state; state('ready'); return engine as unknown as ConcertScene; }); });
afterEach(cleanup);
it('keeps one context through pause, seek, camera, quality and reduced-motion changes', async () => {
  const replay = await makeStageReplay();
  const props = { replay, experience: null, playbackState: derivePlaybackState(replay, 70_000, true), reducedMotion: false, cameraMode: 'auto' as const, tier: 'standard' as const, archetype: 'club', tuning: DEFAULT_CROWD_TUNING, pyrotechnics: true, pyroIntensity: 1 };
  const view = render(<MemoryRouter><GigStage3D {...props} /></MemoryRouter>);
  expect(ConcertScene).toHaveBeenCalledOnce(); expect(engine.setFrame).toHaveBeenLastCalledWith(expect.objectContaining({ positionMs: 70_000 }));
  view.rerender(<MemoryRouter><GigStage3D {...props} playbackState={derivePlaybackState(replay, 42_000, false)} cameraMode="band_pov" reducedMotion tier="low" pyrotechnics={false} /></MemoryRouter>);
  expect(ConcertScene).toHaveBeenCalledOnce(); expect(engine.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ camera: 'stage', quality: 'low', playing: false, reducedMotion: true }));
  expect(engine.setFrame).toHaveBeenLastCalledWith(expect.objectContaining({ positionMs: 42_000 })); expect(engine.setEffects).toHaveBeenLastCalledWith(false, 1);
  act(() => onState('error', 'Lost graphics context')); fireEvent.click(screen.getByRole('button', { name: 'Retry 3D stage' })); expect(engine.destroy).toHaveBeenCalledOnce(); expect(ConcertScene).toHaveBeenCalledTimes(2);
  view.unmount(); expect(engine.destroy).toHaveBeenCalledTimes(2);
});
it('provides recovery when WebGL cannot start', async () => {
  vi.mocked(ConcertScene).mockImplementation(() => { throw new Error('Unsupported'); });
  const replay = await makeStageReplay();
  render(<MemoryRouter><GigStage3D replay={replay} experience={null} playbackState={derivePlaybackState(replay, 0)} reducedMotion cameraMode="venue_wide" tier="low" archetype="pub" tuning={DEFAULT_CROWD_TUNING} pyrotechnics={false} pyroIntensity={0} /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('3D graphics could not start'); expect(screen.getByRole('button', { name: 'Retry 3D stage' })).toBeEnabled();
});
