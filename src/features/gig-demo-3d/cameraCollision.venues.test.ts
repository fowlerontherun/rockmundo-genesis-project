import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as T from 'three';
import { ConcertScene } from './ConcertScene';
import { CameraCollisionWorld } from './cameraCollision';
import { buildVenueEnvironment } from './venueEnvironment';
import { buildVenueProduction } from './venueProduction';
import { DEFAULT_SETTINGS } from './config';
import { resolveVenueProfile, stagePosition } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => vi.restoreAllMocks());

const label = (_text: string, width: number, height: number) => new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial());
describe('camera clearance through real venue scenery', () => {
  it('cuts between manual lenses instead of interpolating through the scenery', () => {
    const p = resolveVenueProfile({ type: 'dive_bar' }), scene = new T.Scene();
    const rig = Object.assign(Object.create(ConcertScene.prototype), {
      scene, venueProfile: p, cameraCollision: new CameraCollisionWorld(), options: { externalClock: false },
      settings: { ...DEFAULT_SETTINGS, camera: 'side_stage' }, camera: new T.PerspectiveCamera(42, 1.8, .08, 100),
      cameraPos: new T.Vector3(), targetPos: new T.Vector3(), lookAt: new T.Vector3(), actors: [], seconds: 10, sceneKey: 'front', playback: null,
    });
    rig.camera.position.set(0, 2, 8);
    rig.moveCamera(.001);
    expect(rig.camera.position).toEqual(rig.cameraPos);
    expect(rig.lookAt).toEqual(rig.targetPos);
    const first = rig.camera.position.clone();
    rig.settings.camera = 'front'; rig.moveCamera(.001);
    rig.settings.camera = 'side_stage'; rig.moveCamera(.001);
    expect(rig.camera.position).toEqual(first);
  });
  it.each(['cafe_stage', 'dive_bar', 'theatre', 'indoor_arena', 'festival_tent', 'stadium'])('%s keeps ordinary gig lenses clear on portrait and landscape displays', type => {
    const p = resolveVenueProfile({ type }), scene = new T.Scene();
    const material = new T.MeshStandardMaterial();
    buildVenueEnvironment(scene, p, 123, material, material);
    buildVenueProduction(scene, p, material, material, label, 'SHOCKMASTER');
    const world = new CameraCollisionWorld(scene);
    const actors = ['vocals', 'guitar', 'bass', 'drums'].map((role, i) => {
      const root = new T.Group(); root.position.set(...stagePosition(p, [.5, .2, .8, .5][i], [.78, .62, .62, .18][i]));
      return { id: String(i), role, root, hasVocals: () => role === 'vocals' };
    });
    for (const aspect of [.45, 1.8]) for (const camera of ['front', 'stage', 'lead_close', 'band_medium', 'side_pit', 'side_stage', 'crane', 'guitar', 'drums', 'backline_reverse', 'bass_close']) {
      const rig = Object.assign(Object.create(ConcertScene.prototype), {
        scene, venueProfile: p, cameraCollision: world, options: { externalClock: true },
        settings: { ...DEFAULT_SETTINGS, camera }, camera: new T.PerspectiveCamera(42, aspect, .08, 500),
        cameraPos: new T.Vector3(), targetPos: new T.Vector3(), lookAt: new T.Vector3(), actors, seconds: 5, sceneKey: 'front', playback: null,
      });
      rig.moveCamera(.016);
      const distance = rig.camera.position.distanceTo(rig.lookAt);
      expect(distance, `${camera}: meaningful lens distance`).toBeGreaterThan(.8);
      expect(world.clearDistance(rig.lookAt, rig.camera.position), `${camera}: no wall/prop between lens and subject`).toBeGreaterThanOrEqual(distance - .001);
      expect(Math.abs(rig.camera.position.x)).toBeLessThan(p.roomWidth / 2);
      expect(rig.camera.position.y).toBeGreaterThan(.3);
      if (!p.outdoor) expect(rig.camera.position.y).toBeLessThan(p.roofHeight);
    }
    disposeModel(scene);
  });
});
