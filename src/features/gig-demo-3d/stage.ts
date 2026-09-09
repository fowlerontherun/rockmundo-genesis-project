import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import grilleUrl from '@/assets/textures/equipment/speaker-grille.png';
import { demoAssetUrl } from './assets';
import { resolveVenueProfile } from './venueProfile';
import { buildVenueEnvironment } from './venueEnvironment';
import type { ConcertVenue } from './liveTypes';

export const metal = (color = '#6e7581', roughness = 0.3) => new T.MeshStandardMaterial({ color, metalness: 0.78, roughness });
export const matte = (color: string, roughness = 0.8) => new T.MeshStandardMaterial({ color, roughness });
/** Static detail shares a draw call per material; named/animated parts stay addressable. */
export function batchStaticMeshes(root: T.Group) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), groups = new Map<string, T.Mesh[]>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh) || object.name || Array.isArray(object.material) || object.material.transparent || object.userData.animated) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    groups.set(key, [...(groups.get(key) ?? []), object]);
  });
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const parts = meshes.map(mesh => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      return geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    });
    const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const combined = new T.Mesh(geometry, meshes[0].material); combined.castShadow = meshes[0].castShadow; combined.receiveShadow = meshes[0].receiveShadow;
    meshes.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); }); root.add(combined);
  }
}
export function box(parent: T.Object3D, size: number[], pos: number[], mat: T.Material) {
  const object = new T.Mesh(new T.BoxGeometry(...size as [number, number, number]), mat);
  object.position.set(...pos as [number, number, number]); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
export function cylinder(parent: T.Object3D, top: number, bottom: number, height: number, pos: number[], mat: T.Material, segments = 20) {
  const object = new T.Mesh(new T.CylinderGeometry(top, bottom, height, segments), mat);
  object.position.set(...pos as [number, number, number]); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
export function rod(parent: T.Object3D, from: number[], to: number[], radius: number, mat: T.Material) {
  const a = new T.Vector3(...from as [number, number, number]), b = new T.Vector3(...to as [number, number, number]);
  const object = cylinder(parent, radius, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(0.5).toArray(), mat, 8);
  object.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize()); return object;
}
function texture(loader: T.TextureLoader, url: string, repeat: [number, number], color = true) {
  const map = loader.load(url); map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(...repeat); map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace; map.anisotropy = 4; return map;
}
function label(text: string, width: number, height: number, color = '#e4d7bd', background = 'transparent') {
  const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  if (background !== 'transparent') { ctx.fillStyle = background; ctx.fillRect(0, 0, 1536, 384); }
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${text.length > 13 ? 132 : 195}px sans-serif`; ctx.fillText(text, 768, 194, 1460);
  const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
  return new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshStandardMaterial({ map, transparent: true, roughness: 0.8, side: T.DoubleSide, emissive: color, emissiveMap: map, emissiveIntensity: 0.08 }));
}

export function buildVenue(scene: T.Scene, manager: T.LoadingManager, venue?: ConcertVenue) {
  const loader = new T.TextureLoader(manager);
  const surface = (name: string, diffuse: string, repeat: [number, number], color: string) => new T.MeshStandardMaterial({
    map: texture(loader, demoAssetUrl(`${name}_${diffuse}_1k.jpg`), repeat),
    normalMap: texture(loader, demoAssetUrl(`${name}_nor_gl_1k.jpg`), repeat, false),
    roughnessMap: texture(loader, demoAssetUrl(`${name}_rough_1k.jpg`), repeat, false),
    aoMap: texture(loader, demoAssetUrl(`${name}_ao_1k.jpg`), repeat, false),
    color, roughness: 0.85, aoMapIntensity: 0.7, normalScale: new T.Vector2(0.7, 0.7),
  });
  const root = new T.Group(); root.name = 'venue'; scene.add(root);
  const profile = venue ? resolveVenueProfile(venue) : null;
  const archetype = venue?.archetype ?? 'club', outdoor = ['festival', 'beach', 'stadium'].includes(archetype), large = ['arena', 'stadium'].includes(archetype);
  const black = matte('#0d1119'), steel = metal('#4c535e'), chrome = metal('#b7c1cd');
  const oak = surface('wood_floor_worn', 'diff', [5.8, 3], '#b8ad9f');
  const brick = surface('brick_wall_001', 'diffuse', [6.6, 2.65], '#998382');
  if (!venue) {
  box(root, [large ? 48 : 24, .12, large ? 60 : 36], [0, -.09, 10], matte(archetype === 'beach' ? '#89765a' : outdoor ? '#27302b' : '#232327'));
  if (!outdoor && !large) {
  box(root, [19.8, 8, 0.25], [0, 3.9, -5.5], brick);
  box(root, [0.25, 8, 25], [-8.8, 3.9, 6.8], brick); box(root, [0.25, 8, 25], [8.8, 3.9, 6.8], brick);
  box(root, [20, 0.25, 26], [0, 7.9, 6], matte('#080b11'));
  }
  if (outdoor) {
    const sky = new T.Mesh(new T.SphereGeometry(58, 32, 16), new T.MeshBasicMaterial({ color: archetype === 'beach' ? '#253f59' : '#111c32', side: T.BackSide })); sky.position.y = 8; root.add(sky);
    // Festival stage roof and side scrims leave the audience beneath an open sky.
    box(root, [13, .2, 7], [0, 6.5, -2.5], black);
    for (const x of [-6.1, 6.1]) box(root, [.1, 5.6, 5.6], [x, 3.5, -2.5], black);
    if (archetype === 'beach') {
      box(root, [100, .05, 32], [0, -.03, 39], new T.MeshStandardMaterial({ color: '#244857', metalness: .6, roughness: .2 }));
      for (const x of [-11, 11]) { rod(root, [x, 0, 11], [x + .9, 7, 11], .18, matte('#645745')); for (let n = 0; n < 6; n++) { const leaf = new T.Mesh(new T.SphereGeometry(1, 12, 6), matte('#294738')); leaf.scale.set(2.3, .07, .5); leaf.rotation.y = n * Math.PI / 3; leaf.position.set(x + .9 + Math.cos(n * Math.PI / 3), 6.9, 11 + Math.sin(n * Math.PI / 3)); root.add(leaf); } }
    }
  }
  if (large || archetype === 'theatre') {
    const rows = large ? 8 : 3, seat = matte(archetype === 'theatre' ? '#6f2535' : '#273a50');
    for (const side of [-1, 1]) for (let row = 0; row < rows; row++) {
      const x = side * (8.5 + row * .85), y = .5 + row * .55;
      box(root, [.85, .4, 29], [x, y, 12], matte('#343b43'));
      for (let z = 1; z < 27; z += 1.1) { box(root, [.65, .12, .65], [x, y + .3, z], seat); box(root, [.1, .55, .65], [x + side * .3, y + .57, z], seat); }
      rod(root, [x, y + 1.3, -.5], [x, y + 1.3, 27], .025, chrome);
    }
    if (!outdoor) box(root, [40, .3, 48], [0, 13, 13], black);
  }
  }
  box(root, [11.6, 0.82, 5.9], [0, 0.4, -2.3], black);
  box(root, [11.6, 0.07, 5.9], [0, 0.855, -2.3], oak);
  box(root, [11.65, 0.06, 0.1], [0, 0.9, 0.66], chrome);
  // Actual draped geometry catches changing side light, rather than a flat backdrop image.
  const drapeGeo = new T.PlaneGeometry(10, 5.9, 160, 1); const vertices = drapeGeo.attributes.position;
  for (let i = 0; i < vertices.count; i++) vertices.setZ(i, Math.sin(vertices.getX(i) * 10.5) * 0.105);
  drapeGeo.computeVertexNormals();
  const drape = new T.Mesh(drapeGeo, new T.MeshStandardMaterial({ color: archetype === 'pub' ? '#2c3535' : archetype === 'theatre' ? '#551b2c' : '#3b1826', roughness: 0.93, side: T.DoubleSide }));
  drape.position.set(0, 3.65, -5.24); root.add(drape);
  const backdrop = label(venue?.bandName || 'ROCKMUNDO', 6.2, 1.55); backdrop.position.set(0, 4.85, -5.03); root.add(backdrop);
  const subtitle = label(venue?.name || 'THE LIVE ROOM', 3.05, 0.76, '#9b8c80'); subtitle.position.set(0, 3.92, -5.01); root.add(subtitle);
  // Structural trusses, braces and cabling.
  if (profile?.production !== 'portable') {
  for (const z of [-4.65, -0.5]) {
    rod(root, [-6, 5.85, z], [6, 5.85, z], 0.055, steel); rod(root, [-6, 6.2, z], [6, 6.2, z], 0.055, steel);
    for (let x = -6; x < 6; x += 0.6) rod(root, [x, 5.85, z], [x + 0.6, 6.2, z], 0.022, steel);
  }
  for (const x of [-6, 6]) {
    for (const z of [-4.65, -0.5]) {
      rod(root, [x - 0.16, 0.9, z], [x - 0.16, 6.2, z], 0.05, steel); rod(root, [x + 0.16, 0.9, z], [x + 0.16, 6.2, z], 0.05, steel);
      for (let y = 1; y < 6; y += 0.5) rod(root, [x - 0.16, y, z], [x + 0.16, y + 0.45, z], 0.02, steel);
    }
    // Suspended line arrays.
    for (let row = 0; row < 4; row++) { const speaker = box(root, [0.58, 0.37, 0.58], [x, 4.65 - row * 0.38, 0.1], black); speaker.rotation.x = -0.04 * row; }
  }
  }
  const grille = new T.MeshStandardMaterial({ map: texture(loader, grilleUrl, [2, 2]), color: '#616774', roughness: 0.65, metalness: 0.45 });
  for (const x of [-4.3, 4.3]) {
    for (const y of [1.43, 2.55]) { box(root, [1.38, 1.03, 0.7], [x, y, -3.75], black); box(root, [1.28, 0.9, 0.025], [x, y, -3.38], grille); }
    box(root, [1.25, 0.35, 0.6], [x, 3.25, -3.75], black);
    const ampLabel = label('VOLTAGE', 0.72, 0.18); ampLabel.position.set(x, 3.27, -3.43); root.add(ampLabel);
    for (let k = 0; k < 6; k++) cylinder(root, 0.023, 0.023, 0.03, [x - 0.42 + k * 0.13, 3.14, -3.42], chrome).rotation.x = Math.PI / 2;
  }
  for (const x of [-3.8, -1.3, 1.3, 3.8]) {
    const monitor = box(root, [0.95, 0.42, 0.7], [x, 1.15, 0.05], black); monitor.rotation.x = -0.3;
    const front = box(root, [0.85, 0.32, 0.03], [x, 1.28, 0.25], grille); front.rotation.x = -0.6;
  }
  // Curved instrument leads and mic cables sit on the stage.
  for (let i = 0; i < 6; i++) {
    const x = -4 + i * 1.5;
    const curve = new T.CatmullRomCurve3([new T.Vector3(x, 0.905, -2), new T.Vector3(x + 0.7, 0.905, -0.8), new T.Vector3(x - 0.6, 0.905, -0.4), new T.Vector3(-5.4, 0.905, -0.2)]);
    root.add(new T.Mesh(new T.TubeGeometry(curve, 28, 0.012, 5, false), black));
  }
  if (!venue) { box(root, [2.85, 0.25, 2.4], [0.8, 1, -3.05], black); box(root, [2.9, 0.035, 2.45], [0.8, 1.145, -3.05], oak);
  }
  // Side wall lamps, balcony rail and warm practicals give the room depth.
  if (!venue && !outdoor && !large) for (const x of [-8.5, 8.5]) {
    for (const z of [0, 5, 10, 15]) {
      box(root, [0.13, 1.0, 0.36], [x, 3, z], black);
      const practical = new T.MeshStandardMaterial({ color: '#f4bb78', emissive: '#ff9b44', emissiveIntensity: 1.8 });
      box(root, [0.15, 0.66, 0.27], [x + (x > 0 ? -0.1 : 0.1), 3, z], practical);
      const light = new T.PointLight('#ef9c62', 4, 4, 2); light.position.set(x * 0.95, 3, z); root.add(light);
    }
    rod(root, [x, 4.25, 1], [x, 4.25, 16], 0.045, chrome);
    for (let z = 1; z <= 16; z += 0.8) rod(root, [x, 3.35, z], [x, 4.25, z], 0.025, steel);
  }
  if (!venue) {
  const exit = label('EXIT', 0.7, 0.2, '#b2f2d2', '#174432'); exit.position.set(-6.9, 2.9, -5.28); root.add(exit);
  box(root, [1.1, 2.3, 0.12], [-6.9, 1.13, -5.32], matte('#19252d'));
  }
  batchStaticMeshes(root);
  if (profile && venue) {
    root.scale.set(profile.stageWidth / 11.6, (profile.rigHeight - profile.stageHeight) / 5.3, profile.stageDepth / 5.9);
    root.position.set(0, profile.stageHeight - .9 * root.scale.y, .65 * (1 - root.scale.z));
    root.userData.profile = profile;
    buildVenueEnvironment(scene, profile, venue.seed, oak, brick);
  }
  return root;
}

export function buildGuitar(bass = false) {
  const root = new T.Group(), black = matte('#12161b'), chrome = metal('#bdc2cb'), neck = matte('#784f2f', 0.46);
  root.name = 'instrument';
  const outline = new T.Shape();
  outline.moveTo(0, 0.36); outline.bezierCurveTo(-0.06, 0.25, -0.12, 0.23, -0.17, 0.31);
  outline.bezierCurveTo(-0.3, 0.28, -0.16, 0.12, -0.28, 0.01); outline.bezierCurveTo(-0.43, -0.18, -0.27, -0.42, 0, -0.39);
  outline.bezierCurveTo(0.3, -0.42, 0.43, -0.17, 0.28, 0.01); outline.bezierCurveTo(0.16, 0.12, 0.22, 0.24, 0.12, 0.32); outline.bezierCurveTo(0.04, 0.23, 0.07, 0.27, 0, 0.36);
  const body = new T.Mesh(new T.ExtrudeGeometry(outline, { depth: 0.095, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.025, bevelThickness: 0.025, curveSegments: 16 }), new T.MeshPhysicalMaterial({ color: bass ? '#602322' : '#d09a45', metalness: 0.23, roughness: 0.24, clearcoat: 0.7 }));
  body.name = 'instrument-body'; root.add(body);
  const guard = new T.Mesh(new T.CircleGeometry(0.175, 24), matte(bass ? '#101113' : '#e0d2aa', 0.28)); guard.scale.set(0.75, 1.4, 1); guard.position.set(0.075, -0.005, 0.125); root.add(guard);
  const length = bass ? 0.81 : 0.68;
  box(root, [0.09, length, 0.045], [0, 0.3 + length / 2, 0.09], neck);
  box(root, [0.082, length, 0.012], [0, 0.3 + length / 2, 0.12], matte('#30271f', 0.45)).name = 'fretboard';
  for (let i = 0; i < 16; i++) rod(root, [-0.041, 0.33 + i * length / 17, 0.13], [0.041, 0.33 + i * length / 17, 0.13], 0.002, chrome);
  for (const y of [-0.04, 0.11]) box(root, [0.14, 0.037, 0.025], [0, y, 0.15], black);
  box(root, [0.14, 0.05, 0.025], [0, -0.19, 0.15], chrome);
  const head = box(root, [0.13, 0.25, 0.05], [0.025, 0.42 + length, 0.085], neck); head.rotation.z = -0.18;
  for (let i = 0; i < (bass ? 4 : 6); i++) {
    const x = -0.03 + i * 0.06 / (bass ? 3 : 5);
    rod(root, [x, -0.21, 0.17], [x, 0.51 + length, 0.14], 0.001, chrome);
    cylinder(root, 0.013, 0.013, 0.045, [0.095, 0.33 + length + i * 0.034, 0.085], chrome, 8).rotation.z = Math.PI / 2;
  }
  for (const y of [-0.17, -0.25]) cylinder(root, 0.018, 0.018, 0.02, [0.18, y, 0.145], chrome, 12).rotation.x = Math.PI / 2;
  root.traverse(child => { if (child instanceof T.Mesh) child.castShadow = true; });
  root.scale.setScalar(0.7); batchStaticMeshes(root); return root;
}

export function buildDrums(scene: T.Object3D) {
  const root = new T.Group(); root.position.set(0.8, 1.16, -2.55); scene.add(root);
  const chrome = metal('#bdc5cf'), heads = matte('#d6d3c8', 0.45), shell = new T.MeshPhysicalMaterial({ color: '#83432d', roughness: 0.24, metalness: 0.35, clearcoat: 0.8 });
  const cymbalMat = metal('#bea35e', 0.36); const cymbals: T.Object3D[] = [];
  const bass = cylinder(root, 0.48, 0.48, 0.54, [0, 0.5, 0.3], shell, 40); bass.rotation.x = Math.PI / 2;
  for (const z of [0.02, 0.58]) { const head = cylinder(root, 0.49, 0.49, 0.025, [0, 0.5, z], z > 0.3 ? matte('#14171d') : heads, 40); head.rotation.x = Math.PI / 2; }
  const logo = label('RM', 0.48, 0.12, '#c4bdb1'); logo.position.set(0, 0.52, 0.6); root.add(logo);
  const drums = [[-0.33, 1.12, 0, 0.23], [0.27, 1.2, -0.06, 0.25], [0.75, 0.69, -0.32, 0.34], [-0.65, 0.79, -0.62, 0.26]];
  for (const [x, y, z, r] of drums) {
    cylinder(root, r, r, 0.3, [x, y, z], shell, 28);
    cylinder(root, r + 0.012, r + 0.012, 0.035, [x, y + 0.17, z], chrome, 28);
    cylinder(root, r - 0.01, r - 0.01, 0.012, [x, y + 0.193, z], heads, 28);
    for (let a = 0; a < 6; a++) { const t = a * Math.PI / 3; rod(root, [x + Math.cos(t) * r, y - 0.12, z + Math.sin(t) * r], [x + Math.cos(t) * r, y + 0.13, z + Math.sin(t) * r], 0.014, chrome); }
  }
  for (const [x, y, z, r] of [[-1.0, 1.65, 0.0, 0.42], [0.9, 1.75, 0.05, 0.45], [-0.85, 1.15, -0.83, 0.25], [0.08, 1.85, 0.09, 0.29]]) {
    rod(root, [x, 0, z], [x, y, z], 0.016, chrome);
    for (let a = 0; a < 3; a++) rod(root, [x, 0.32, z], [x + Math.cos(a * 2.1) * 0.32, 0.02, z + Math.sin(a * 2.1) * 0.32], 0.012, chrome);
    const cymbal = cylinder(root, r * 0.18, r, 0.055, [x, y, z], cymbalMat, 40); cymbal.userData.animated = true; cymbals.push(cymbal);
    for (const ring of [0.55, 0.8, 0.94]) { const edge = new T.Mesh(new T.TorusGeometry(r * ring, 0.0015, 4, 48), chrome); edge.rotation.x = Math.PI / 2; edge.position.set(x, y - 0.02, z); root.add(edge); }
  }
  cylinder(root, 0.24, 0.24, 0.1, [0, 0.65, -1.03], matte('#14151a')); rod(root, [0, 0, -1.03], [0, 0.64, -1.03], 0.04, chrome);
  batchStaticMeshes(root);
  return cymbals;
}

export function microphone(parent: T.Object3D, position: [number, number, number]) {
  const root = new T.Group(); root.position.set(...position); parent.add(root);
  const chrome = metal('#5f6470'), black = matte('#16191f');
  cylinder(root, 0.23, 0.25, 0.055, [0, 0.025, 0], black);
  rod(root, [0, 0.02, 0], [0, 1.51, 0], 0.014, chrome);
  rod(root, [0, 1.45, 0], [0, 1.51, -0.3], 0.015, chrome);
  const mic = cylinder(root, 0.024, 0.022, 0.16, [0, 1.52, -0.31], black); mic.rotation.x = Math.PI / 2;
  const head = new T.Mesh(new T.SphereGeometry(0.034, 12, 8), metal('#434956', 0.7)); head.position.set(0, 1.52, -0.39); root.add(head);
  return root;
}


export function buildKeyboard(dj = false) {
  const root = new T.Group(), black = matte('#171c27'), chrome = metal();
  box(root, [1.35, .13, .45], [0, .94, .53], black);
  for (const side of [-1, 1]) { rod(root, [side * .48, 0, .43], [-side * .48, .88, .43], .022, chrome); }
  if (dj) {
    for (const x of [-.37, .37]) { cylinder(root, .16, .16, .025, [x, 1.02, .53], metal('#60707d')); for (let i = 0; i < 4; i++) box(root, [.055, .012, .055], [x -.1 + i * .066, 1.025, .7], matte(['#366f78','#c66c81'][i % 2])); }
  } else {
    for (let i = 0; i < 28; i++) { const x = -.61 + i * .044; box(root, [.04, .025, .24], [x, 1.02, .43], matte('#e7e3d5')); if (![2, 6].includes(i % 7)) box(root, [.025, .035, .13], [x + .023, 1.048, .49], black); }
  }
  batchStaticMeshes(root); return root;
}

export function buildHandInstrument(role: 'vocals' | 'strings' | 'brass' | 'percussion', color = '#a26b36') {
  const root = new T.Group(), chrome = metal('#a6b2be'), shell = new T.MeshPhysicalMaterial({ color, roughness: .3, clearcoat: .7 });
  if (role === 'vocals') {
    rod(root, [0, 0, -.08], [0, 0, .1], .023, matte('#16191f'));
    const grille = new T.Mesh(new T.SphereGeometry(.033, 16, 10), chrome); grille.position.z = -.09; root.add(grille);
  } else if (role === 'brass') {
    rod(root, [0, 0, 0], [0, -.08, .39], .035, metal('#c4a25a'));
    const bell = cylinder(root, .12, .035, .18, [0, -.08, .47], metal('#c4a25a'), 24); bell.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) cylinder(root, .017, .017, .12, [.055, -.03, .12 + i * .06], chrome);
  } else if (role === 'strings') {
    const body = new T.Mesh(new T.SphereGeometry(1, 24, 12), shell); body.scale.set(.105, .05, .19); root.add(body);
    box(root, [.035, .025, .3], [0, 0, .24], matte('#322820')); rod(root, [-.3, .08, -.02], [.3, .08, .12], .006, matte('#987b55'));
    for (let i = 0; i < 4; i++) rod(root, [-.012 + i * .008, .052, -.12], [-.012 + i * .008, .022, .39], .001, chrome);
  } else {
    const hoop = new T.Mesh(new T.TorusGeometry(.15, .018, 8, 32), shell); root.add(hoop);
    for (let i = 0; i < 8; i++) { const disc = cylinder(root, .035, .035, .01, [Math.cos(i * Math.PI / 4) * .15, Math.sin(i * Math.PI / 4) * .15, 0], chrome, 12); disc.rotation.x = Math.PI / 2; }
  }
  batchStaticMeshes(root); return root;
}

/** Instrument kit positioned relative to the seated performer's feet. */
export function buildDrummerKit(parent: T.Object3D) {
  const offset = new T.Group(); offset.position.set(-.8, -1.16, 3.58); parent.add(offset);
  return buildDrums(offset);
}
