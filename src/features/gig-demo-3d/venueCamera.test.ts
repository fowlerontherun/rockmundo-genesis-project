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
  it('frames live performers close-up in large arenas, stadiums and festivals', () => {
    for (const [type, capacity] of [
      ['rock_club', 700], ['indoor_arena', 18000], ['stadium', 65000], ['festival_stage', 20000],
    ] as const) for (const aspect of [.55, 1.78]) {
      const p = resolveVenueProfile({ type, capacity });
      const root = new T.Group();
      root.position.set(...stagePosition(p, .5, .76));
      for (const shot of ['lead_close', 'band_medium', 'side_pit', 'side_stage', 'crane'] as const) {
        const { rig } = harness(capacity, aspect, shot);
        rig.venueProfile = p;
        rig.actors = [{ id: 'lead', role: 'vocals', root, hasVocals: () => true }];
        rig.moveCamera(.016);
        rig.camera.updateMatrixWorld(true);
        const focus = root.position.clone().add(new T.Vector3(0, 1.32, 0));
        const imagePoint = focus.clone().project(rig.camera);
        expect(Number.isFinite(imagePoint.x)).toBe(true);
        expect(Math.abs(imagePoint.x)).toBeLessThan(.94);
        expect(Math.abs(imagePoint.y)).toBeLessThan(.94);
        if (shot === 'lead_close') {
          // Portrait framing backs up enough to retain hands/instruments.
          expect(rig.camera.position.distanceTo(focus)).toBeLessThan(4 / Math.min(1, aspect));
          for (const dx of [-.8, .8]) for (const dy of [-.5, .65]) {
            const edge = focus.clone().add(new T.Vector3(dx, dy, 0)).project(rig.camera);
            expect(Math.abs(edge.x)).toBeLessThan(.95);
            expect(Math.abs(edge.y)).toBeLessThan(.95);
          }
          expect(rig.camera.position.distanceTo(focus)).toBeGreaterThan(2.5);
        }
      }
    }
  });

  it('cuts directly to the next director lens rather than moving through scene geometry', () => {
    const { rig, p } = harness(65000, 1.78, 'director');
    const root = new T.Group(); root.position.set(...stagePosition(p, .5, .76));
    rig.actors = [{ id: 'lead', role: 'vocals', root, hasVocals: () => true }];
    rig.options.externalClock = false;
    rig.seconds = 9;
    rig.camera.position.set(0, 15, 60);
    rig.moveCamera(.016);
    expect(rig.sceneKey).toBe('lead_close');
    expect(rig.camera.position.distanceTo(rig.cameraPos)).toBeLessThan(.00001);
    expect(rig.lookAt.distanceTo(rig.targetPos)).toBeLessThan(.00001);
  });

  it('keeps the singer noticeably closer than the venue-wide lens in a stadium', () => {
    const { rig, p } = harness(65000, 1.78);
    const root = new T.Group();
    root.position.set(...stagePosition(p, .5, .76));
    rig.actors = [{ id: 'lead', role: 'vocals', root, hasVocals: () => true }];
    rig.moveCamera(.016);
    const distant = rig.camera.position.distanceTo(root.position);
    rig.settings.camera = 'lead_close';
    rig.moveCamera(.016);
    expect(distant).toBeGreaterThan(rig.camera.position.distanceTo(root.position) * 5);
  });

  it('keeps the drummer camera in front of the backdrop in the smallest venue', () => {
    const { rig, p } = harness(40, 1.8, 'drums'), root = new T.Group(); root.position.set(...stagePosition(p, .5, .18));
    rig.actors = [{ role: 'drums', root }]; rig.moveCamera(.016);
    expect(rig.camera.position.z).toBeGreaterThan(.65 - p.stageDepth + .3);
  });
});


describe('Top of the Pops multi-stage camera framing', () => {
  const tvHarness = (stageKey: 'main_stage' | 'stage_b' | 'rock_stage' | 'studio_floor') => {
    const p = resolveVenueProfile({ type: 'tv_studio', capacity: 250, seed: 1234 });
    const rig = Object.assign(Object.create(ConcertScene.prototype), {
      venueProfile: p,
      options: { externalClock: true, television: { presenterKey: 'alex_rayne', showVariant: 'regular', stageKey } },
      settings: { ...DEFAULT_SETTINGS, camera: 'front' },
      camera: new T.PerspectiveCamera(42, 4 / 3, .08, 300),
      cameraPos: new T.Vector3(),
      targetPos: new T.Vector3(),
      lookAt: new T.Vector3(),
      actors: [],
      seconds: 5,
      sceneKey: 'front',
      playback: null,
    });
    rig.moveCamera(.016);
    return rig;
  };

  it('moves the master shot toward Stage B instead of leaving it on Main Stage', () => {
    const main = tvHarness('main_stage');
    const stageB = tvHarness('stage_b');
    expect(stageB.targetPos.x).toBeGreaterThan(main.targetPos.x + 4);
  });

  it('moves the master shot left and deeper for Rock Stage', () => {
    const main = tvHarness('main_stage');
    const rock = tvHarness('rock_stage');
    expect(rock.targetPos.x).toBeLessThan(main.targetPos.x - 3.5);
    expect(rock.targetPos.z).toBeGreaterThan(main.targetPos.z + 2.5);
  });

  it('moves the master shot into the room for Studio Floor', () => {
    const main = tvHarness('main_stage');
    const floor = tvHarness('studio_floor');
    expect(floor.targetPos.z).toBeGreaterThan(main.targetPos.z + 4);
  });
});


describe('Top of the Pops presenter camera framing', () => {
  it('frames the actual presenter position for presenter close-up', () => {
    const p = resolveVenueProfile({ type: 'tv_studio', seed: 1234, presenterKey: 'alex_rayne' });
    const scene = new T.Scene();
    const presenter = new T.Group();
    presenter.name = 'totp-presenter-alex-rayne';
    presenter.position.set(-4.2, 0, -.5);
    scene.add(presenter);

    const rig = Object.assign(Object.create(ConcertScene.prototype), {
      venueProfile: p,
      options: { externalClock: true, television: { presenterKey: 'alex_rayne', showVariant: 'regular', stageKey: 'main_stage' } },
      settings: { ...DEFAULT_SETTINGS, camera: 'tv_presenter_close' },
      camera: new T.PerspectiveCamera(42, 4 / 3, .08, 300),
      cameraPos: new T.Vector3(),
      targetPos: new T.Vector3(),
      lookAt: new T.Vector3(),
      actors: [],
      seconds: 5,
      sceneKey: 'tv_presenter_close',
      playback: null,
      scene,
    });

    rig.moveCamera(.016);
    expect(rig.targetPos.x).toBeCloseTo(-4.2, 1);
    expect(rig.targetPos.y).toBeGreaterThan(1);
  });
});
