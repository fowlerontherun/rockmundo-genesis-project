import * as T from 'three';
import { box, cylinder, rod, matte, metal, batchStaticMeshes } from './stage';
import type { VenueProfile } from './venueProfile';
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
/** Production uses metre-sized equipment. A larger show adds rigging and PA,
 * rather than stretching a club's amplifiers and curtain with its floor. */
export function buildVenueProduction(scene: T.Scene, p: VenueProfile, wood: T.Material, grille: T.Material, makeLabel: (text: string, w: number, h: number) => T.Mesh, bandName: string) {
    const root = new T.Group();
    root.name = 'venue';
    root.userData.profile = p;
    root.userData.production = productionLayout(p);
    scene.add(root);
    const layout = productionLayout(p), half = p.stageWidth / 2, back = .65 - p.stageDepth, y = p.stageHeight;
    const black = matte('#11151d'), steel = metal('#58636e'), chrome = metal('#a4adb7'), trim = matte(p.accent);
    const deck = box(root, [p.stageWidth, y, p.stageDepth], [0, y / 2, .65 - p.stageDepth / 2], black);
    deck.name = 'stage-deck';
    box(root, [p.stageWidth, .065, p.stageDepth], [0, y - .032, .65 - p.stageDepth / 2], wood);
    box(root, [p.stageWidth, .035, .05], [0, y + .01, .65], chrome);
    if (layout.wings)
        for (const side of [-1, 1]) {
            box(root, [4, y, p.stageDepth * .8], [side * (half + 2), y / 2, back + p.stageDepth * .45], black);
            box(root, [3.8, .04, p.stageDepth * .78], [side * (half + 2), y + .02, back + p.stageDepth * .45], wood);
        }
    if (layout.runway) {
        const runway = box(root, [3.2, y, 6], [0, y / 2, 3.65], black);
        runway.name = 'stage-runway';
        box(root, [6, y, 2.8], [0, y / 2, 7.65], black);
        for (const x of [-1.56, 1.56])
            box(root, [.025, .025, 6], [x, y + .02, 3.65], trim);
    }
    for (const side of [-1, 1])
        for (let step = 0; step < Math.ceil(y / .22); step++)
            box(root, [1.2, (step + 1) * .22, .35], [side * (half + .65), (step + 1) * .11, .65 - step * .35], black);
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
        const material = new T.MeshStandardMaterial({ color: '#121f32', emissive: '#205273', emissiveIntensity: .7, roughness: .6 });
        const wall = box(root, [p.stageWidth * .7, (p.rigHeight - y) * .65, .15], [0, y + (p.rigHeight - y) * .49, back + .3], material);
        wall.name = 'stage-led-wall';
        const strip = new T.MeshStandardMaterial({ color: '#52b6bf', emissive: '#308c9e', emissiveIntensity: 1.5 });
        for (let i = 0; i < 18; i++)
            box(root, [p.stageWidth * .012, (p.rigHeight - y) * (.1 + Math.sin(i * .83) ** 2 * .35), .025], [(i - 8.5) * p.stageWidth * .036, y + (p.rigHeight - y) * .4, back + .39], strip);
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
    const banner = makeLabel(bandName, Math.min(p.stageWidth * .5, 10), Math.min(1.1, p.stageWidth * .13));
    banner.name = 'stage-band-banner';
    banner.position.set(0, Math.min(p.rigHeight - 1, y + (p.rigHeight - y) * .77), back + .55);
    root.add(banner);
    // Backline amplifiers remain human-sized, even on a stadium deck.
    for (const side of [-1, 1]) {
        const x = side * Math.min(half * .67, 6.2);
        for (let row = 0; row < (layout.tier >= 2 ? 2 : 1); row++) {
            box(root, [.88, .72, .48], [x, y + .38 + row * .77, back + p.stageDepth * .45], black);
            box(root, [.8, .64, .018], [x, y + .38 + row * .77, back + p.stageDepth * .45 + .25], grille);
        }
        box(root, [.8, .22, .42], [x, y + (layout.tier >= 2 ? 1.63 : .86), back + p.stageDepth * .45], black);
        if (layout.arrayBoxes === 0) {
            const speaker = box(root, [.5, .76, .42], [side * (half - .3), y + 1.65, 0], black);
            speaker.name = `portable-speaker-${side}`;
            rod(root, [side * (half - .3), y, 0], [side * (half - .3), y + 1.3, 0], .027, chrome);
        }
        else
            for (let i = 0; i < layout.arrayBoxes; i++) {
                const speaker = box(root, [layout.tier >= 3 ? 1.3 : .66, .36, .58], [side * (half + .75), p.rigHeight - .55 - i * .37, .45], black);
                speaker.rotation.x = -Math.max(0, i - layout.arrayBoxes * .45) * .035;
                box(speaker, [layout.tier >= 3 ? 1.2 : .6, .3, .02], [0, 0, .3], grille);
            }
    }
    for (let i = 0; i < layout.subs; i++) {
        const x = (i - (layout.subs - 1) / 2) * 1.15;
        if (layout.runway && Math.abs(x) < 2)
            continue;
        box(root, [1.03, .75, .8], [x, .4, 1.2], black);
        box(root, [.96, .64, .02], [x, .4, 1.61], grille);
    }
    for (let i = 0; i < layout.monitors; i++) {
        const x = (i / Math.max(1, layout.monitors - 1) - .5) * Math.min(p.stageWidth * .8, 18);
        const m = box(root, [.8, .32, .55], [x, y + .2, -.2], black);
        m.rotation.x = -.28;
        box(m, [.7, .02, .42], [0, .17, 0], grille);
    }
    // Side screens and delay towers distinguish a touring production from a club.
    if (layout.wings)
        for (const side of [-1, 1]) {
            const x = side * (half + 3.2), screenHeight = layout.tier === 4 ? 6 : 4.2;
            box(root, [4.5, screenHeight, .3], [x, y + screenHeight * .7, back + p.stageDepth * .6], black);
            const screen = box(root, [4.25, screenHeight - .3, .04], [x, y + screenHeight * .7, back + p.stageDepth * .6 + .18], new T.MeshStandardMaterial({ color: '#253e56', emissive: '#357596', emissiveIntensity: .9 }));
            screen.name = `stage-side-screen-${side}`;
            for (const z of [p.crowdDepth * .43, ...(layout.tier === 4 ? [p.crowdDepth * .76] : [])]) {
                const towerX = side * (p.crowdWidth * .45);
                rod(root, [towerX, 0, z], [towerX, 7, z], .075, steel);
                for (let i = 0; i < 4; i++)
                    box(root, [.75, .38, .5], [towerX, 6.6 - i * .4, z], black);
            }
        }
    // Fixture count grows from two portable lamps to 56 heads plus LED battens.
    const lensMaterial = new T.MeshStandardMaterial({ color: '#d8ecf7', emissive: '#5099b3', emissiveIntensity: 2.2 });
    lensMaterial.name = 'production-light-lens';
    for (const [i, pos] of stageLightPositions(p).entries()) {
        const fixture = new T.Group();
        fixture.position.set(...pos);
        fixture.name = `production-light-${i}`;
        root.add(fixture);
        box(fixture, [.27, .15, .22], [0, .14, 0], black);
        const head = cylinder(fixture, .12, .15, .28, [0, -.05, 0], black, 12);
        head.rotation.x = .25;
        cylinder(fixture, .1, .1, .025, [0, -.2, .04], lensMaterial, 12);
        if (layout.tier === 0)
            rod(root, [pos[0], 0, pos[2]], [pos[0], pos[1], pos[2]], .022, chrome);
    }
    if (layout.tier >= 3)
        for (let i = 0; i < Math.floor(p.stageWidth / 1.4); i++)
            box(root, [.9, .045, .08], [(i - (Math.floor(p.stageWidth / 1.4) - 1) / 2) * 1.4, y + .05, .51], lensMaterial);
    batchStaticMeshes(root);
    return root;
}
