import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededRandom } from './config';
import { productionLayout } from './venueProduction';
import type { VenueProfile } from './venueProfile';
export type AudiencePlace = [
    number,
    number,
    number,
    number
];
export const AUDIENCE_BUDGET = 12000;
/** Front rows stay human-sized; they are never stretched over an entire stadium. */
export function detailedCrowdArea(p?: VenueProfile) {
    return { width: Math.min(13, p?.crowdWidth ?? 13), depth: Math.min(11, p?.crowdDepth ?? 11), front: 2.15, runway: !!p && productionLayout(p).runway };
}
/** Complete low-poly anatomy and separate skin, hair and clothing colours.
 * The old cylinders are intentionally not reused at any distance. */
export function audienceHumanGeometry(kind: number, seated = false) {
    const parts: T.BufferGeometry[] = [], skin = new T.Color(['#d7a67e', '#915d3e', '#b88360', '#593b2c'][kind % 4]), shirt = new T.Color(['#335369', '#873f47', '#3d6652', '#786080'][kind % 4]), trousers = new T.Color(['#283340', '#393237', '#283131', '#3b3549'][kind % 4]), hair = new T.Color(['#342923', '#272229', '#98734d', '#432d25'][kind % 4]), shoe = new T.Color('#20232a');
    const add = (g: T.BufferGeometry, colour: T.Color) => { const geometry = g.index ? g.toNonIndexed() : g; const n = geometry.attributes.position.count, colors = new Float32Array(n * 3); for (let i = 0; i < n; i++)
        colors.set(colour.toArray(), i * 3); geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); geometry.deleteAttribute('uv'); parts.push(geometry); if (g !== geometry)
        g.dispose(); };
    const limb = (a: number[], b: number[], radius: number, colour: T.Color) => { const av = new T.Vector3(...a), bv = new T.Vector3(...b), g = new T.CylinderGeometry(radius, radius * .9, av.distanceTo(bv), 5, 1, true); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), bv.clone().sub(av).normalize())); g.translate(...av.add(bv).multiplyScalar(.5).toArray()); add(g, colour); };
    const hips = seated ? .52 : .84, shoulder = hips + .49;
    const torso = new T.CylinderGeometry(.22, .16, .5, 6, 1, false);
    torso.scale(1, 1, .62);
    torso.translate(0, hips + .24, 0);
    add(torso, shirt);
    limb([0, shoulder - .02, 0], [0, shoulder + .13, 0], .06, skin);
    const head = new T.SphereGeometry(.145, 8, 6);
    head.scale(.82, 1.15, .9);
    head.translate(0, shoulder + .26, 0);
    add(head, skin);
    const cap = new T.SphereGeometry(.15, 8, 3, 0, Math.PI * 2, 0, Math.PI * .52);
    cap.scale(.84, 1.12, .93);
    cap.translate(0, shoulder + .27, -.01);
    add(cap, hair);
    for (const side of [-1, 1]) {
        const x = side * .105, knee = seated ? [side * .13, .42, .3] : [x, .45, .015], foot = seated ? [side * .13, .04, .35] : [x, .06, 0];
        limb([x, hips, 0], knee, .082, trousers);
        limb(knee, foot, .065, trousers);
        const boot = new T.BoxGeometry(.13, .09, .23);
        boot.translate(foot[0], .045, foot[2] + .035);
        add(boot, shoe);
        const raised = !seated && kind % 3 === 1 && side === 1, elbow = raised ? [side * .31, shoulder + .12, .03] : [side * .29, shoulder - .22, .05], hand = raised ? [side * .28, shoulder + .48, .12] : [side * .3, shoulder - .42, .13];
        limb([side * .19, shoulder - .04, 0], elbow, .062, shirt);
        limb(elbow, hand, .044, skin);
        const palm = new T.SphereGeometry(.05, 5, 3);
        palm.translate(...hand as [
            number,
            number,
            number
        ]);
        add(palm, skin);
    }
    const geometry = mergeGeometries(parts, false)!;
    parts.forEach(g => g.dispose());
    geometry.computeBoundingBox();
    return geometry;
}
export function audienceFloorPlaces(p: VenueProfile): AudiencePlace[] {
    const detail = detailedCrowdArea(p), places: AudiencePlace[] = [], runway = detail.runway;
    // Close-packed staggered rows, with a service aisle and an exclusion around the front-row models.
    for (let row = 0, z = 2.4; z < p.crowdDepth + 2; row++, z += .72)
        for (let x = -p.crowdWidth / 2 + .4 + (row % 2) * .34; x < p.crowdWidth / 2 - .35; x += .68) {
            if (Math.abs(x) < detail.width * .57 + .45 + (runway && z < 10 ? 3.8 : 0) && z < detail.front + detail.depth + 1.5)
                continue;
            if (runway && z < 10 && Math.abs(x) < 3.6)
                continue;
            if (p.capacity > 3000 && Math.abs(x - p.crowdWidth * .27) < .65)
                continue;
            places.push([x, 0, z, Math.PI]);
        }
    return places;
}
export function buildVenueAudience(parent: T.Group, p: VenueProfile, seed: number, seats: AudiencePlace[]) {
    const random = seededRandom(seed), root = new T.Group();
    root.name = 'venue-distant-audience';
    parent.add(root);
    const all = [...audienceFloorPlaces(p).map(point => ({ point, seated: false })), ...seats.map(point => ({ point, seated: true }))];
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    const maximum = Math.min(AUDIENCE_BUDGET, Math.max(0, p.capacity - 160), all.length), buckets: ({
        point: AudiencePlace;
        rank: number;
    })[][] = Array.from({ length: 8 }, () => []);
    // Stratify the budget over the entire floor and seating bowl.
    for (let i = 0; i < maximum; i++) {
        const entry = all[Math.floor(i * all.length / maximum)];
        buckets[(entry.seated ? 4 : 0) + i % 4].push({ point: entry.point, rank: i });
    }
    const clock = { value: 0 }, strength = { value: 0 };
    root.userData.clock = clock;
    root.userData.strength = strength;
    root.userData.maxCount = maximum;
    root.userData.capacity = p.capacity;
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
    material.customProgramCacheKey = () => 'anatomical-audience-v1';
    material.onBeforeCompile = shader => {
        shader.uniforms.audienceTime = clock;
        shader.uniforms.audienceMotion = strength;
        shader.vertexShader = 'uniform float audienceTime;\nuniform float audienceMotion;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed=position;
float phase=instanceMatrix[3].x*1.73+instanceMatrix[3].z*.91;
float weight=smoothstep(.6,1.7,position.y);
transformed.x+=sin(audienceTime*1.5+phase)*.028*weight*audienceMotion;
transformed.y+=max(0.,sin(audienceTime*4.0+phase))*.035*audienceMotion;
`);
    };
    for (let kind = 0; kind < 8; kind++) {
        const rows = buckets[kind];
        if (!rows.length)
            continue;
        const mesh = new T.InstancedMesh(audienceHumanGeometry(kind % 4, kind >= 4), material, rows.length);
        mesh.name = `audience-humans-${kind}`;
        mesh.userData.ranks = rows.map(row => row.rank);
        mesh.userData.maxCount = rows.length;
        mesh.frustumCulled = false;
        const transform = new T.Object3D();
        rows.forEach(({ point: [x, y, z, yaw] }, i) => { transform.position.set(x + (random() - .5) * .08, y, z + (random() - .5) * .08); transform.rotation.y = yaw + (random() - .5) * .16; const height = .9 + random() * .15; transform.scale.set(.9 + random() * .17, height, .9 + random() * .1); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix); });
        mesh.count = 0;
        root.add(mesh);
    }
    return root;
}
export function updateVenueAudience(root: T.Group, occupancy: number, seconds: number, reduced: boolean, energy: number, frontCount = 0) {
    const safe = Number.isFinite(occupancy) ? T.MathUtils.clamp(occupancy, 0, 1) : 0, limit = Math.min(Math.round(root.userData.maxCount * safe), Math.max(0, Math.floor(root.userData.capacity * safe) - frontCount));
    root.userData.clock.value = reduced ? 0 : seconds;
    root.userData.strength.value = reduced ? 0 : energy;
    root.children.forEach(child => { if (!(child instanceof T.InstancedMesh))
        return; const ranks = child.userData.ranks as number[]; let count = 0; while (count < ranks.length && ranks[count] < limit)
        count++; child.count = count; });
}
