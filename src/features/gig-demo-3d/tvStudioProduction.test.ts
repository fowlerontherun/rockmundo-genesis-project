import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildTvStudioProduction } from './tvStudioProduction';
import { resolveVenueProfile } from './venueProfile';

describe('Top of the Pops TV studio production', () => {
  it('adds presenter, cameras, operators, jib, monitors and four performance zones to the TV studio', () => {
    const root = new T.Group();
    buildTvStudioProduction(root, resolveVenueProfile({ type: 'tv_studio' }));

    expect(root.getObjectByName('totp-presenter-alex-rayne')).toBeTruthy();
    expect(root.getObjectByName('totp-camera-pedestal-left')).toBeTruthy();
    expect(root.getObjectByName('totp-camera-pedestal-right')).toBeTruthy();
    expect(root.getObjectByName('totp-camera-handheld')).toBeTruthy();
    expect(root.getObjectByName('totp-camera-jib')).toBeTruthy();
    expect(root.getObjectByName('totp-operator-left')).toBeTruthy();
    expect(root.getObjectByName('totp-operator-right')).toBeTruthy();
    expect(root.getObjectByName('totp-operator-handheld')).toBeTruthy();
    expect(root.getObjectByName('totp-zone-main-stage')).toBeTruthy();
    expect(root.getObjectByName('totp-zone-stage-b')).toBeTruthy();
    expect(root.getObjectByName('totp-zone-rock-stage')).toBeTruthy();
    expect(root.getObjectByName('totp-zone-studio-floor')).toBeTruthy();

    const monitors = root.children.filter((child) => child.name === 'totp-studio-monitor');
    expect(monitors).toHaveLength(3);
  });

  it('does not add television production props or stage zones to normal gig venues', () => {
    const root = new T.Group();
    buildTvStudioProduction(root, resolveVenueProfile({ type: 'rock_club' }));
    expect(root.children).toHaveLength(0);
  });
});
