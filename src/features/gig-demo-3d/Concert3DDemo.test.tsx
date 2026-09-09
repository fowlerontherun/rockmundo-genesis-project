import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Concert3DDemo from './Concert3DDemo';
import { ConcertScene } from './ConcertScene';

vi.mock('./ConcertScene', () => ({ ConcertScene: vi.fn() }));
const engine = { setPreviewCrowdReaction: vi.fn(), setSettings: vi.fn(), restart: vi.fn(), destroy: vi.fn() };
let onState: (state: 'loading' | 'ready' | 'error', message?: string) => void;
const mount = () => render(<MemoryRouter><Concert3DDemo /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.mocked(ConcertScene).mockImplementation((_canvas, _settings, _stats, state) => {
    onState = state; state('ready'); return engine as unknown as ConcertScene;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('admin concert demo controls', () => {
  it('changes the performance, camera, lighting and audience without recreating the renderer', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Pause performance' }));
    expect(engine.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ playing: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Guitar side' }));
    expect(screen.getByRole('button', { name: 'Guitar side' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('LIGHTING'), { target: { value: 'amber' } });
    fireEvent.change(screen.getByLabelText(/CROWD/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Stage haze' }));
    expect(engine.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ camera: 'guitar', look: 'amber', crowd: 0, haze: false, playing: false }));
    expect(ConcertScene).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Restart performance' }));
    expect(engine.restart).toHaveBeenCalledOnce();
  });

  it('starts with the operating system reduced-motion preference', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    mount();
    expect(screen.getByRole('checkbox', { name: 'Reduced motion' })).toBeChecked();
    expect(engine.setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ reducedMotion: true }));
  });

  it('offers a retry on a failed asset load and disposes the previous scene first', () => {
    mount();
    act(() => onState('error', 'A model could not load.'));
    expect(screen.getByRole('alert')).toHaveTextContent('A model could not load.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry 3D demo' }));
    expect(engine.destroy).toHaveBeenCalledOnce();
    expect(ConcertScene).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains an unavailable graphics context and releases the scene on navigation', () => {
    vi.mocked(ConcertScene).mockImplementationOnce(() => { throw new Error('WebGL unavailable'); });
    const page = mount();
    expect(screen.getByRole('alert')).toHaveTextContent('hardware acceleration');
    fireEvent.click(screen.getByRole('button', { name: 'Retry 3D demo' }));
    expect(screen.getByRole('button', { name: 'Pause performance' })).toBeEnabled();
    page.unmount(); expect(engine.destroy).toHaveBeenCalledOnce();
    act(() => onState('error', 'Late response after unmount'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('compares real venue settings and capacities using the production scene', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Venue setting'), { target: { value: 'cafe_stage' } });
    expect(engine.destroy).toHaveBeenCalledOnce();
    expect(vi.mocked(ConcertScene).mock.calls.at(-1)?.[4]).toMatchObject({ externalClock: false, venue: { type: 'cafe_stage', capacity: 70 }, performers: expect.any(Array) });
    fireEvent.change(screen.getByLabelText('Venue capacity'), { target: { value: '2000' } });
    expect(vi.mocked(ConcertScene).mock.calls.at(-1)?.[4]?.venue.capacity).toBe(2000);
    fireEvent.change(screen.getByLabelText('Venue setting'), { target: { value: 'original' } });
    expect(vi.mocked(ConcertScene).mock.calls.at(-1)?.[4]).toBeUndefined();
  });

});

it('auditions the full skill-tree equipment and changes crowd reactions without reloading',()=>{
  mount();fireEvent.change(screen.getByLabelText('Featured instrument'),{target:{value:'theremin'}});
  const options=vi.mocked(ConcertScene).mock.calls.at(-1)?.[4];expect(options?.performers[1]).toMatchObject({instrument:'theremin',role:'dj'});
  const count=vi.mocked(ConcertScene).mock.calls.length;
  fireEvent.change(screen.getByLabelText('Crowd reaction'),{target:{value:'phone_lights'}});expect(engine.setPreviewCrowdReaction).toHaveBeenLastCalledWith('phone_lights');expect(ConcertScene).toHaveBeenCalledTimes(count);
});
