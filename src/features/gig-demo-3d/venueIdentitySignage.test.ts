// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { buildVenueIdentitySignage, type VenueLabelFactory } from './venueIdentitySignage';
import { resolveVenueProfile } from './venueProfile';
import type { ConcertVenue } from './liveTypes';
import { disposeModel } from '@/features/player-model/model';

const makeLabel: VenueLabelFactory = (text, width, height) => {
  const mesh = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshStandardMaterial());
  mesh.userData.text = text;
  return mesh;
};

describe('venue identity signage', () => {
  it('uses the real venue name and location for indoor signage', () => {
    const profile = resolveVenueProfile({ type: 'rock_club', name: 'The Voltage Room' });
    const venue: ConcertVenue = {
      name: 'The Voltage Room',
      bandName: 'TEST',
      archetype: 'club',
      seed: 77,
      type: 'rock_club',
      capacity: 700,
      cityName: 'Portsmouth',
      country: 'United Kingdom',
    };
    const scene = new T.Scene();
    const root = buildVenueIdentitySignage(scene, profile, venue, makeLabel)!;

    expect(root.getObjectByName('venue-identity-name')?.userData.text).toBe('The Voltage Room');
    expect(root.getObjectByName('venue-identity-location')?.userData.text).toBe('Portsmouth · United Kingdom');
    expect(root.getObjectByName('venue-wayfinding-exit')).toBeDefined();
    expect(root.getObjectByName('venue-stage-nameplate')).toBeDefined();
    disposeModel(scene);
  });

  it('uses a freestanding identity board for outdoor venues', () => {
    const profile = resolveVenueProfile({ type: 'festival_stage' });
    const venue: ConcertVenue = {
      name: 'South Coast Sound',
      bandName: 'TEST',
      archetype: 'festival',
      seed: 91,
      type: 'festival_stage',
      capacity: 20000,
      cityName: 'Brighton',
      country: 'United Kingdom',
    };
    const scene = new T.Scene();
    const root = buildVenueIdentitySignage(scene, profile, venue, makeLabel)!;
    expect(root.getObjectByName('venue-identity-primary')).toBeDefined();
    expect(root.getObjectByName('venue-identity-name')?.userData.text).toBe('South Coast Sound');
    expect(root.getObjectByName('venue-identity-location')?.userData.text).toBe('Brighton · United Kingdom');
    expect(root.getObjectByName('venue-wayfinding-merch')).toBeDefined();
    disposeModel(scene);
  });

  it('keeps the TV studio on its dedicated broadcast branding path', () => {
    const profile = resolveVenueProfile({ type: 'tv_studio' });
    const venue: ConcertVenue = {
      name: 'RockMundo Television Centre',
      bandName: 'TOP OF THE POPS',
      archetype: 'tv_studio',
      seed: 1,
      type: 'tv_studio',
      capacity: 250,
    };
    const scene = new T.Scene();
    expect(buildVenueIdentitySignage(scene, profile, venue, makeLabel)).toBeNull();
    expect(scene.children).toHaveLength(0);
  });
});
