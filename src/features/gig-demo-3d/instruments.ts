import * as T from 'three';
import { batchStaticMeshes, box, cylinder, rod, matte, metal, buildGuitar, buildHandInstrument } from './stage';
import { STAGE_INSTRUMENTS, type InstrumentId, type PlayingStyle } from './instrumentCatalog';
type Point = [
    number,
    number,
    number
];
export interface InstrumentRig {
    root: T.Group;
    left: T.Object3D;
    right: T.Object3D;
    family: PlayingStyle;
    stationary: boolean;
    seated: boolean;
    tools: T.Object3D[];
    animate: (seconds: number, energy: number, reduced: boolean) => void;
}
const marker = (root: T.Object3D, name: string, position: Point) => { const point = new T.Object3D(); point.name = name; point.position.set(...position); root.add(point); return point; };
/** Stage-sized, locally generated instruments. Grip markers drive the same IK as the avatar preview. */
export function buildInstrument(id: InstrumentId, colour = '#ab713d'): InstrumentRig {
    const spec = STAGE_INSTRUMENTS[id], root = new T.Group();
    root.name = `instrument-${id}`;
    root.userData.instrumentId = id;
    const chrome = metal('#adb8c0'), brass = metal('#c9a151', .26), black = matte('#171b22', .44), ivory = matte('#e8debf', .51);
    const wood = new T.MeshPhysicalMaterial({ color: colour, roughness: .34, clearcoat: .72, clearcoatRoughness: .22 });
    const darkWood = matte('#482d22', .55), head = matte('#d8cfb7', .74);
    const tools: T.Object3D[] = [];
    const moving: ((t: number, energy: number) => void)[] = [];
    let l: Point = [.23, 1.1, .4], r: Point = [-.23, 1.1, .4], seated = false;
    const ellipsoid = (g: T.Object3D, scale: Point, p: Point, mat: T.Material) => { const m = new T.Mesh(new T.SphereGeometry(1, 24, 16), mat); m.scale.set(...scale); m.position.set(...p); g.add(m); return m; };
    const tube = (g: T.Object3D, points: Point[], radius: number, mat: T.Material) => { const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))); const m = new T.Mesh(new T.TubeGeometry(path, 32, radius, 8, false), mat); g.add(m); return m; };
    const bell = (g: T.Object3D, p: Point, radius: number, length: number, axis: 'y' | 'z' = 'z') => {
        const geometry = new T.LatheGeometry([new T.Vector2(.018, 0), new T.Vector2(.024, length * .4), new T.Vector2(radius * .5, length * .83), new T.Vector2(radius, length)], 28);
        const mesh = new T.Mesh(geometry, brass);
        mesh.material.side = T.DoubleSide;
        if (axis === 'z')
            mesh.rotation.x = Math.PI / 2;
        mesh.position.set(...p);
        g.add(mesh);
        const rim = new T.Mesh(new T.TorusGeometry(radius, .004, 8, 28), brass);
        rim.position.set(p[0], p[1] + (axis === 'y' ? length : 0), p[2] + (axis === 'z' ? length : 0));
        if (axis === 'y')
            rim.rotation.x = Math.PI / 2;
        g.add(rim);
    };
    const stand = (g: T.Object3D, x: number, z: number, height: number) => { rod(g, [x, 0, z], [x, height, z], .016, chrome); for (let i = 0; i < 3; i++)
        rod(g, [x, .25, z], [x + Math.cos(i * 2.094) * .22, .03, z + Math.sin(i * 2.094) * .22], .012, chrome); };
    const drum = (g: T.Object3D, x: number, y: number, z: number, radius: number, depth: number, shell: T.Material = wood) => {
        cylinder(g, radius, radius * .94, depth, [x, y - depth / 2, z], shell, 28);
        cylinder(g, radius + .01, radius + .01, .025, [x, y, z], chrome, 28);
        cylinder(g, radius - .012, radius - .012, .013, [x, y + .016, z], head, 28);
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            rod(g, [x + Math.cos(a) * radius, y - .025, z + Math.sin(a) * radius], [x + Math.cos(a) * radius, y - depth + .04, z + Math.sin(a) * radius], .009, chrome);
        }
    };
    const keys = (g: T.Object3D, width: number, y: number, z: number, n = 28) => { for (let i = 0; i < n; i++) {
        const x = -width / 2 + (i + .5) * width / n;
        box(g, [width / n * .94, .026, .22], [x, y, z], ivory);
        if (![2, 6].includes(i % 7))
            box(g, [width / n * .6, .034, .13], [x + width / n * .5, y + .029, z + .045], black);
    } };
    const strings = (g: T.Object3D, count: number, from: Point, to: Point, spread: number) => { for (let i = 0; i < count; i++) {
        const dx = (i / (count - 1) - .5) * spread;
        rod(g, [from[0] + dx, from[1], from[2]], [to[0] + dx, to[1], to[2]], .001, chrome);
    } };
    const pluckedBody = (g: T.Object3D, variant: string, radius = .23) => {
        if (variant === 'banjo') {
            const m = cylinder(g, radius, radius, .09, [0, 0, .03], chrome, 40);
            m.rotation.x = Math.PI / 2;
            const skin = cylinder(g, radius * .94, radius * .94, .011, [0, 0, .085], head, 40);
            skin.rotation.x = Math.PI / 2;
        }
        else if (['balalaika', 'shamisen'].includes(variant)) {
            if (variant === 'shamisen')
                box(g, [.4, .35, .1], [0, 0, .035], ivory);
            else {
                const s = new T.Shape();
                s.moveTo(-.3, -.21);
                s.lineTo(.3, -.21);
                s.lineTo(0, .3);
                s.closePath();
                g.add(new T.Mesh(new T.ExtrudeGeometry(s, { depth: .08, bevelEnabled: true, bevelSize: .014, bevelThickness: .012, bevelSegments: 2, steps: 1 }), wood));
            }
        }
        else {
            const s = new T.Shape();
            s.moveTo(0, .33);
            s.bezierCurveTo(-radius * .8, .33, -radius * .8, .17, -radius * .59, .08);
            s.bezierCurveTo(-radius * .52, -.02, -radius * 1.45, -.07, -radius, -.26);
            s.bezierCurveTo(-radius * .66, -.39, radius * .66, -.39, radius, -.26);
            s.bezierCurveTo(radius * 1.45, -.07, radius * .52, -.02, radius * .59, .08);
            s.bezierCurveTo(radius * .8, .17, radius * .8, .33, 0, .33);
            const body = new T.Mesh(new T.ExtrudeGeometry(s, { depth: .1, bevelEnabled: true, bevelSegments: 3, bevelSize: .018, bevelThickness: .012, steps: 1, curveSegments: 16 }), wood);
            g.add(body);
            const hole = new T.Mesh(new T.CircleGeometry(.071, 24), black);
            hole.position.set(0, .045, .12);
            if (variant !== 'bowed')
                g.add(hole);
            else
                hole.geometry.dispose();
            const rosette = new T.Mesh(new T.TorusGeometry(.078, .005, 8, 32), ivory);
            rosette.position.copy(hole.position);
            if (variant !== 'bowed')
                g.add(rosette);
            else
                rosette.geometry.dispose();
            if (['oud', 'biwa', 'mandolin', 'bouzouki', 'charango'].includes(variant))
                ellipsoid(g, [radius, .3, .13], [0, -.04, 0], darkWood);
            if (variant === 'dobro') {
                const disc = cylinder(g, .14, .14, .012, [0, -.08, .135], chrome, 32);
                disc.rotation.x = Math.PI / 2;
                for (let i = 0; i < 12; i++)
                    box(g, [.06, .008, .006], [Math.sin(i) * .08, -.08 + Math.cos(i) * .08, .146], black);
            }
        }
        box(g, [.075, .67, .045], [0, .59, .075], darkWood).name = 'fretboard';
        box(g, [.12, .18, .052], [0, .99, .07], wood);
        const n = variant === '12_string_guitar' ? 12 : variant === 'bowed' ? 4 : variant === 'banjo' ? 5 : ['ukulele', 'bass_guitar'].includes(variant) ? 4 : ['balalaika', 'shamisen'].includes(variant) ? 3 : variant === 'charango' ? 10 : variant === 'sitar' ? 13 : 6;
        strings(g, n, [0, -.2, .13], [0, 1.07, .112], .057);
        box(g, [.18, .028, .035], [0, -.2, .125], darkWood);
        if (variant !== 'bowed')
            for (let i = 0; i < 15; i++)
                rod(g, [-.039, .28 + i * .039, .104], [.039, .28 + i * .039, .104], .0018, chrome);
        for (let i = 0; i < n; i++)
            cylinder(g, .009, .009, .05, [(i % 2 ? 1 : -1) * .079, .94 + Math.floor(i / 2) * .022, .065], ivory, 8).rotation.z = Math.PI / 2;
        if (variant === 'sitar') {
            ellipsoid(g, [.13, .14, .14], [0, .76, -.04], wood);
            for (let i = 0; i < 9; i++)
                rod(g, [-.05, .3 + i * .06, .07], [-.105, .3 + i * .06, .07], .008, ivory);
        }
    };
    if (spec.family === 'strum') {
        const electric = id === 'electric_guitar' || id === 'bass_guitar';
        const g = electric ? buildGuitar(id === 'bass_guitar') : new T.Group();
        if (!electric) {
            pluckedBody(g, id);
            g.scale.setScalar(['ukulele', 'charango', 'mandolin'].includes(id) ? .47 : id === 'sitar' ? .78 : .67);
            g.name = 'instrument';
        }
        if (electric) {
            const body = g.getObjectByName('instrument-body') as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
            body.material.color.set(colour);
        }
        g.position.set(-.07, 1.03, .16);
        g.rotation.set(.04, -.06, -1.03);
        root.add(g);
        const left = marker(g, 'grip-left', [.015, .71, .12]), right = marker(g, 'grip-right', [0, .03, .22]);
        moving.push((t, e) => { left.position.y = .71 + Math.sin(t * 1.9) * .04 * e; right.position.x = Math.sin(t * Math.PI * 8) * .065 * e; });
        return finish(left, right);
    }
    if (spec.family === 'bow' || spec.family === 'upright') {
        const upright = spec.family === 'upright', erhu = id === 'erhu', size = id === 'upright_bass' ? 1.38 : id === 'cello' ? 1.02 : id === 'viola' ? .48 : .42;
        const g = new T.Group();
        root.add(g);
        if (erhu) {
            const body = cylinder(g, .065, .065, .15, [0, 0, 0], wood, 6);
            body.rotation.x = Math.PI / 2;
            box(g, [.024, .85, .025], [0, .4, .01], darkWood);
            strings(g, 2, [0, -.03, .08], [0, .83, .05], .01);
        }
        else {
            pluckedBody(g, 'bowed', .23);
            const hole = g.children.find(o => o instanceof T.Mesh && o.geometry instanceof T.CircleGeometry);
            hole?.removeFromParent();
            for (const x of [-.095, .095])
                tube(g, [[x - .02, -.13, .12], [x, -.08, .12], [x, .05, .12], [x + .02, .12, .12]], .006, black);
        }
        g.scale.setScalar(erhu ? 1 : size);
        g.position.set(upright ? .1 : .19, upright ? (id === 'upright_bass' ? .64 : .43) : 1.4, upright ? .38 : .25);
        if (!upright)
            g.rotation.set(Math.PI / 2, 0, -.9);
        else
            rod(root, [.1, 0, .38], [.1, .35, .38], .009, chrome);
        l = upright ? [.13, id === 'upright_bass' ? 1.35 : 1.06, .44] : [.42, 1.37, .48];
        r = upright ? [-.12, id === 'upright_bass' ? 1.1 : .79, .44] : [-.1, 1.43, .4];
        seated = id === 'cello' || erhu;
        const bow = new T.Group();
        bow.name = 'playing-bow';
        root.add(bow);
        if (upright)
            tools.push(bow);
        rod(bow, [-.29, 0, 0], [.29, 0, 0], .006, darkWood);
        rod(bow, [-.28, -.012, .007], [.28, -.012, .007], .002, ivory);
        moving.push(t => { bow.position.set(r[0] + (upright ? 0 : .16) + Math.sin(t * 3) * .09, r[1], r[2]); });
    }
    else if (spec.family === 'harp') {
        const kora = id === 'kora';
        if (kora) {
            ellipsoid(root, [.25, .26, .23], [.05, .68, .4], wood);
            rod(root, [.05, .58, .41], [.05, 1.66, .41], .028, darkWood);
            for (let i = 0; i < 21; i++)
                rod(root, [(i / 20 - .5) * .31, .7, .58], [.05, 1 + i * .03, .43], .001, chrome);
        }
        else {
            rod(root, [-.43, .08, .6], [-.43, 1.75, .6], .037, wood);
            rod(root, [-.43, .08, .6], [.48, 1.39, .6], .065, wood);
            tube(root, [[-.43, 1.75, .6], [-.06, 1.7, .6], [.2, 1.39, .6], [.48, 1.39, .6]], .04, wood);
            for (let i = 0; i < 28; i++) {
                const x = -.39 + i * .03;
                rod(root, [x, .14 + (x + .39) * 1.43, .6], [x, 1.62 - (x + .39) * .22, .6], .001, i % 7 === 0 ? matte('#ad3b35') : chrome);
            }
        }
        l = [.24, 1.14, .54];
        r = [-.18, 1.07, .52];
    }
    else if (spec.family === 'steel') {
        const wide = id === 'guzheng', g = new T.Group();
        root.add(g);
        box(g, [wide ? 1.65 : 1.1, .12, .35], [0, .91, .48], wood);
        strings(g, wide ? 21 : 10, [-.48, .985, .35], [.48, .985, .64], .11);
        for (const x of [-.48, .48])
            for (const z of [.34, .62])
                rod(g, [x, 0, z], [x, .87, z], .021, chrome);
        if (wide)
            for (let i = 0; i < 21; i++)
                box(g, [.016, .032, .025], [-.5 + i * .048, .99, .39 + i * .009], ivory);
        if (id === 'pedal_steel')
            for (let i = 0; i < 4; i++) {
                rod(g, [-.3 + i * .15, .05, .31], [-.3 + i * .15, .85, .31], .006, chrome);
                box(g, [.06, .02, .18], [-.3 + i * .15, .04, .3], black);
            }
        l = [.3, 1.02, .44];
        r = [-.27, 1.02, .44];
        seated = !wide;
    }
    else if (spec.family === 'keys') {
        const grand = ['classical_piano', 'jazz_piano', 'harpsichord'].includes(id), organ = /organ/.test(id), acoustic = grand || organ || id === 'celesta';
        box(root, [1.4, .16, grand ? .85 : .47], [0, .88, grand ? .72 : .53], acoustic ? wood : black);
        keys(root, 1.3, .986, .4, 35);
        if (grand) {
            box(root, [1.4, .15, .9], [0, .85, 1.1], wood);
            const lid = box(root, [1.42, .035, 1.25], [0, 1.25, 1.01], wood);
            lid.rotation.x = -.38;
            rod(root, [.55, .94, 1.36], [.55, 1.41, 1.36], .011, darkWood);
        }
        if (organ || ['mellotron', 'celesta', 'wurlitzer'].includes(id))
            box(root, [1.38, .65, .34], [0, .5, .65], wood);
        if (organ) {
            keys(root, 1.25, 1.14, .62);
            for (let i = 0; i < 9; i++)
                box(root, [.016, .025, .11], [-.36 + i * .09, 1.23, .77], i % 2 ? ivory : black);
        }
        if (id === 'pipe_organ')
            for (let i = 0; i < 13; i++) {
                const h = .75 + Math.abs(i - 6) * .11;
                rod(root, [-.62 + i * .103, 1.15, .97], [-.62 + i * .103, 1.15 + h, .97], .034, chrome);
            }
        if (!grand && !organ) {
            for (let i = 0; i < 12; i++)
                cylinder(root, .011, .011, .021, [-.53 + i * .095, 1.01, .68], chrome, 8);
            box(root, [.14, .013, .06], [.36, 1.008, .68], matte(id === 'digital_synth' ? '#65cdbb' : '#485b7f'));
        }
        for (const x of [-.59, .59])
            rod(root, [x, 0, .63], [x, .85, .63], .027, chrome);
        if (id === 'vocoder') {
            rod(root, [.58, .94, .69], [.4, 1.47, .35], .012, chrome);
            root.add(buildHandInstrument('vocals'));
            root.children[root.children.length - 1].position.set(.4, 1.47, .35);
        }
        l = [.24, 1.03, .4];
        r = [-.24, 1.03, .4];
    }
    else if (spec.family === 'kit') {
        seated = true;
        const electronic = id === 'electronic_drums', jazz = id === 'jazz_drums';
        if (!electronic) {
            const kick = new T.Group();
            kick.rotation.x = Math.PI / 2;
            kick.position.set(0, .38, .95);
            root.add(kick);
            drum(kick, 0, 0, 0, jazz ? .3 : .4, .4);
        }
        for (const [x, y, z, rad] of [[-.39, .92, .43, .23], [.29, 1.1, .8, .19], [.68, .85, .79, .27], ...(!jazz ? [[0, 1.12, 1, .21]] : [])]) {
            drum(root, x, y, z, rad, electronic ? .045 : .23, electronic ? black : wood);
            stand(root, x, z, y - .25);
        }
        for (const [x, y, z, rad] of [[-.75, 1.3, .65, .3], [.7, 1.46, 1, .34], [-.52, 1.04, .38, .2]]) {
            stand(root, x, z, y);
            const cymbal = cylinder(root, rad * .2, rad, .035, [x, y, z], electronic ? black : brass, 32);
            cymbal.name = 'playing-cymbal';
            moving.push((t, e) => { cymbal.rotation.z = Math.sin(t * 12 + x) * .012 * e; });
        }
        if (electronic) {
            rod(root, [-.7, .6, .8], [.7, .6, .8], .022, chrome);
            box(root, [.2, .07, .16], [-.78, 1.08, .77], black);
        }
        l = [.22, 1.02, .4];
        r = [-.32, .98, .3];
    }
    else if (spec.family === 'handDrum' || spec.family === 'mallets') {
        if (id === 'cajon') {
            box(root, [.42, .49, .38], [0, .245, .17], wood);
            seated = true;
            l = [.15, .49, .34];
            r = [-.15, .49, .34];
        }
        else if (['marimba', 'vibraphone', 'xylophone', 'glockenspiel', 'gamelan'].includes(id)) {
            const bars = id === 'glockenspiel' ? 18 : 25, width = id === 'marimba' ? 1.7 : 1.35;
            for (let i = 0; i < bars; i++) {
                const x = -width / 2 + i * width / bars, len = .47 - i * .009;
                box(root, [width / bars * .88, .035, len], [x, .94, .53], ['vibraphone', 'glockenspiel'].includes(id) ? chrome : darkWood);
                if (id !== 'glockenspiel')
                    cylinder(root, .022, .022, .55 - i * .011, [x, .64, .56], id === 'vibraphone' ? chrome : brass, 10);
            }
            for (const x of [-width * .43, width * .43])
                rod(root, [x, 0, .52], [x, .9, .52], .025, chrome);
            l = [.27, 1.04, .43];
            r = [-.27, 1.04, .43];
            if (id === 'gamelan') {
                const gong = cylinder(root, .24, .24, .025, [.8, 1.24, .74], brass, 32);
                gong.rotation.x = Math.PI / 2;
                stand(root, .8, .75, 1.5);
            }
        }
        else {
            const count = ['tabla', 'timpani', 'latin_percussion'].includes(id) ? 2 : 1;
            for (let i = 0; i < count; i++) {
                const x = count === 2 ? (i - .5) * .53 : 0, y = id === 'tabla' ? .76 : 1, rad = id === 'taiko' ? .39 : id === 'timpani' ? .32 : id === 'snare' ? .24 : .21;
                if (id === 'steelpan') {
                    const pan = new T.Mesh(new T.SphereGeometry(rad, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass);
                    pan.rotation.x = Math.PI;
                    pan.position.set(x, y, .52);
                    root.add(pan);
                    for (let k = 0; k < 10; k++)
                        ellipsoid(root, [.038, .005, .047], [x + Math.cos(k) * .13, y - .045, .52 + Math.sin(k) * .13], chrome);
                }
                else
                    drum(root, x, y, .52, rad, id === 'snare' ? .17 : id === 'tabla' ? .34 : .6);
                stand(root, x, .52, y - .3);
                if (id === 'tabla')
                    cylinder(root, .055, .055, .01, [x, y + .025, .52], black, 24);
                if (id === 'african_drums')
                    cylinder(root, .1, .17, .25, [x, .27, .52], wood, 20);
            }
            l = [.19, id === 'tabla' ? .84 : 1.09, .52];
            r = [-.19, l[1], .52];
            seated = id === 'tabla';
        }
    }
    else if (spec.family === 'bellows') {
        const small = id === 'concertina', g = new T.Group();
        g.position.set(0, 1.18, .32);
        root.add(g);
        g.name = 'playing-bellows';
        for (let i = 0; i < 12; i++)
            box(g, [.014, small ? .21 : .35, small ? .18 : .22], [-.16 + i * .03, 0, 0], i % 2 ? darkWood : black);
        for (const x of [-.24, .24]) {
            box(g, [.14, small ? .23 : .39, small ? .2 : .25], [x, 0, .012], wood);
            for (let i = 0; i < 8; i++) {
                if (small || x < 0)
                    cylinder(g, .008, .008, .018, [x, (i - 3.5) * .025, .15], ivory, 8).rotation.x = Math.PI / 2;
                else
                    box(g, [.12, .025, .015], [x, (i - 3.5) * .044, .145], i % 3 ? ivory : black);
            }
        }
        moving.push(t => { g.scale.x = 1 + Math.sin(t * 2) * .12; });
        l = [.24, 1.18, .49];
        r = [-.24, 1.18, .49];
    }
    else if (spec.family === 'brass') {
        const low = ['tuba', 'euphonium', 'sousaphone', 'french_horn'].includes(id), g = new T.Group();
        g.position.set(0, 1.46, .23);
        root.add(g);
        if (low) {
            const size = id === 'sousaphone' ? .45 : id === 'tuba' ? .29 : id === 'euphonium' ? .22 : .18;
            const loop = new T.Mesh(new T.TorusGeometry(size, .029, 10, 48), brass);
            loop.position.set(0, -size, .12);
            g.add(loop);
            tube(g, [[0, 0, 0], [.07, -.08, .1], [size, -size, .12], [size, 0, .12]], .027, brass);
            bell(g, [size, -.01, .12], id === 'sousaphone' ? .26 : .16, .28, 'y');
            l = [.15, 1.19, .38];
            r = [-.13, 1.23, .4];
        }
        else {
            const length = id === 'trombone' ? .72 : id === 'cornet' ? .3 : .4;
            tube(g, [[0, 0, 0], [.04, -.06, .11], [.04, -.06, length], [.1, -.06, length], [.1, -.06, .1]], .015, brass);
            bell(g, [.04, -.04, length - .05], id === 'flugelhorn' ? .13 : .095, .2);
            l = [.12, 1.35, .42];
            r = [-.07, 1.34, id === 'trombone' ? .49 : .44];
            if (id === 'trombone') {
                const slide = new T.Group();
                slide.name = 'playing-slide';
                g.add(slide);
                tube(slide, [[.1, -.07, .15], [.1, -.07, .7], [.15, -.07, .7], [.15, -.07, .15]], .01, chrome);
                moving.push(t => { slide.position.z = -.1 + Math.sin(t * 2) * .06; });
            }
        }
        for (let i = 0; i < 3; i++)
            cylinder(g, .013, .013, .07, [.09, -.05, .12 + i * .05], chrome, 12);
    }
    else if (spec.family === 'flute' || spec.family === 'reed' || spec.family === 'drone') {
        const g = new T.Group();
        g.position.set(0, 1.49, .2);
        root.add(g);
        const sax = /sax/.test(id), transverse = spec.family === 'flute', len = id === 'piccolo' ? .31 : id === 'bassoon' || id === 'didgeridoo' ? 1.06 : id === 'bari_sax' ? .77 : id === 'tenor_sax' ? .62 : .48;
        if (sax && id !== 'soprano_sax') {
            tube(g, [[0, 0, 0], [.04, -.1, .1], [.08, -len, .2], [.08, -len + .05, .34], [.08, -len + .23, .37]], .022, brass);
            bell(g, [.08, -len + .15, .37], .095, .17, 'y');
        }
        else if (transverse)
            rod(g, [0, 0, 0], [len, -.04, .11], .013, id === 'piccolo' ? darkWood : chrome);
        else
            rod(g, [0, 0, 0], [id === 'didgeridoo' ? .15 : .02, -len, .28], id === 'didgeridoo' ? .04 : .018, ['ewi'].includes(id) ? ivory : darkWood);
        for (let i = 0; i < 8; i++) {
            const f = (i + 1) / 10;
            const p: Point = transverse ? [len * f, -.04 * f, .11 * f + .017] : [.025, -len * f, .28 * f + .018];
            const key = cylinder(g, .009, .009, .009, p, chrome, 10);
            key.rotation.x = Math.PI / 2;
        }
        l = transverse ? [Math.min(.42, len * .83), 1.45, .27] : [.04, 1.31, .32];
        r = transverse ? [.09, 1.44, .23] : [.02, 1.12, .4];
    }
    else if (spec.family === 'mouth') {
        if (id === 'harmonica') {
            box(root, [.13, .035, .04], [0, 1.46, .25], chrome);
            for (let i = 0; i < 10; i++)
                box(root, [.008, .016, .008], [-.052 + i * .011, 1.46, .274], black);
        }
        else
            for (let i = 0; i < 11; i++)
                rod(root, [-.16 + i * .03, 1.49, .28], [-.16 + i * .03, 1.49 - (.14 + i * .019), .28], .012, wood);
        l = [.09, 1.41, .28];
        r = [-.09, 1.41, .28];
    }
    else if (spec.family === 'pipes') {
        ellipsoid(root, [.19, .17, .13], [-.15, 1.14, .32], wood);
        for (let i = 0; i < 3; i++)
            rod(root, [-.23 + i * .06, 1.12, .29], [-.3 + i * .08, 1.78 + i * .055, .22], .016, darkWood);
        rod(root, [-.1, 1.2, .34], [0, 1.49, .2], .013, darkWood);
        rod(root, [-.02, 1.15, .39], [.06, .82, .5], .016, darkWood);
        l = [0, 1.12, .41];
        r = [.035, 1.07, .39];
        if (id === 'uilleann') {
            box(root, [.12, .21, .14], [.27, 1.03, .23], darkWood);
            seated = true;
        }
    }
    else if (spec.family === 'decks' || spec.family === 'pads' || spec.family === 'modular' || spec.family === 'theremin') {
        box(root, [1.2, .1, .5], [0, .92, .53], black);
        for (const x of [-.48, .48])
            rod(root, [x, 0, .5], [x, .88, .5], .022, chrome);
        if (spec.family === 'decks') {
            for (const x of [-.34, .34]) {
                cylinder(root, .2, .2, .021, [x, .99, .53], chrome, 36);
                cylinder(root, .18, .18, .01, [x, 1.01, .53], black, 36);
                cylinder(root, .052, .052, .011, [x, 1.018, .53], wood, 24);
                rod(root, [x + .16, 1.03, .68], [x + .09, 1.03, .43], .007, chrome);
            }
        }
        else if (spec.family === 'pads') {
            const n = id === 'push_launchpad' ? 8 : id === 'mpc' ? 4 : 3;
            for (let y = 0; y < n; y++)
                for (let x = 0; x < n; x++)
                    box(root, [.48 / n, .014, .33 / n], [-.26 + x * .55 / n, .986, .36 + y * .38 / n], matte(['#6ca9a2', '#bd7096', '#d3a86d'][(x + y) % 3]));
            box(root, [.23, .014, .09], [.31, .985, .64], matte('#82b6b0'));
        }
        else if (spec.family === 'modular') {
            box(root, [1.13, .4, .12], [0, 1.19, .74], darkWood);
            for (let i = 0; i < 8; i++) {
                box(root, [.125, .36, .025], [-.48 + i * .135, 1.19, .66], chrome);
                for (let j = 0; j < 4; j++)
                    cylinder(root, .009, .009, .02, [-.48 + i * .135, 1.06 + j * .07, .634], black, 8).rotation.x = Math.PI / 2;
                tube(root, [[-.48 + i * .135, 1.12, .63], [-.4 + i * .11, .98, .46], [.4 - i * .1, 1.24, .63]], .003, matte(['#b76565', '#d0b367', '#6995b2'][i % 3]));
            }
        }
        else {
            rod(root, [.46, .98, .54], [.46, 1.63, .54], .008, chrome);
            tube(root, [[-.4, 1.02, .5], [-.67, 1.02, .5], [-.67, 1.02, .75], [-.4, 1.02, .75]], .008, chrome);
        }
        l = spec.family === 'theremin' ? [.37, 1.47, .51] : spec.family === 'modular' ? [.25, 1.25, .61] : [.26, 1.04, .44];
        r = spec.family === 'theremin' ? [-.5, 1.18, .5] : [-.25, l[1], l[2]];
    }
    else if (spec.family === 'keytar') {
        const g = new T.Group();
        g.rotation.z = -.3;
        g.position.set(0, 1.08, .32);
        root.add(g);
        box(g, [.7, .1, .27], [0, 0, 0], wood);
        keys(g, .61, .071, 0, 18);
        box(g, [.33, .06, .1], [.48, 0, .07], black);
        l = [.35, 1.07, .33];
        r = [-.12, 1.15, .33];
    }
    else if (spec.family === 'frame') {
        const drumGroup = new T.Group();
        root.add(drumGroup);
        drum(drumGroup, 0, 0, 0, .19, .06);
        drumGroup.rotation.x = Math.PI / 2;
        drumGroup.position.set(.14, 1.22, .34);
        l = [.3, 1.25, .37];
        r = [.01, 1.2, .41];
    }
    else if (spec.family === 'thumb') {
        box(root, [.17, .22, .06], [0, 1.17, .34], wood);
        for (let i = 0; i < 15; i++)
            box(root, [.006, .07 + Math.abs(i - 7) * .008, .006], [-.07 + i * .01, 1.18, .376], chrome);
        l = [.065, 1.16, .4];
        r = [-.065, 1.16, .4];
    }
    else if (spec.family === 'voice') {
        const mic = buildHandInstrument('vocals');
        mic.position.set(-.025, 1.48, .27);
        root.add(mic);
        l = [.27, .86, .12];
        r = [-.025, 1.48, .27];
    }
    const left = marker(root, 'grip-left', l), right = marker(root, 'grip-right', r);
    if (['kit', 'mallets'].includes(spec.family))
        for (const [grip, sign] of [[left, 1], [right, -1]] as const) {
            const stick = new T.Group();
            stick.name = 'playing-stick';
            tools.push(stick);
            grip.add(stick);
            rod(stick, [0, 0, 0], [0, -.13, .19], .006, darkWood);
            if (spec.family === 'mallets')
                ellipsoid(stick, [.025, .025, .025], [0, -.13, .19], id === 'vibraphone' ? head : ivory);
            moving.push((t, e) => { grip.position.y = (sign === 1 ? l[1] : r[1]) + (1 + Math.sin(t * 12.56 + (sign === 1 ? 0 : Math.PI))) * .06 * e; });
        }
    else if (!['voice', 'strum'].includes(spec.family))
        moving.push((t, e) => {
            const amount = spec.family === 'handDrum' ? .065 : spec.family === 'brass' ? .007 : .025;
            left.position.y = l[1] + Math.sin(t * 4) * amount * e;
            right.position.y = r[1] + Math.cos(t * 4) * amount * e;
            if (spec.family === 'bow' || spec.family === 'upright')
                right.position.x = r[0] + Math.sin(t * 3) * .09 * e;
            if (id === 'trombone')
                right.position.z = r[2] + Math.sin(t * 2) * .06 * e;
        });
    if (seated && id !== 'cajon') {
        cylinder(root, .22, .22, .08, [0, .58, -.06], black, 24);
        stand(root, 0, -.06, .54);
    }
    return finish(left, right);
    function finish(left: T.Object3D, right: T.Object3D): InstrumentRig {
        // Static hardware is batched; grip-owned sticks and moving slides/bows remain independent.
        root.traverse(o => { if (!(o instanceof T.Mesh))
            return; let parent = o.parent; while (parent && parent !== root) {
            if (parent.name.startsWith('grip-') || parent.name.startsWith('playing-'))
                o.userData.animated = true;
            parent = parent.parent;
        } });
        batchStaticMeshes(root);
        if (['harp', 'handDrum', 'mallets', 'steel', 'modular', 'theremin'].includes(spec.family))
            root.position.z = -.12;
        return { root, left, right, family: spec.family, stationary: spec.stationary, seated, tools, animate: (seconds, energy, reduced) => { for (const move of moving)
                move(reduced ? 0 : seconds, reduced ? 0 : energy); root.updateWorldMatrix(true, true); } };
    }
}
