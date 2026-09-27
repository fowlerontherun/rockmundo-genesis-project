// @vitest-environment node
import * as T from 'three';
import { describe, it, expect } from 'vitest';
import { buildVenueProduction, productionLayout, stageLightPositions } from './venueProduction';
import { buildVenueEnvironment } from './venueEnvironment';
import { productionEquipmentSpec } from './venueProductionQuality';
import { resolveVenueProfile, VENUE_TYPES } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';
const label = () => new T.Mesh(new T.PlaneGeometry(1, .3), new T.MeshBasicMaterial());
describe('venue-specific stages', () => {
    it.each(Object.keys(VENUE_TYPES))('%s builds in physical metres with visible production appropriate to its scale', type => {
        const p = resolveVenueProfile({ type }), scene = new T.Scene(), wood = new T.MeshStandardMaterial(), grille = new T.MeshStandardMaterial();
        const stage = buildVenueProduction(scene, p, wood, grille, label, 'TEST BAND');
        expect(stage.scale.toArray()).toEqual([1, 1, 1]);
        const deck = stage.getObjectByName('stage-deck') as T.Mesh;
        const size = new T.Box3().setFromObject(deck).getSize(new T.Vector3());
        expect(size.x).toBeCloseTo(p.stageWidth);
        expect(size.z).toBeCloseTo(p.stageDepth);
        expect(size.y).toBeCloseTo(p.stageHeight);
        const layout = productionLayout(p);
        expect(stageLightPositions(p)).toHaveLength(layout.rows * layout.columns);
        if (layout.wings)
            expect(stage.getObjectByName('stage-side-screen-1')).toBeDefined();
        if (['festival_stage', 'stadium', 'indoor_arena'].includes(type))
            expect(stage.getObjectByName('stage-led-wall')).toBeDefined();
        if (!['theatre', 'jazz_lounge'].includes(type))
            expect(stage.getObjectByName('venue-curtain')).toBeUndefined();
        stage.traverse(node => { if (node instanceof T.Mesh) {
            expect(node.matrixWorld.elements.every(Number.isFinite)).toBe(true);
        } });
        disposeModel(scene);
    });
    it('adds floor area, rows of lighting, PA and a different touring layout instead of inflating club gear', () => {
        const club = resolveVenueProfile({ type: 'rock_club' }), festival = resolveVenueProfile({ type: 'festival_stage' }), small = productionLayout(club), big = productionLayout(festival);
        expect(festival.stageWidth * festival.stageDepth).toBeGreaterThan(club.stageWidth * club.stageDepth * 5);
        expect(big.rows * big.columns).toBeGreaterThan(small.rows * small.columns * 3);
        expect(big.arrayBoxes).toBeGreaterThan(small.arrayBoxes);
        expect(big.subs).toBeGreaterThan(small.subs);
        expect(big.runway).toBe(true);
    });
    it('puts the festival stage and audience beneath a fabric canopy with a closed gable', () => {
        const p = resolveVenueProfile({ type: 'festival_tent' }), scene = new T.Scene();
        const root = buildVenueEnvironment(scene, p, 1, new T.MeshStandardMaterial(), new T.MeshStandardMaterial());
        const roof = root.getObjectByName('tent-fabric-canopy') as T.Mesh, wall = root.getObjectByName('tent-gable');
        expect(roof).toBeDefined();
        expect(wall).toBeDefined();
        const bounds = new T.Box3().setFromObject(roof);
        expect(bounds.min.z).toBeLessThan(.65 - p.stageDepth);
        expect(bounds.max.z).toBeGreaterThan(p.crowdDepth);
        expect(bounds.max.y - bounds.min.y).toBeGreaterThan(3);
        expect(bounds.getSize(new T.Vector3()).x).toBeGreaterThan(p.stageWidth);
        disposeModel(scene);
    });
});

it.each([70, 250, 2500, 5000, 20000])('keeps a %i-capacity tent canopy above its truss', capacity => {
    const p = resolveVenueProfile({type: 'festival_tent', capacity}), scene = new T.Scene();
    const root = buildVenueEnvironment(scene, p, 1, new T.MeshStandardMaterial(), new T.MeshStandardMaterial());
    const roof = root.getObjectByName('tent-fabric-canopy') as T.Mesh;
    const vertices = roof.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
        if (Math.abs(vertices.getX(i)) <= p.stageWidth / 2 + .25) {
            expect(vertices.getY(i)).toBeGreaterThan(p.rigHeight + .2);
        }
    }
    disposeModel(scene);
});


describe('capacity-driven stage production detail', () => {
    const examples = [
        ['street_corner', 40],
        ['dive_bar', 150],
        ['concert_hall', 2500],
        ['stadium', 9000],
        ['stadium', 65000],
    ] as const;

    it('increases actual cabinet, PA, subwoofer and fixture dimensions across five tiers', () => {
        const specs = Array.from({ length: 5 }, (_, tier) => productionEquipmentSpec(tier));
        for (let tier = 1; tier < specs.length; tier++) {
            expect(specs[tier].ampWidth).toBeGreaterThan(specs[tier - 1].ampWidth);
            expect(specs[tier].paWidth).toBeGreaterThan(specs[tier - 1].paWidth);
            expect(specs[tier].subWidth).toBeGreaterThan(specs[tier - 1].subWidth);
            expect(specs[tier].fixtureScale).toBeGreaterThan(specs[tier - 1].fixtureScale);
        }
        expect(specs[4].ampRows * specs[4].ampColumns).toBeGreaterThan(specs[0].ampRows * specs[0].ampColumns);
        expect(specs[4].screenWidth * specs[4].screenHeight).toBeGreaterThan(specs[3].screenWidth * specs[3].screenHeight);
    });

    it.each(examples)('%s at capacity %i retains distinct cabinet sizes and a tier-correct light rig', (kind, capacity) => {
        const p = resolveVenueProfile({ type: kind, capacity }), scene = new T.Scene();
        const wood = new T.MeshStandardMaterial(), grille = new T.MeshStandardMaterial();
        const root = buildVenueProduction(scene, p, wood, grille, label, 'BAND');
        const layout = productionLayout(p), spec = productionEquipmentSpec(layout.tier);
        const cabinet = root.getObjectByName('backline-stack-inner-1-cabinet-0-0');
        expect(cabinet).toBeDefined();
        const dimensions = new T.Box3().setFromObject(cabinet!).getSize(new T.Vector3());
        expect(dimensions.x).toBeCloseTo(spec.ampWidth);
        expect(dimensions.y).toBeCloseTo(spec.ampHeight);
        expect(dimensions.z).toBeCloseTo(spec.ampDepth);
        expect(root.userData.equipment).toEqual(spec);
        let fixtures = 0;
        root.traverse(object => { if (object instanceof T.Group && /^production-light-\d+$/.test(object.name)) fixtures++; });
        expect(fixtures).toBe(layout.rows * layout.columns);
        if (layout.wings) {
            expect(root.getObjectByName('backline-stack-outer-1')).toBeDefined();
            expect(root.getObjectByName('stage-side-screen-1')?.userData.displaySize).toEqual([spec.screenWidth, spec.screenHeight]);
        } else {
            expect(root.getObjectByName('backline-stack-outer-1')).toBeUndefined();
        }
        if (layout.arrayBoxes) {
            expect(root.getObjectByName('line-array-1-0')).toBeDefined();
            expect(root.getObjectByName('line-array-1-' + (layout.arrayBoxes - 1))).toBeDefined();
        }
        disposeModel(scene);
    });

    it('uses a tiled textured steel stage and visibly larger stadium video screens than a mid-size show', () => {
        const studio = resolveVenueProfile({ type: 'rock_club', capacity: 2500 });
        const stadium = resolveVenueProfile({ type: 'stadium', capacity: 65000 });
        const smallScene = new T.Scene(), largeScene = new T.Scene();
        const wood = new T.MeshStandardMaterial(), grille = new T.MeshStandardMaterial();
        const small = buildVenueProduction(smallScene, studio, wood, grille, label, 'BAND');
        const large = buildVenueProduction(largeScene, stadium, wood, grille, label, 'BAND');
        const stageSurfaces: T.MeshStandardMaterial[] = [];
        large.traverse(object => {
            if (object instanceof T.Mesh && object.material instanceof T.MeshStandardMaterial &&
                object.material.userData.venueSurfaceRole === 'stage-deck') stageSurfaces.push(object.material);
        });
        expect(stageSurfaces.length).toBeGreaterThan(0);
        expect(stageSurfaces[0].name).toBe('venue-stage-floor-metal');
        expect(stageSurfaces[0].map?.repeat.x).toBeGreaterThan(10);
        const stadiumScreen = large.getObjectByName('stage-led-wall');
        const clubScreen = small.getObjectByName('stage-led-wall');
        expect(stadiumScreen?.userData.displaySize[0]).toBeGreaterThan(clubScreen?.userData.displaySize[0]);
        expect(large.getObjectByName('stage-side-screen-1-display')).toBeDefined();
        expect(large.getObjectByName('stage-side-screen--1-display')).toBeDefined();
        expect(large.getObjectByName('subwoofer-0')).toBeDefined();
        disposeModel(smallScene);
        disposeModel(largeScene);
    });
});
