import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildTvStudioProduction } from './tvStudioProduction';
import { resolveVenueProfile } from './venueProfile';

describe('Top of the Pops TV studio production', () => {
  it('adds presenter, cameras, operators, jib, monitors and four performance zones to the TV studio', () => {
    const root = new T.Group();
    buildTvStudioProduction(root, resolveVenueProfile({ type: 'tv_studio' }));

    expect(root.getObjectByName('totp-presenter-alex-rayne')).toBeTruthy();
    expect(root.getObjectByName('totp-presenter-left-arm')).toBeTruthy();
    expect(root.getObjectByName('totp-presenter-right-arm')).toBeTruthy();
    expect(root.getObjectByName('totp-presenter-microphone')).toBeTruthy();
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
    expect(root.getObjectByName('totp-stage-b-ring')).toBeTruthy();
    expect(root.getObjectByName('totp-rock-amp-stack')).toBeTruthy();
    expect(root.getObjectByName('totp-studio-floor-ring-outer')).toBeTruthy();
    expect(root.getObjectByName('totp-special-christmas')).toBeFalsy();
    expect(root.getObjectByName('totp-special-anniversary')).toBeFalsy();

    const monitors = root.children.filter((child) => child.name === 'totp-studio-monitor');
    expect(monitors).toHaveLength(3);
  });

  it('builds the locked guest presenter instead of Alex for guest-host editions', () => {
    const root = new T.Group();
    buildTvStudioProduction(root, resolveVenueProfile({ type: 'tv_studio', presenterKey: 'maya_stone', showVariant: 'guest_host' }));

    const maya = root.getObjectByName('totp-presenter-maya-stone');
    expect(maya).toBeTruthy();
    expect(maya?.userData.presenterKey).toBe('maya_stone');
    expect(maya?.userData.presenterDisplayName).toBe('Maya Stone');
    expect(root.getObjectByName('totp-presenter-alex-rayne')).toBeFalsy();
  });

  it('adds Christmas-only set dressing for Christmas specials', () => {
    const root = new T.Group();
    buildTvStudioProduction(root, resolveVenueProfile({ type: 'tv_studio', showVariant: 'christmas' }));

    const special = root.getObjectByName('totp-special-christmas');
    expect(special).toBeTruthy();
    expect(special?.userData.showVariant).toBe('christmas');
    expect(root.getObjectByName('totp-christmas-tree-topper')).toBeTruthy();
    expect(root.getObjectByName('totp-christmas-present-red')).toBeTruthy();
    expect(root.getObjectByName('totp-special-anniversary')).toBeFalsy();
  });

  it('adds anniversary-only gold set dressing for anniversary specials', () => {
    const root = new T.Group();
    buildTvStudioProduction(root, resolveVenueProfile({ type: 'tv_studio', showVariant: 'anniversary' }));

    const special = root.getObjectByName('totp-special-anniversary');
    expect(special).toBeTruthy();
    expect(special?.userData.showVariant).toBe('anniversary');
    expect(root.getObjectByName('totp-anniversary-header')).toBeTruthy();
    expect(root.getObjectByName('totp-anniversary-emblem')).toBeTruthy();
    expect(root.getObjectByName('totp-special-christmas')).toBeFalsy();
  });

  it('selects a deterministic illuminated set from the replay seed', () => {
    const names = new Set<string>();
    for (let seed = 1; seed <= 9; seed += 1) {
      const root = new T.Group();
      buildTvStudioProduction(root, resolveVenueProfile({ type: 'tv_studio', seed }));
      const set = root.children.find((child) => child.name.startsWith('totp-set-variant-'));
      expect(set).toBeTruthy();
      names.add(set!.name);
    }
    expect(names.size).toBeGreaterThan(1);

    const first = new T.Group();
    const second = new T.Group();
    buildTvStudioProduction(first, resolveVenueProfile({ type: 'tv_studio', seed: 4242 }));
    buildTvStudioProduction(second, resolveVenueProfile({ type: 'tv_studio', seed: 4242 }));
    expect(first.children.find((child) => child.name.startsWith('totp-set-variant-'))?.name)
      .toBe(second.children.find((child) => child.name.startsWith('totp-set-variant-'))?.name);
  });

  it('falls back to Alex Rayne for unknown presenter keys', () => {
    const root = new T.Group();
    buildTvStudioProduction(root, resolveVenueProfile({ type: 'tv_studio', presenterKey: 'unknown_host' }));
    expect(root.getObjectByName('totp-presenter-alex-rayne')).toBeTruthy();
  });

  it('does not add television production props or stage zones to normal gig venues', () => {
    const root = new T.Group();
    buildTvStudioProduction(root, resolveVenueProfile({ type: 'rock_club' }));
    expect(root.children).toHaveLength(0);
  });
});