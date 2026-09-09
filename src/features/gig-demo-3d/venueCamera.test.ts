import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { ConcertScene } from './ConcertScene';
import { DEFAULT_SETTINGS } from './config';
import { resolveVenueProfile, stagePosition } from './venueProfile';

describe('capacity-aware camera framing', () => {
  // Exercise the real camera method without constructing a GPU renderer.
  const harness = (capacity: number, aspect: number, shot = 'front') => {
    const p = resolveVenueProfile({ type: 'concert_hall', capacity });
    const rig = Object.assign(Object.create(ConcertScene.prototype), {
      venueProfile: p, options: { externalClock: true }, settings: { ...DEFAULT_SETTINGS, camera: shot },
      camera: new T.PerspectiveCamera(42, aspect, .08, 300), cameraPos: new T.Vector3(), targetPos: new T.Vector3(),
      lookAt: new T.Vector3(), actors: [], seconds: 5, sceneKey: 'front', playback: null,
    });
    return { rig, p };
  };
  it('keeps the full performance area in frame on portrait and landscape screens', () => {
    for (const capacity of [40, 300, 2000, 10000, 65000]) for (const aspect of [.45, 1, 1.8]) {
      const { rig, p } = harness(capacity, aspect); rig.moveCamera(.016); rig.camera.updateMatrixWorld(true);
      for (const u of [0, 1]) for (const v of [0, 1]) for (const height of [0, 2.1]) {
        const point = new T.Vector3(...stagePosition(p, u, v)); point.y += height; point.project(rig.camera);
        expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1);
      }
    }
  });
  it('keeps the drummer camera in front of the backdrop in the smallest venue', () => {
    const { rig, p } = harness(40, 1.8, 'drums'), root = new T.Group(); root.position.set(...stagePosition(p, .5, .18));
    rig.actors = [{ role: 'drums', root }]; rig.moveCamera(.016);
    expect(rig.camera.position.z).toBeGreaterThan(.65 - p.stageDepth + .3);
  });
});
