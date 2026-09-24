import * as T from 'three';
import { box, matte, metal, rod } from './stage';
import type { ConcertVenue } from './liveTypes';
import type { VenueProfile } from './venueProfile';

export type VenueLabelFactory = (
  text: string,
  width: number,
  height: number,
  color?: string,
  background?: string,
) => T.Mesh;

function feature(parent: T.Object3D, name: string) {
  const group = new T.Group();
  group.name = name;
  parent.add(group);
  return group;
}

function sanitize(text: string | null | undefined, fallback: string, max = 36) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return (clean || fallback).slice(0, max);
}

function locationText(venue: ConcertVenue) {
  const city = sanitize(venue.cityName, '', 22);
  const country = sanitize(venue.country, '', 22);
  if (city && country) return `${city} · ${country}`;
  if (city) return city;
  if (country) return country;
  return sanitize(venue.location, '', 32);
}

function addMountedLabel(
  parent: T.Object3D,
  makeLabel: VenueLabelFactory,
  text: string,
  position: [number, number, number],
  size: [number, number],
  rotationY = 0,
  color = '#e7dfcf',
  background = '#151a20',
  name?: string,
) {
  const frame = matte('#161b21', .72);
  box(parent, [size[0] + .24, size[1] + .18, .09], position, frame).rotation.y = rotationY;
  const label = makeLabel(text, size[0], size[1], color, background);
  label.position.set(position[0], position[1], position[2] - .055);
  label.rotation.y = rotationY;
  if (name) label.name = name;
  parent.add(label);
  return label;
}

function addWallWayfinding(
  parent: T.Object3D,
  makeLabel: VenueLabelFactory,
  p: VenueProfile,
  side: -1 | 1,
  z: number,
  text: string,
  color: string,
) {
  const x = side * (p.roomWidth / 2 - .18);
  const panel = makeLabel(text, 1.7, .44, color, '#1b2329');
  panel.position.set(x - side * .055, Math.min(2.65, p.roofHeight - .55), z);
  panel.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  panel.name = `venue-wayfinding-${text.toLowerCase().replace(/\s+/g, '-')}`;
  parent.add(panel);
}

function addFreestandingBoard(
  parent: T.Object3D,
  makeLabel: VenueLabelFactory,
  text: string,
  x: number,
  z: number,
  width: number,
  palette: { dark: T.Material; steel: T.Material },
  subtitle?: string,
) {
  const boardY = 2.15;
  for (const dx of [-width * .42, width * .42])
    rod(parent, [x + dx, 0, z], [x + dx, boardY + .75, z], .035, palette.steel);
  box(parent, [width + .25, 1.15, .12], [x, boardY, z], palette.dark);
  const title = makeLabel(text, width, .64, '#f0e7d7', '#10161d');
  title.position.set(x, boardY + .14, z - .07);
  title.name = 'venue-identity-name';
  parent.add(title);
  if (subtitle) {
    const sub = makeLabel(subtitle, width * .82, .28, '#9ec2cc', '#10161d');
    sub.position.set(x, boardY - .32, z - .075);
    sub.name = 'venue-identity-location';
    parent.add(sub);
  }
}

export function buildVenueIdentitySignage(
  scene: T.Scene,
  p: VenueProfile,
  venue: ConcertVenue,
  makeLabel: VenueLabelFactory,
) {
  if (p.kind === 'tv_studio') return null;

  const root = new T.Group();
  root.name = `venue-identity-signage-${p.kind}`;
  scene.add(root);

  const venueName = sanitize(venue.name, p.label, 34);
  const location = locationText(venue);
  const half = p.roomWidth / 2;
  const back = .65 - p.stageDepth - 1.4;
  const dark = matte('#151b21', .78);
  const steel = metal('#66717a', .52);
  const accent = new T.MeshStandardMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: .35, roughness: .66 });
  const palette = { dark, steel };
  root.userData.venueName = venueName;
  root.userData.location = location || null;

  const identity = feature(root, 'venue-identity-primary');
  if (!p.outdoor && p.kind !== 'festival_tent') {
    const width = Math.min(Math.max(3.8, venueName.length * .23), Math.max(4.2, p.roomWidth * .42));
    addMountedLabel(
      identity,
      makeLabel,
      venueName,
      [0, Math.min(p.roofHeight - .9, 4.5), back + .22],
      [width, .78],
      0,
      '#efe6d7',
      '#141a20',
      'venue-identity-name',
    );
    if (location) {
      const sub = makeLabel(location, Math.min(width * .72, 5.4), .34, '#9cb8c2', '#141a20');
      sub.position.set(0, Math.min(p.roofHeight - 1.48, 3.92), back + .155);
      sub.name = 'venue-identity-location';
      identity.add(sub);
    }
  } else {
    const boardZ = Math.min(p.roomDepth - 2.5, Math.max(p.crowdDepth + 5.5, 10));
    addFreestandingBoard(identity, makeLabel, venueName, 0, boardZ, Math.min(7.8, Math.max(4.4, venueName.length * .25)), palette, location || undefined);
  }

  const wayfinding = feature(root, 'venue-identity-wayfinding');
  if (!p.outdoor && p.kind !== 'festival_tent') {
    addWallWayfinding(wayfinding, makeLabel, p, -1, Math.min(p.roomDepth - 2.5, 5.2), 'EXIT', '#a6e5bd');
    addWallWayfinding(wayfinding, makeLabel, p, 1, Math.min(p.roomDepth - 2.5, 8.7), p.capacity > 1200 ? 'MERCH' : 'BAR', '#e0c58f');
    if (p.capacity > 1500)
      addWallWayfinding(wayfinding, makeLabel, p, -1, Math.min(p.roomDepth - 2.5, 13.2), 'TOILETS', '#b7cad3');
  } else {
    const z = Math.min(p.roomDepth - 2.5, Math.max(8, p.crowdDepth * .72));
    for (const [side, text, color] of [
      [-1, 'EXIT', '#a6e5bd'],
      [1, p.capacity > 4000 ? 'MERCH' : 'BAR', '#e0c58f'],
    ] as const) {
      const x = side * Math.min(half - 1.6, p.crowdWidth / 2 + 2.4);
      rod(wayfinding, [x, 0, z], [x, 2.9, z], .03, steel);
      const panel = makeLabel(text, 1.65, .42, color, '#172028');
      panel.position.set(x, 2.72, z);
      panel.name = `venue-wayfinding-${text.toLowerCase()}`;
      wayfinding.add(panel);
    }
  }

  const stageBranding = feature(root, 'venue-identity-stage-nameplate');
  const plateWidth = Math.min(5.4, Math.max(2.8, venueName.length * .19));
  const plate = makeLabel(venueName, plateWidth, .42, '#d9d0c2', '#12171d');
  plate.position.set(0, p.stageHeight + .34, .69);
  plate.name = 'venue-stage-nameplate';
  stageBranding.add(plate);
  box(stageBranding, [plateWidth + .18, .52, .08], [0, p.stageHeight + .34, .73], accent);

  return root;
}
