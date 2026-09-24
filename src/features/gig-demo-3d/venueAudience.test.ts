// @vitest-environment node
import * as T from 'three';
import { describe, it, expect } from 'vitest';
import { audienceHumanGeometry, audienceFloorPlaces, buildVenueAudience, updateVenueAudience, detailedCrowdArea, isTvStudioAudienceBlocked, AUDIENCE_BUDGET } from './venueAudience';
import { resolveVenueProfile } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

describe('dense anatomical audiences', () => {
    it('has joined heads, arms, feet, separate legs and natural skin colours with bounded geometry', () => {
        for (let kind = 0; kind < 4; kind++)
            for (const seated of [false, true]) {
                const g = audienceHumanGeometry(kind, seated), p = g.attributes.position, c = g.attributes.color;
                expect(p.count / 3).toBeLessThan(450);
                expect(g.boundingBox!.min.y).toBeCloseTo(0);
                expect(g.boundingBox!.max.y).toBeGreaterThan(seated ? 1.1 : 1.6);
                const colours = new Set<string>();
                let leftFoot = false, rightFoot = false, neck = false;
                for (let i = 0; i < p.count; i++) {
                    colours.add([c.getX(i), c.getY(i), c.getZ(i)].map(x => x.toFixed(3)).join(','));
                    if (p.getY(i) < .1) {
                        if (p.getX(i) < -.04) leftFoot = true;
                        if (p.getX(i) > .04) rightFoot = true;
                    }
                    if (Math.abs(p.getX(i)) < .075 && p.getY(i) > (seated ? 1 : 1.32) && p.getY(i) < (seated ? 1.2 : 1.48)) neck = true;
                }
                expect(colours.size).toBe(5);
                expect(leftFoot && rightFoot && neck).toBe(true);
                g.dispose();
            }
    });

    it('keeps close rows dense and excludes them and the runway from the distant crowd', () => {
        const p = resolveVenueProfile({ type: 'festival_stage', capacity: 20000 }), area = detailedCrowdArea(p), places = audienceFloorPlaces(p);
        expect(area.width).toBe(13);
        expect(area.depth).toBe(11);
        expect(places.length).toBeGreaterThan(7000);
        for (const [x, , z] of places) {
            expect(z < 10 && Math.abs(x) < 3.6).toBe(false);
            expect(z < area.front + area.depth + 1.5 && Math.abs(x) < area.width * .57 + .45 + (z < 10 ? 3.8 : 0)).toBe(false);
        }
    });

    it('keeps the Top of the Pops close crowd inside a compact television pocket', () => {
        const studio = resolveVenueProfile({ type: 'tv_studio', capacity: 250 });
        const area = detailedCrowdArea(studio);
        expect(area.width).toBe(8);
        expect(area.depth).toBeLessThanOrEqual(3.6);
        expect(area.front).toBeGreaterThanOrEqual(1.7);
        expect(area.front).toBeLessThan(2);
        expect(area.runway).toBe(false);
    });

    it('excludes distant TOTP audience from side stages, studio floor and production cameras', () => {
        const studio = resolveVenueProfile({ type: 'tv_studio', capacity: 250 });
        expect(isTvStudioAudienceBlocked(5.4, 2.05, studio)).toBe(true);
        expect(isTvStudioAudienceBlocked(-4.5, 4.05, studio)).toBe(true);
        expect(isTvStudioAudienceBlocked(1.4, 5.65, studio)).toBe(true);
        expect(isTvStudioAudienceBlocked(studio.stageWidth * .24, 2.55, studio)).toBe(true);
        expect(isTvStudioAudienceBlocked(-2.85, 2.05, studio)).toBe(true);
        expect(isTvStudioAudienceBlocked(0, 3.55, studio)).toBe(true);
        expect(isTvStudioAudienceBlocked(-studio.crowdWidth * .32, 4.7, studio)).toBe(true);
        expect(isTvStudioAudienceBlocked(studio.crowdWidth * .32, 5.1, studio)).toBe(true);
        const places = audienceFloorPlaces(studio);
        expect(places.length).toBeGreaterThan(0);
        expect(places.every(([x, , z]) => !isTvStudioAudienceBlocked(x, z, studio))).toBe(true);
        expect(places.every(([x, , z]) => !(Math.abs(x) < .58 && Math.abs(z - 3.55) < 2.4))).toBe(true);
    });

    it('does not apply TOTP blocking rules to ordinary venues', () => {
        const club = resolveVenueProfile({ type: 'rock_club', capacity: 500 });
        expect(isTvStudioAudienceBlocked(5.4, 2.05, club)).toBe(false);
    });

    it('renders thousands of complete humans at full attendance with no quality-dependent holes and never invents fans', () => {
        const p = resolveVenueProfile({ type: 'stadium' }), root = new T.Group(), audience = buildVenueAudience(root, p, 123, []);
        const count = () => audience.children.reduce((sum, m) => sum + (m as T.InstancedMesh).count, 0);
        expect(count()).toBe(0);
        updateVenueAudience(audience, 1, 10, false, .8, 160);
        expect(count()).toBeGreaterThan(8000);
        expect(count()).toBeLessThanOrEqual(AUDIENCE_BUDGET);
        updateVenueAudience(audience, 0, 10, false, .8, 0);
        expect(count()).toBe(0);
        updateVenueAudience(audience, 10 / p.capacity, 10, false, .8, 10);
        expect(count()).toBe(0);
        updateVenueAudience(audience, .5, 10, false, .8, 160);
        const half = count();
        updateVenueAudience(audience, .1, 90, false, .8, 160);
        updateVenueAudience(audience, .5, 10, false, .8, 160);
        expect(count()).toBe(half);
        updateVenueAudience(audience, .5, 10, true, .8, 160);
        expect(audience.userData.strength.value).toBe(0);
        expect(audience.userData.clock.value).toBe(0);
        disposeModel(root);
    });
});