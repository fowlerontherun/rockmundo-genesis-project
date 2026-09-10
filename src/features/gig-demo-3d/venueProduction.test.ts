// @vitest-environment node
import * as T from 'three';
import { describe, it, expect } from 'vitest';
import { buildVenueProduction, productionLayout, stageLightPositions } from './venueProduction';
import { buildVenueEnvironment } from './venueEnvironment';
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
