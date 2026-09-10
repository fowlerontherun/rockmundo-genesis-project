import * as T from 'three';
import { box, rod, cylinder, matte, metal } from './stage';
import type { VenueProfile } from './venueProfile';
/** Recognisable silhouettes and ceiling structures are visible from stage-facing cameras. */
export function venueArchitecture(root: T.Group, p: VenueProfile, wood: T.Material) {
    const half = p.roomWidth / 2, back = .65 - p.stageDepth - 1.4, pale = matte('#dbd0af'), dark = matte('#212830'), brass = metal('#a78950');
    const beam = (a: number[], b: number[], r = .045) => rod(root, a, b, r, wood);
    if (p.kind === 'festival_tent') {
        const eave = Math.max(4.4, p.rigHeight * .8), peak = Math.max(p.roofHeight, p.rigHeight + 3.8), front = p.crowdDepth + 9;
        const fabric = new T.MeshStandardMaterial({ vertexColors: true, roughness: .96, side: T.DoubleSide });
        const positions: number[] = [], colours: number[] = [], uv: number[] = [];
        const point = (x: number, z: number) => new T.Vector3(x, eave + (peak - eave) * (1 - Math.abs(x / half)) * (.88 + .12 * Math.cos((z - back) / (front - back) * Math.PI * 4)), z);
        const add = (a: T.Vector3, b: T.Vector3, c: T.Vector3, colour: T.Color) => { for (const v of [a, b, c]) {
            positions.push(v.x, v.y, v.z);
            colours.push(colour.r, colour.g, colour.b);
            uv.push(v.x * .2, v.z * .2);
        } };
        for (let iz = 0; iz < 24; iz++)
            for (let ix = 0; ix < 20; ix++) {
                const x0 = -half + ix * p.roomWidth / 20, x1 = x0 + p.roomWidth / 20, z0 = back + iz * (front - back) / 24, z1 = z0 + (front - back) / 24;
                const colour = new T.Color(ix % 4 < 2 ? '#d1c9ad' : '#485774');
                const a = point(x0, z0), b = point(x1, z0), c = point(x1, z1), d = point(x0, z1);
                add(a, b, c, colour);
                add(a, c, d, colour);
            }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        g.setAttribute('color', new T.Float32BufferAttribute(colours, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        const canopy = new T.Mesh(g, fabric);
        canopy.name = 'tent-fabric-canopy';
        canopy.castShadow = true;
        root.add(canopy);
        // A gable closes the end behind the stage; side skirts leave real entrance gaps.
        const end = new T.BufferGeometry();
        end.setAttribute('position', new T.Float32BufferAttribute([-half, 0, back, half, 0, back, -half, eave, back, half, 0, back, half, eave, back, -half, eave, back, -half, eave, back, half, eave, back, 0, point(0, back).y, back], 3));
        end.computeVertexNormals();
        const endWall = new T.Mesh(end, new T.MeshStandardMaterial({ color: '#c7bfa8', roughness: .96, side: T.DoubleSide }));
        endWall.name = 'tent-gable';
        root.add(endWall);
        for (const side of [-1, 1])
            for (let z = back; z < front; z += 5) {
                rod(root, [side * half, 0, z], [side * half, eave, z], .048, brass);
                rod(root, [side * half, eave, z], [side * (half + 2), 0, z + 1], .012, pale);
                if (Math.round((z - back) / 5) % 4 !== 2)
                    box(root, [.055, eave * .85, 4.7], [side * half, eave * .425, z + 2.3], pale);
            }
        for (let z = back + 2; z < front; z += 7) {
            const y = point(0, z).y;
            beam([-half, eave, z], [0, y, z], .035);
            beam([0, y, z], [half, eave, z], .035);
        }
        for (const z of [p.crowdDepth * .3, p.crowdDepth * .75])
            rod(root, [0, 0, z], [0, point(0, z).y, z], .075, brass);
    }
    if (p.kind === 'park_bandstand') {
        const center = .65 - p.stageDepth / 2, radius = p.stageWidth * .65;
        const base = cylinder(root, radius, radius + .15, p.stageHeight, [0, p.stageHeight / 2, center], pale, 8);
        base.name = 'bandstand-octagonal-plinth';
        base.scale.z = p.stageDepth / p.stageWidth;
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, x = Math.cos(a) * radius, z = center + Math.sin(a) * radius * p.stageDepth / p.stageWidth;
            if (z > .5)
                continue;
            rod(root, [x, p.stageHeight, z], [x, p.rigHeight, z], .07, pale);
        }
    }
    if (p.kind === 'theatre') {
        const w = p.stageWidth / 2 + .5, y = p.rigHeight + .4;
        const shape = new T.Shape();
        shape.moveTo(-w, 0);
        shape.lineTo(-w, y - .4);
        shape.quadraticCurveTo(0, y + 1.4, w, y - .4);
        shape.lineTo(w, 0);
        shape.lineTo(w - .45, 0);
        shape.lineTo(w - .45, y - .9);
        shape.quadraticCurveTo(0, y + .5, -w + .45, y - .9);
        shape.lineTo(-w + .45, 0);
        shape.closePath();
        const arch = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .2, bevelEnabled: false }), brass);
        arch.position.z = .8;
        arch.name = 'theatre-proscenium';
        root.add(arch);
    }
    if (p.kind === 'church_hall') {
        for (const x of [-p.stageWidth * .35, p.stageWidth * .35]) {
            const shape = new T.Shape();
            shape.moveTo(-.55, 0);
            shape.lineTo(-.55, 2.2);
            shape.quadraticCurveTo(-.5, 2.7, 0, 3.15);
            shape.quadraticCurveTo(.5, 2.7, .55, 2.2);
            shape.lineTo(.55, 0);
            shape.closePath();
            const window = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshStandardMaterial({ color: '#a7845a', emissive: '#aa6b3e', emissiveIntensity: .3, side: T.DoubleSide }));
            window.position.set(x, 1.8, back + .18);
            window.name = 'church-pointed-window';
            root.add(window);
            beam([x, 1.8, back + .2], [x, 4.8, back + .2], .025);
            beam([x - .5, 3.3, back + .2], [x + .5, 3.3, back + .2], .025);
        }
        for (let z = back + 1; z < p.roomDepth; z += 5) {
            beam([-half, p.roofHeight - .7, z], [0, p.roofHeight + 1.4, z], .09);
            beam([0, p.roofHeight + 1.4, z], [half, p.roofHeight - .7, z], .09);
        }
    }
    if (p.kind === 'concert_hall')
        for (let i = 0; i < 5; i++) {
            const panel = box(root, [p.stageWidth * .8, .13, 1.5], [0, p.rigHeight + 1, .65 - p.stageDepth + i * p.stageDepth / 5], wood);
            panel.rotation.x = (i - 2) * .06;
        }
    if (['indoor_arena', 'ice_arena', 'stadium'].includes(p.kind)) {
        const roofY = p.roofHeight, front = p.crowdDepth + 10;
        for (let z = back; z < front; z += 8)
            for (const side of [-1, 1]) {
                beam([side * half, roofY - 3, z], [side * half * .3, roofY, z], .12);
                if (p.kind === 'stadium') {
                    const canopy = box(root, [half * .48, .15, 8], [side * half * .76, roofY - 1, z + 4], pale);
                    canopy.rotation.z = side * .13;
                }
            }
        if (p.kind === 'ice_arena') {
            const board = box(root, [3.8, 2.3, 3.8], [0, Math.min(roofY - 2, 12), p.crowdDepth * .45], dark);
            board.name = 'ice-arena-scoreboard';
            for (const side of [-1, 1])
                box(root, [3.4, 1.7, .025], [0, board.position.y, p.crowdDepth * .45 + side * 1.92], matte('#31566d'));
        }
    }
    if (['cafe_stage', 'jazz_lounge', 'dive_bar'].includes(p.kind)) {
        for (const side of [-1, 1]) {
            const z = back + 2, x = side * p.stageWidth * .36;
            rod(root, [x, p.roofHeight, z], [x, p.roofHeight - 1.2, z], .009, dark);
            cylinder(root, .15, .36, .3, [x, p.roofHeight - 1.2, z], p.kind === 'jazz_lounge' ? brass : pale, 20);
        }
        if (p.kind === 'cafe_stage') {
            const board = box(root, [1.1, 1.8, .08], [p.stageWidth * .4, 2, back + .2], dark);
            board.name = 'cafe-menu-board';
            for (let i = 0; i < 6; i++)
                box(root, [.72, .024, .012], [p.stageWidth * .4, 2.5 - i * .2, back + .25], pale);
        }
    }
    if (p.kind === 'warehouse')
        for (let i = 0; i < 7; i++)
            box(root, [1.25, 2.1, .07], [(i - 3) * p.roomWidth / 8, p.roofHeight - 1.8, back + .2], new T.MeshStandardMaterial({ color: '#607079', emissive: '#374e5d', emissiveIntensity: .2 }));
    if (p.kind === 'beach_stage')
        for (const side of [-1, 1])
            for (let i = 0; i < 3; i++) {
                const x = side * (p.stageWidth / 2 + 2), z = back + 2 + i * 4;
                rod(root, [x, 0, z], [x, 5, z], .045, wood);
                const sail = new T.Mesh(new T.ConeGeometry(2.7, .8, 3, 1, true), new T.MeshStandardMaterial({ color: '#dfcaa1', side: T.DoubleSide, roughness: .9 }));
                sail.position.set(x, 5, z);
                root.add(sail);
            }
}
