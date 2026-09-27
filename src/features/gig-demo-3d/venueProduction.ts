import * as T from 'three';
import { box, rod, matte, metal, batchStaticMeshes } from './stage';
import type { VenueProfile } from './venueProfile';
import { buildVenueShowIdentity, resolveVenueShowPlan } from './venueShowIdentity';
import { planVenueLighting } from './venueLightShow';
import {
    addAmplifierStack,
    addLineArrayCabinet,
    addMovingHead,
    addSubwoofer,
    addVideoScreen,
    createStageDeckMaterial,
    createVenueShowScreenTexture,
    createVenueSpeakerGrille,
    productionEquipmentSpec,
} from './venueProductionQuality';

function stagePositionForTv(p: VenueProfile, u: number, v: number): [number, number, number] {
    return [(u - .5) * p.stageWidth * .78, p.stageHeight, .65 - p.stageDepth * .91 + v * p.stageDepth * .8];
}
export function productionLayout(p: VenueProfile) {
    const tier = p.production === 'portable' ? 0 : p.capacity <= 500 ? 1 : p.capacity <= 3000 ? 2 : p.capacity <= 15000 ? 3 : 4;
    return { tier, rows: [1, 1, 2, 3, 4][tier], columns: [2, 4, 6, 10, 14][tier], arrayBoxes: [0, 2, 4, 8, 12][tier], subs: [0, 2, 4, 8, 14][tier], monitors: [2, 3, 4, 6, 8][tier], wings: tier >= 3, runway: tier >= 4 && ['stadium', 'festival_stage', 'indoor_arena'].includes(p.kind) };
}
export function stageLightPositions(p: VenueProfile) {
    const layout = productionLayout(p), positions: [
        number,
        number,
        number
    ][] = [];
    for (let row = 0; row < layout.rows; row++)
        for (let col = 0; col < layout.columns; col++)
            positions.push([(col / (layout.columns - 1) - .5) * p.stageWidth * .88, p.rigHeight - .35, .65 - p.stageDepth * (.87 - row / Math.max(1, layout.rows - 1) * .8)]);
    return positions;
}
/** The pair of slim LED battens lives *outside* the active stage picture so
 * artist names remain readable in wide camera shots of every venue size. */
export function stageLedEdgePositions(p: VenueProfile) {
    const positions: { x: number; height: number }[] = [];
    const gap = p.rigHeight - p.stageHeight;
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
        const x = side * p.stageWidth * (.385 + i * .011);
        const phase = (i + (side < 0 ? 0 : 9)) * .83;
        positions.push({ x, height: gap * (.1 + Math.sin(phase) ** 2 * .35) });
    }
    return positions;
}

/** Reserve a visible gap above the LED picture for the independent band
 * banner, rather than drawing a second label across the top of the artwork. */
export function stageBannerLayout(p: VenueProfile, ledScreen: boolean) {
    const height = Math.min(1.1, p.stageWidth * .13);
    if (!ledScreen) {
        return { centerY: Math.min(p.rigHeight - 1, p.stageHeight + (p.rigHeight - p.stageHeight) * .77), height, screenTop: null };
    }
    const gap = p.rigHeight - p.stageHeight;
    const screenTop = p.stageHeight + gap * (.49 + .65 / 2);
    const clearance = p.rigHeight - screenTop;
    return { centerY: screenTop + clearance * .5, height: Math.min(height, clearance * .55), screenTop };
}

/** Keep actual tile dimensions on smaller pieces of the same stage floor.
 * All floor surfaces use the original pair of colour/bump maps (two GPU
 * textures per venue, not two new textures for each wing, stair or runway).
 * Three.js BoxGeometry's +Y face occupies UV vertices 8–11. */
export function tileStageFloorPatch(
    mesh: T.Mesh, p: VenueProfile, width: number, depth: number, role: string,
) {
    const uv = mesh.geometry.attributes.uv;
    for (let i = 8; i < 12; i++)
        uv.setXY(i, uv.getX(i) * width / p.stageWidth, uv.getY(i) * depth / p.stageDepth);
    uv.needsUpdate = true;
    mesh.name = role;
    mesh.userData.venueFloorPatch = { width, depth, repeatX: width / 2.4, repeatZ: depth / 2.4 };
    return mesh;
}

/** Stairs start away from the stage and rise *toward* the stage lip.
 * Using an exact fraction of the stage height avoids the previous highest
 * tread overshooting the deck on most capacity tiers. */
export function stageAccessStairPlan(p: VenueProfile) {
    const count = Math.max(1, Math.ceil(p.stageHeight / .22));
    const rise = p.stageHeight / count;
    const run = .38;
    return Array.from({ length: count }, (_, index) => ({
        index, height: (index + 1) * rise,
        z: .65 + (count - 1 - index) * run,
        rise, run,
    }));
}

/** Production uses metre-sized equipment. A larger show adds rigging and PA,
 * rather than stretching a club's amplifiers and curtain with its floor. */
export function buildVenueProduction(scene: T.Scene, p: VenueProfile, wood: T.Material, grille: T.Material, makeLabel: (text: string, w: number, h: number) => T.Mesh, bandName: string) {
    const root = new T.Group();
    root.name = 'venue';
    root.userData.profile = p;
    root.userData.production = productionLayout(p);
    scene.add(root);
    const layout = productionLayout(p), equipment = productionEquipmentSpec(layout.tier), half = p.stageWidth / 2, back = .65 - p.stageDepth, y = p.stageHeight;
    root.userData.equipment = equipment;
    const black = matte('#11151d'), steel = metal('#58636e'), chrome = metal('#a4adb7'), trim = matte(p.accent);
    // One map/material per audio cabinet role for the whole stage and every
    // audience delay tower; backline amps retain the existing grille material.
    const paGrille = layout.arrayBoxes ? createVenueSpeakerGrille(equipment, 'line-array') : grille;
    const subGrille = layout.subs ? createVenueSpeakerGrille(equipment, 'subwoofer') : grille;
    const deck = box(root, [p.stageWidth, y, p.stageDepth], [0, y / 2, .65 - p.stageDepth / 2], black);
    deck.name = 'stage-deck';
    const deckSurface = createStageDeckMaterial(p, wood);
    tileStageFloorPatch(
        box(root, [p.stageWidth, .065, p.stageDepth], [0, y - .032, .65 - p.stageDepth / 2], deckSurface),
        p, p.stageWidth, p.stageDepth, 'stage-main-deck-surface',
    );
    // A continuous metal edge across the centre looked like an obstruction
    // on venues with a runway. Split it at the 3.2m runway entrance instead.
    if (layout.runway) {
        const sideWidth = (p.stageWidth - 3.2) / 2;
        for (const side of [-1, 1])
            box(root, [sideWidth, .035, .05],
                [side * (1.6 + sideWidth / 2), y + .01, .65], chrome).name = 'stage-front-edge-' + side;
    } else {
        box(root, [p.stageWidth, .035, .05], [0, y + .01, .65], chrome).name = 'stage-front-edge';
    }
    if (layout.wings)
        for (const side of [-1, 1]) {
            const x = side * (half + 2), depth = p.stageDepth * .78;
            const z = back + p.stageDepth * .45;
            box(root, [4, y, p.stageDepth * .8], [x, y / 2, z], black);
            tileStageFloorPatch(
                box(root, [3.8, .04, depth], [x, y - .019, z], deckSurface),
                p, 3.8, depth, 'stage-side-wing-deck-surface-' + side,
            );
        }
    if (layout.runway) {
        const runway = box(root, [3.2, y, 6], [0, y / 2, 3.65], black);
        runway.name = 'stage-runway';
        // The wider head begins exactly where the narrow runway ends.
        // Overlapping equal-height floor patches flicker (Z-fight) in wide shots.
        const runwayHeadZ = .65 + 6 + 2.8 / 2;
        const head = box(root, [6, y, 2.8], [0, y / 2, runwayHeadZ], black);
        head.name = 'stage-runway-head';
        tileStageFloorPatch(
            box(root, [3.2, .065, 6], [0, y - .032, 3.65], deckSurface),
            p, 3.2, 6, 'stage-runway-deck-surface',
        );
        tileStageFloorPatch(
            box(root, [6, .065, 2.8], [0, y - .032, runwayHeadZ], deckSurface),
            p, 6, 2.8, 'stage-runway-head-surface',
        );
        const edgeLED = new T.MeshStandardMaterial({
            color: p.accent, emissive: p.accent, emissiveIntensity: .9, roughness: .28,
        });
        edgeLED.name = 'stage-runway-edge-led';
        for (const side of [-1, 1]) {
            box(root, [.028, .025, 6], [side * 1.58, y + .025, 3.65], edgeLED);
            box(root, [.028, .025, 2.8], [side * 2.96, y + .025, runwayHeadZ], edgeLED);
        }
        box(root, [5.94, .025, .028], [0, y + .025, runwayHeadZ + 1.37], edgeLED);
    }
    const access = new T.Group();
    access.name = 'stage-side-access-stairs';
    root.add(access);
    const stairPlan = stageAccessStairPlan(p);
    access.userData.stepsPerSide = stairPlan.length;
    access.userData.rise = stairPlan[0].rise;
    access.userData.run = stairPlan[0].run;
    const litNose = layout.tier >= 3 ? new T.MeshStandardMaterial({
        color: p.accent, emissive: p.accent, emissiveIntensity: .6, roughness: .3,
    }) : chrome;
    for (const side of [-1, 1]) {
        const x = side * (half + .65);
        for (const step of stairPlan) {
            box(access, [1.2, step.height, .35], [x, step.height / 2, step.z], black);
            tileStageFloorPatch(
                box(access, [1.16, .03, .34], [x, step.height - .012, step.z], deckSurface),
                p, 1.16, .34, 'stage-access-tread-' + side + '-' + step.index,
            );
            box(access, [1.17, .022, .028],
                [x, step.height + .008, step.z + .17], litNose);
        }
        if (y >= .9) {
            // Single sloped handrail per side of each stair, with upright
            // brackets rather than unsupported lines cutting through treads.
            const lowest = stairPlan[0], highest = stairPlan[stairPlan.length - 1];
            for (const dx of [-.57, .57]) {
                const railX = x + dx;
                rod(access, [railX, lowest.height + .86, lowest.z],
                    [railX, highest.height + .86, highest.z], .024, chrome);
                for (const step of [lowest, highest])
                    rod(access, [railX, step.height, step.z],
                        [railX, step.height + .86, step.z], .017, chrome);
            }
        }
    }
    // A real cross-braced truss, with a fixed tube diameter at every venue size.
    const truss = (a: number[], b: number[]) => {
        for (const offset of [-.18, .18])
            rod(root, [a[0], a[1] + offset, a[2]], [b[0], b[1] + offset, b[2]], .028, steel);
        const length = new T.Vector3(...a).distanceTo(new T.Vector3(...b)), n = Math.ceil(length / .65);
        for (let i = 0; i < n; i++) {
            const t = i / n, u = (i + 1) / n;
            rod(root, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - .18, a[2] + (b[2] - a[2]) * t], [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + .18, a[2] + (b[2] - a[2]) * u], .012, steel);
        }
    };
    if (layout.tier > 0 && p.kind !== 'park_bandstand') {
        for (let row = 0; row < layout.rows; row++) {
            const z = back + p.stageDepth * (.13 + row / Math.max(1, layout.rows - 1) * .8);
            truss([-half, p.rigHeight, z], [half, p.rigHeight, z]);
        }
        for (const side of [-1, 1])
            for (const z of [back + .5, .3]) {
                for (const x of [-.19, .19])
                    rod(root, [side * half + x, y, z], [side * half + x, p.rigHeight + .2, z], .038, steel);
                for (let h = y; h < p.rigHeight; h += .65)
                    rod(root, [side * half - .19, h, z], [side * half + .19, Math.min(h + .65, p.rigHeight), z], .015, steel);
                truss([side * half, p.rigHeight, back + .5], [side * half, p.rigHeight, .3]);
            }
    }
    const curtain = ['theatre', 'jazz_lounge'].includes(p.kind), led = ['festival_stage', 'stadium', 'indoor_arena', 'ice_arena', 'live_house'].includes(p.kind);
    // One landscape texture for the main wall, and one square texture shared
    // by both IMAG wings. A wide graphic on square panels crushed band names.
    const mainScreenTexture = led ? createVenueShowScreenTexture(p, bandName, layout.tier, 'wide') : undefined;
    const wingScreenTexture = layout.wings ? createVenueShowScreenTexture(p, bandName, layout.tier, 'square') : undefined;
    const portraitTexture = resolveVenueShowPlan(p, layout.tier).wingVideoTotems > 0
        ? createVenueShowScreenTexture(p, bandName, layout.tier, 'portrait') : undefined;
    if (curtain) {
        const g = new T.PlaneGeometry(p.stageWidth * .94, p.rigHeight - y, 100, 1), v = g.attributes.position;
        for (let i = 0; i < v.count; i++)
            v.setZ(i, Math.sin(v.getX(i) * 9) * .12);
        g.computeVertexNormals();
        const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: p.kind === 'jazz_lounge' ? '#253b49' : '#64233a', roughness: .96, side: T.DoubleSide }));
        m.position.set(0, (p.rigHeight + y) / 2, back + .1);
        m.name = 'venue-curtain';
        root.add(m);
        if (p.kind === 'theatre')
            for (const side of [-1, 1])
                box(root, [1.3, p.rigHeight - y, .5], [side * (half - .4), (p.rigHeight + y) / 2, back + 1], matte('#6b283f'));
    }
    else if (led) {
        const width = p.stageWidth * .7, height = (p.rigHeight - y) * .65;
        addVideoScreen(root, 'stage-led-wall', width, height,
            [0, y + (p.rigHeight - y) * .49, back + .3], black, steel, p.accent, mainScreenTexture);
        const strip = new T.MeshStandardMaterial({ color: '#52b6bf', emissive: '#308c9e', emissiveIntensity: 1.5 });
        for (const { x, height } of stageLedEdgePositions(p))
            box(root, [p.stageWidth * .009, height, .025],
                [x, y + (p.rigHeight - y) * .4, back + .535], strip);
    }
    else if (p.kind === 'concert_hall') {
        for (let i = 0; i < 9; i++) {
            const shell = box(root, [p.stageWidth / 9 * .92, p.rigHeight - y, .18], [(i - 4) * p.stageWidth / 9, (p.rigHeight + y) / 2, back + .2 + Math.abs(i - 4) * .18], wood);
            shell.rotation.y = (i - 4) * .075;
        }
    }
    else if (['warehouse', 'rock_club', 'university_union'].includes(p.kind)) {
        const scrim = box(root, [p.stageWidth * .72, (p.rigHeight - y) * .58, .06], [0, y + (p.rigHeight - y) * .6, back + .2], black);
        scrim.name = 'stage-scrim';
    }
    if (p.kind === 'tv_studio') {
        // Keep scenery outside the performer lanes and use light to separate
        // silhouettes from the set, rather than placing solid props behind them.
        const riserZ = stagePositionForTv(p, .5, .28)[2];
        box(root, [3.35, .18, 1.9], [0, y + .09, riserZ], matte('#202631'));
        box(root, [3.15, .025, 1.72], [0, y + .195, riserZ], trim);

        const sidePanel = new T.MeshStandardMaterial({ color: '#251634', emissive: p.accent, emissiveIntensity: .42, roughness: .6 });
        for (const side of [-1, 1]) {
            const x = side * (half - .7);
            const panel = box(root, [1.05, 3.8, .12], [x, y + 2.25, back + .45], sidePanel);
            panel.rotation.z = side * -.08;

            const sideLogo = makeLabel('TOP OF THE POPS', 3.0, .72);
            sideLogo.position.set(x - side * .08, y + 2.25, back + .54);
            sideLogo.rotation.z = side * -.08;
            root.add(sideLogo);
        }

        const rearLogo = makeLabel('TOP OF THE POPS', Math.min(p.stageWidth * .58, 7.4), 1.35);
        rearLogo.position.set(0, y + (p.rigHeight - y) * .63, back + .62);
        rearLogo.name = 'totp-rear-logo';
        root.add(rearLogo);

        const floorLogo = makeLabel('TOP OF THE POPS', 4.8, .9);
        floorLogo.position.set(0, y + .012, .15);
        floorLogo.rotation.x = -Math.PI / 2;
        floorLogo.name = 'totp-floor-logo';
        root.add(floorLogo);

        const key = new T.PointLight('#fff1df', 4.8, 9, 1.6);
        key.position.set(0, p.rigHeight - 1.2, 1.2);
        root.add(key);
        for (const side of [-1, 1]) {
            const rim = new T.PointLight(side < 0 ? '#8ddcff' : '#ff92df', 3.4, 8, 1.8);
            rim.position.set(side * 4.4, 3.2, -1.0);
            root.add(rim);
        }
    }

    if (p.kind !== 'tv_studio') {
        const placement = stageBannerLayout(p, led);
        const banner = makeLabel(bandName, Math.min(p.stageWidth * .5, 10), placement.height);
        banner.name = 'stage-band-banner';
        banner.position.set(0, placement.centerY, back + .55);
        banner.userData.bannerHeight = placement.height;
        banner.userData.screenTop = placement.screenTop;
        root.add(banner);
    }
    // Scale real cabinets, not entire instrument/performer rigs. Touring shows
    // have larger backline stacks and satellite guitar rigs at stage wings.
    const backlineZ = back + p.stageDepth * (p.kind === 'tv_studio' ? .24 : .45);
    for (const side of [-1, 1]) {
        const innerX = side * Math.min(half * (p.kind === 'tv_studio' ? .82 : .67), 6.2);
        addAmplifierStack(root, 'backline-stack-inner-' + side, innerX, y, backlineZ,
            equipment, black, grille, steel, chrome, makeLabel);
        if (layout.tier >= 3)
            addAmplifierStack(root, 'backline-stack-outer-' + side, side * p.stageWidth * .34, y, backlineZ,
                equipment, black, grille, steel, chrome, makeLabel);
        if (layout.arrayBoxes === 0) {
            const speaker = box(root, [equipment.paWidth, .76, equipment.paDepth],
                [side * (half - .3), y + 1.65, 0], black);
            speaker.name = 'portable-speaker-' + side;
            box(root, [equipment.paWidth - .06, .7, .02],
                [side * (half - .3), y + 1.65, equipment.paDepth / 2 + .015], grille);
            rod(root, [side * (half - .3), y, 0], [side * (half - .3), y + 1.3, 0], .027, chrome);
        } else {
            const arrayX = side * (half + equipment.paWidth / 2 + .35);
            // A suspension bumper and two actual flying cables support the
            // curved array at the outer corners instead of one central rod.
            box(root, [equipment.paWidth + .18, .09, equipment.paDepth + .12],
                [arrayX, p.rigHeight - .32, .45], steel).name = 'stage-pa-bumper-' + side;
            for (const dx of [-equipment.paWidth * .39, equipment.paWidth * .39])
                rod(root, [arrayX + dx, p.rigHeight + .04, .35],
                    [arrayX + dx, p.rigHeight - .5, .35], .018, chrome);
            for (let i = 0; i < layout.arrayBoxes; i++)
                addLineArrayCabinet(root, 'line-array-' + side + '-' + i, arrayX,
                    p.rigHeight - .55 - i * (equipment.paHeight + .045), .45, i,
                    equipment, black, paGrille, steel);
        }
    }
    const subSpacing = equipment.subWidth + .2;
    for (let i = 0; i < layout.subs; i++) {
        const x = (i - (layout.subs - 1) / 2) * subSpacing;
        if (layout.runway && Math.abs(x) < 2) continue;
        addSubwoofer(root, 'subwoofer-' + i, x, 1.2, equipment, black, subGrille, steel);
    }
    for (let i = 0; i < layout.monitors; i++) {
        const spread = Math.min(p.stageWidth * (p.kind === 'tv_studio' ? .9 : .8), 22);
        const x = (i / Math.max(1, layout.monitors - 1) - .5) * spread;
        const monitorWidth = .8 + layout.tier * .09;
        const monitor = box(root, [monitorWidth, .32 + layout.tier * .035, .55 + layout.tier * .04],
            [x, y + .2, -.2], black);
        monitor.rotation.x = -.28;
        box(monitor, [monitorWidth - .09, .02, .4 + layout.tier * .04],
            [0, .17 + layout.tier * .0175, 0], grille);
    }
    // Projection towers and crowd delay PA scale up with production capacity.
    if (layout.wings)
        for (const side of [-1, 1]) {
            const x = side * (half + 3.2), screenHeight = equipment.screenHeight;
            addVideoScreen(root, 'stage-side-screen-' + side, equipment.screenWidth, screenHeight,
                [x, y + screenHeight * .7, back + p.stageDepth * .6], black, steel, p.accent, wingScreenTexture);
            for (const z of [p.crowdDepth * .43, ...(layout.tier === 4 ? [p.crowdDepth * .76] : [])]) {
                const towerX = side * (p.crowdWidth * .45);
                const towerHeight = layout.tier === 4 ? 10 : 7;
                rod(root, [towerX, 0, z], [towerX, towerHeight, z], .075, steel);
                for (let i = 0; i < (layout.tier === 4 ? 6 : 4); i++)
                    addLineArrayCabinet(root, 'delay-array-' + side + '-' + z + '-' + i,
                        towerX, towerHeight - .45 - i * (equipment.paHeight + .025), z, i,
                        equipment, black, paGrille, steel, .025);
            }
        }
    // Fixture count grows from two portable lamps to 56 heads plus LED battens.
    // Three shared optic materials give the actual rig alternating color zones
    // without allocating a new shader and draw call for every moving head.
    const lens = {
        left: new T.MeshStandardMaterial({ name: 'production-light-lens-left', color: '#d8ecf7', emissive: '#5099b3', emissiveIntensity: 2.2 }),
        right: new T.MeshStandardMaterial({ name: 'production-light-lens-right', color: '#d8ecf7', emissive: '#b34b74', emissiveIntensity: 2.2 }),
        key: new T.MeshStandardMaterial({ name: 'production-light-lens-key', color: '#f9efe1', emissive: '#cba97f', emissiveIntensity: 2.2 }),
    };
    const fixturePositions = stageLightPositions(p);
    const motorized = new Set(p.kind === 'tv_studio' ? [] : planVenueLighting(p, fixturePositions, layout.tier, 'high').spotlightIndices);
    for (const [i, pos] of fixturePositions.entries()) {
        const row = Math.floor(i / layout.columns);
        const bank = row === 0 ? lens.key : i % 2 === 0 ? lens.left : lens.right;
        addMovingHead(root, 'production-light-' + i, pos, equipment.fixtureScale, black, steel, bank, motorized.has(i));
        if (layout.tier === 0)
            rod(root, [pos[0], 0, pos[2]], [pos[0], pos[1], pos[2]], .022, chrome);
    }
    if (layout.tier >= 3)
        for (let i = 0; i < Math.floor(p.stageWidth / 1.4); i++)
            box(root, [.9, .045, .08], [(i - (Math.floor(p.stageWidth / 1.4) - 1) / 2) * 1.4, y + .05, .51], i % 2 === 0 ? lens.left : lens.right);
    // Signature stage architecture is shared by live gigs, replays and venue previews.
    buildVenueShowIdentity(root, p, layout.tier, portraitTexture);
    batchStaticMeshes(root);
    return root;
}
