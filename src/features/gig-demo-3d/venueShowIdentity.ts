import * as T from 'three';
import { box, matte, metal, rod } from './stage';
import type { VenueProfile } from './venueProfile';

/**
 * Fixed dressing for the production rig, deliberately separated from room architecture:
 * it has no gameplay effect and is deterministic for completed-gig replays.
 * Hardware stays real-sized. Large venues add more units, not giant stretched props.
 */
export type ShowIdentity = 'heritage' | 'club' | 'arena' | 'stadium' | 'festival' | 'coastal' | 'urban' | 'broadcast';
export interface VenueShowPlan {
  readonly identity: ShowIdentity;
  readonly lightingBattenCount: number;
  readonly frontFasciaPanels: number;
  readonly wingVideoTotems: number;
  readonly hasVideoFascia: boolean;
  readonly hasScreenSafetyRig: boolean;
  readonly hasCrowdBarrier: boolean;
  readonly hasWeatherValance: boolean;
}

export function resolveVenueShowPlan(p: VenueProfile, tier: number): VenueShowPlan {
  const identity: ShowIdentity =
    p.kind === 'tv_studio' ? 'broadcast' :
    ['theatre', 'concert_hall', 'jazz_lounge', 'church_hall'].includes(p.kind) ? 'heritage' :
    ['stadium'].includes(p.kind) ? 'stadium' :
    ['indoor_arena', 'ice_arena', 'amphitheatre'].includes(p.kind) ? 'arena' :
    ['festival_stage', 'festival_tent'].includes(p.kind) ? 'festival' :
    p.kind === 'beach_stage' ? 'coastal' :
    ['street_corner', 'city_square', 'rooftop_terrace', 'park_bandstand'].includes(p.kind) ? 'urban' : 'club';
  const big = tier >= 3 && identity !== 'broadcast';
  const televised = identity === 'arena' || identity === 'stadium' || identity === 'festival';
  return {
    identity,
    lightingBattenCount: tier < 2 || identity === 'broadcast' ? 0 : tier === 2 ? 4 : tier === 3 ? 8 : 12,
    frontFasciaPanels: tier <= 1 || identity === 'broadcast' ? 0 : Math.min(12, 4 + tier * 2),
    wingVideoTotems: big && televised ? (tier === 4 ? 2 : 1) : 0,
    hasVideoFascia: big && televised,
    hasScreenSafetyRig: big,
    hasCrowdBarrier: big && identity !== 'heritage',
    hasWeatherValance: big && (identity === 'festival' || identity === 'coastal' || identity === 'stadium'),
  };
}

/** Accessible by name to venue previews and QA, without affecting crowd/performer placement. */
export function buildVenueShowIdentity(root: T.Group, p: VenueProfile, tier: number) {
  const plan = resolveVenueShowPlan(p, tier);
  const group = new T.Group();
  group.name = 'venue-show-identity-' + p.kind;
  group.userData.showPlan = plan;
  root.add(group);

  if (plan.identity === 'broadcast') return group; // Broadcast's authored three-stage set is separate.

  const half = p.stageWidth / 2, front = .65, back = .65 - p.stageDepth, y = p.stageHeight;
  const trim = metal(plan.identity === 'heritage' ? '#a68c64' : '#667987', .43);
  const black = matte('#151a20', .86);
  const accent = new T.MeshStandardMaterial({
    color: p.accent,
    emissive: p.accent,
    emissiveIntensity: plan.identity === 'heritage' ? .38 : .9,
    roughness: .38,
    metalness: .15,
  });
  const muted = new T.MeshStandardMaterial({ color: '#5e747c', emissive: '#304f57', emissiveIntensity: .32, roughness: .52 });

  // Stage skirting is one continuous structure; a higher-capacity show adds
  // individual, human-sized modular fascia panels rather than enlarging a logo.
  const fascia = new T.Group();
  fascia.name = 'venue-stage-fascia';
  group.add(fascia);
  const skirtingHeight = Math.max(.12, y * .72);
  box(fascia, [p.stageWidth - .18, skirtingHeight, .10], [0, skirtingHeight / 2, front + .055], black);
  if (plan.frontFasciaPanels > 0) {
    const panelWidth = (p.stageWidth - .45) / plan.frontFasciaPanels;
    for (let i = 0; i < plan.frontFasciaPanels; i++) {
      const x = -half + .225 + (i + .5) * panelWidth;
      box(fascia, [panelWidth - .045, skirtingHeight * .65, .025],
        [x, skirtingHeight * .48, front + .123],
        plan.hasVideoFascia && i % 3 !== 1 ? accent : muted);
      box(fascia, [panelWidth - .02, .027, .025],
        [x, skirtingHeight * .78, front + .142], trim);
    }
  } else if (tier === 1) {
    box(fascia, [p.stageWidth * .65, .04, .04], [0, skirtingHeight * .7, front + .13], trim);
  }
  fascia.userData.panels = plan.frontFasciaPanels;

  if (plan.lightingBattenCount) {
    // Focusing battens sit under the flown truss; they never hang into band headroom.
    const battens = new T.Group();
    battens.name = 'venue-production-battens';
    group.add(battens);
    const run = p.stageWidth * .8;
    for (let i = 0; i < plan.lightingBattenCount; i++) {
      const x = (i / (plan.lightingBattenCount - 1) - .5) * run;
      const z = back + p.stageDepth * (i % 2 ? .57 : .2);
      const h = p.rigHeight - Math.min(.55, .3 + tier * .05);
      box(battens, [.58, .09, .14], [x, h, z], black);
      box(battens, [.49, .025, .085], [x, h - .055, z], accent);
      for (const dx of [-.25, .25])
        rod(battens, [x + dx, h + .04, z], [x + dx, h + .24, z], .016, trim);
    }
  }

  // Touring IMAG support bridges and safety cables visibly connect each wing
  // display to a flown load path instead of leaving a screen floating in space.
  if (plan.hasScreenSafetyRig) {
    const rigging = new T.Group();
    rigging.name = 'venue-screen-support-rigging';
    group.add(rigging);
    const screenTop = y + (tier === 4 ? 7.4 : 4.5) * 1.2 + .2;
    const spanZ = back + p.stageDepth * .6;
    for (const side of [-1, 1]) {
      const x = side * (half + 3.2);
      rod(rigging, [side * half, p.rigHeight - .2, spanZ], [x, p.rigHeight - .2, spanZ], .065, trim);
      rod(rigging, [x - .65, p.rigHeight - .2, spanZ], [x - .65, screenTop, spanZ], .018, trim);
      rod(rigging, [x + .65, p.rigHeight - .2, spanZ], [x + .65, screenTop, spanZ], .018, trim);
      box(rigging, [1.5, .22, .26], [x, p.rigHeight - .23, spanZ], black);
      for (const horizontal of [-.7, .7])
        box(rigging, [.09, .12, .3], [x + horizontal, p.rigHeight - .3, spanZ], trim);
    }
    rigging.userData.supportedScreens = 2;
  }

  if (plan.wingVideoTotems) {
    const totems = new T.Group();
    totems.name = 'venue-video-totems';
    group.add(totems);
    const h = tier === 4 ? 4.3 : 2.85;
    for (const side of [-1, 1]) for (let index = 0; index < plan.wingVideoTotems; index++) {
      const x = side * (half - 1.05 - index * 1.4);
      const z = back + .32;
      box(totems, [.94, h + .18, .25], [x, y + h / 2 + .15, z], black);
      box(totems, [.78, h, .035], [x, y + h / 2 + .15, z + .145], accent);
      for (let row = 1; row < Math.ceil(h / .72); row++)
        box(totems, [.8, .012, .02], [x, y + .15 + row * h / Math.ceil(h / .72), z + .167], trim);
    }
    totems.userData.count = 2 * plan.wingVideoTotems;
  }

  if (plan.hasWeatherValance) {
    // Festival and stadium weather shields carry a recognizable roof-line banner.
    const valance = new T.Group();
    valance.name = 'venue-weatherproof-stage-valance';
    group.add(valance);
    const topY = p.rigHeight + .06;
    box(valance, [p.stageWidth + 1.3, .78, .20], [0, topY, front + .13], black);
    box(valance, [p.stageWidth + 1.32, .06, .24], [0, topY - .37, front + .16], accent);
    for (const side of [-1, 1])
      box(valance, [.1, .76, .24], [side * (half + .65), topY, front + .16], trim);
  }

  if (plan.hasCrowdBarrier) {
    // Realistic two-rail barricade, with an unobstructed central runway access.
    const barriers = new T.Group();
    barriers.name = 'venue-front-crowd-barriers';
    group.add(barriers);
    const runwayGap = tier === 4 && ['indoor_arena','stadium','festival_stage'].includes(p.kind) ? 3.3 : .25;
    const extent = Math.max(1, half - .5);
    const barrierZ = front + (tier === 4 ? 2.1 : 1.65);
    for (const side of [-1, 1]) {
      const from = side * (runwayGap / 2), to = side * extent;
      rod(barriers, [from, 1.1, barrierZ], [to, 1.1, barrierZ], .045, trim);
      rod(barriers, [from, .58, barrierZ], [to, .58, barrierZ], .034, trim);
      const supports = Math.max(2, Math.ceil((extent - runwayGap / 2) / 1.6));
      for (let i = 0; i <= supports; i++) {
        const x = from + (to - from) * i / supports;
        rod(barriers, [x, 0, barrierZ], [x, 1.1, barrierZ], .029, trim);
        box(barriers, [.38, .045, .72], [x, .025, barrierZ + .23], black);
      }
    }
    barriers.userData.runwayGap = runwayGap;
  }

  return group;
}
