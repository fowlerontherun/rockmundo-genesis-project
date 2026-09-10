import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { STYLES, modelFile, type PlayerAppearance } from '@/features/player-model/appearance';
import { assemblePlayerModel, disposeModel, loadModelLibrary, type ModelLibrary } from '@/features/player-model/model';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ClothingPreviewVariant } from './clothingPreview';
import { buildRichGarmentVisualSpec } from './richGarmentVisuals';

interface PreviewApi { rotate: (angle: number) => void; zoom: (factor: number) => void; reset: () => void }

function makePatternTexture(spec: ReturnType<typeof buildRichGarmentVisualSpec>) {
  if (spec.pattern === 'solid' || spec.pattern === 'none') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = spec.primaryColor; ctx.fillRect(0, 0, 256, 256);
  ctx.globalAlpha = spec.opacity;
  ctx.fillStyle = spec.secondaryColor;
  ctx.strokeStyle = spec.secondaryColor;
  ctx.lineWidth = Math.max(4, 18 / spec.patternScale);
  const pattern = spec.pattern.toLowerCase();
  const step = Math.max(18, 54 / spec.patternScale);
  if (/stripe|pinstripe/.test(pattern)) {
    for (let x = -256; x < 512; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 180, 256); ctx.stroke(); }
  } else if (/check|tartan|plaid/.test(pattern)) {
    for (let x = 0; x < 256; x += step) ctx.fillRect(x, 0, step * .34, 256);
    for (let y = 0; y < 256; y += step) ctx.fillRect(0, y, 256, step * .34);
  } else if (/dot|polka|star/.test(pattern)) {
    for (let y = step / 2; y < 256; y += step) for (let x = step / 2; x < 256; x += step) { ctx.beginPath(); ctx.arc(x, y, step * .14, 0, Math.PI * 2); ctx.fill(); }
  } else if (/gradient|tie-dye/.test(pattern)) {
    const gradient = ctx.createLinearGradient(0, 0, 256, 256); gradient.addColorStop(0, spec.primaryColor); gradient.addColorStop(.5, spec.secondaryColor); gradient.addColorStop(1, spec.primaryColor); ctx.globalAlpha = 1; ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  } else if (/camo|animal|floral|paisley|geometric|flame|custom/.test(pattern)) {
    for (let i = 0; i < 36; i++) { const x = (i * 73) % 256, y = (i * 47) % 256, r = 7 + (i % 5) * 3; ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r, (i % 8) * .35, 0, Math.PI * 2); ctx.fill(); }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(spec.patternScale, spec.patternScale);
  texture.rotation = T.MathUtils.degToRad(spec.patternRotation);
  texture.center.set(.5, .5);
  return texture;
}

function garmentMaterial(spec: ReturnType<typeof buildRichGarmentVisualSpec>, texture: T.Texture | null) {
  return new T.MeshPhysicalMaterial({
    color: texture ? '#ffffff' : spec.primaryColor,
    map: texture,
    roughness: spec.roughness,
    metalness: spec.metalness,
    sheen: spec.sheen,
    sheenColor: new T.Color(spec.secondaryColor),
    clearcoat: /vinyl|latex|patent|sequins|metallic/i.test(spec.material) ? .42 : .06,
    clearcoatRoughness: Math.min(.8, spec.roughness),
  });
}

function addDetail(group: T.Group, detail: any, index: number, spec: ReturnType<typeof buildRichGarmentVisualSpec>) {
  const color = /^#[0-9a-fA-F]{6}$/.test(String(detail?.color || '')) ? detail.color : spec.secondaryColor;
  const scale = Math.max(.45, Math.min(1.8, Number(detail?.scale || 1)));
  const x = Math.max(-.33, Math.min(.33, Number(detail?.offsetX ?? detail?.offset_x ?? ((index % 3) - 1) * .16)));
  const yOffset = Math.max(-.34, Math.min(.34, Number(detail?.offsetY ?? detail?.offset_y ?? .14 - Math.floor(index / 3) * .12)));
  const z = spec.scaleZ / 2 + .025 + index * .0005;
  const type = String(detail?.type || 'badge').toLowerCase();
  let mesh: T.Mesh;
  if (/stud|button/.test(type)) mesh = new T.Mesh(new T.SphereGeometry(.025 * scale, 10, 8), new T.MeshStandardMaterial({ color, roughness: .28, metalness: .7 }));
  else if (/zip|trim|stitch/.test(type)) mesh = new T.Mesh(new T.BoxGeometry(.025 * scale, .22 * scale, .012), new T.MeshStandardMaterial({ color, roughness: .4, metalness: /zip/.test(type) ? .65 : .08 }));
  else mesh = new T.Mesh(new T.BoxGeometry(.16 * scale, .1 * scale, .012), new T.MeshStandardMaterial({ color, roughness: /embroidery|patch/.test(type) ? .88 : .5, metalness: 0 }));
  mesh.position.set(x, spec.y + yOffset, z + spec.z);
  mesh.rotation.z = T.MathUtils.degToRad(Number(detail?.rotation || 0));
  mesh.castShadow = true;
  group.add(mesh);
}

function buildGarment(item: ClothingItem, variant?: ClothingPreviewVariant) {
  const spec = buildRichGarmentVisualSpec(item, variant);
  const group = new T.Group();
  group.name = `rich-garment-${item.id}`;
  const texture = makePatternTexture(spec);
  const material = garmentMaterial(spec, texture);
  const add = (mesh: T.Mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); };

  if (spec.slot === 'top') {
    const body = new T.Mesh(new T.CapsuleGeometry(spec.scaleX * .48, spec.scaleY * .78, 8, 18), material);
    body.scale.set(1, 1, spec.scaleZ / Math.max(.01, spec.scaleX * .48)); body.position.set(0, spec.y, spec.z); add(body);
    const garment = (item.garment_config || {}) as Record<string, any>;
    const sleeves = String(garment.sleeve || garment.sleeveStyle || garment.sleeve_style || 'short').toLowerCase();
    if (sleeves !== 'sleeveless' && sleeves !== 'none') {
      const long = /long|full/.test(sleeves); const sleeveLength = long ? .58 : .28;
      for (const side of [-1, 1]) { const sleeve = new T.Mesh(new T.CapsuleGeometry(.105 * spec.scaleX, sleeveLength, 6, 12), material); sleeve.position.set(side * spec.scaleX * .55, spec.y + .08, spec.z); sleeve.rotation.z = side * -.18; add(sleeve); }
    }
  } else if (spec.slot === 'bottom') {
    const garment = (item.garment_config || {}) as Record<string, any>;
    const skirtLike = /skirt|dress|a-line|wide/.test(`${item.category} ${garment.silhouette || ''}`.toLowerCase());
    if (skirtLike) {
      const skirt = new T.Mesh(new T.CylinderGeometry(spec.scaleX * .42, spec.scaleX * (.5 + spec.flare), spec.scaleY, 28, 1, false), material); skirt.position.set(0, spec.y, spec.z); add(skirt);
    } else {
      for (const side of [-1, 1]) { const leg = new T.Mesh(new T.CapsuleGeometry(spec.scaleX * .22, spec.scaleY, 6, 14), material); leg.position.set(side * spec.scaleX * .25, spec.y, spec.z); add(leg); }
    }
  } else if (spec.slot === 'footwear') {
    for (const side of [-1, 1]) { const shoe = new T.Mesh(new T.BoxGeometry(spec.scaleX, spec.scaleY, spec.scaleZ), material); shoe.position.set(side * .2, spec.y, .09 + spec.z); shoe.rotation.x = -.08; add(shoe); }
  } else if (spec.slot === 'headwear') {
    const crown = new T.Mesh(new T.CylinderGeometry(spec.scaleX * .55, spec.scaleX * .62, spec.scaleY, 28), material); crown.position.set(0, spec.y, spec.z); add(crown);
    const brim = new T.Mesh(new T.CylinderGeometry(spec.scaleX * .82, spec.scaleX * .82, .025, 32), material); brim.position.set(0, spec.y - spec.scaleY * .48, spec.z); add(brim);
  } else if (spec.slot === 'eyewear') {
    const frameMaterial = new T.MeshStandardMaterial({ color: spec.primaryColor, roughness: .28, metalness: .45 });
    for (const side of [-1, 1]) { const lens = new T.Mesh(new T.TorusGeometry(.105, .012, 8, 20), frameMaterial); lens.position.set(side * .13, spec.y, .18 + spec.z); add(lens); }
    const bridge = new T.Mesh(new T.BoxGeometry(.08, .012, .012), frameMaterial); bridge.position.set(0, spec.y, .18 + spec.z); add(bridge);
  } else {
    const accessory = new T.Mesh(new T.TorusGeometry(.22, .025, 10, 28), material); accessory.position.set(0, spec.y, .2 + spec.z); accessory.rotation.x = Math.PI / 2; add(accessory);
  }

  const details = Array.isArray(item.detail_layers) ? item.detail_layers.slice(0, 18) : [];
  details.forEach((detail, index) => addDetail(group, detail, index, spec));
  if (spec.distress > .05) {
    const distressMaterial = new T.MeshBasicMaterial({ color: '#151515', transparent: true, opacity: Math.min(.5, .12 + spec.distress * .35), wireframe: true });
    const distress = new T.Mesh(new T.SphereGeometry(Math.max(.3, spec.scaleX * .58), 12, 8), distressMaterial); distress.scale.set(1.15, 1.3, .58); distress.position.set(0, spec.y, spec.z + .04); group.add(distress);
  }
  group.userData.dispose = () => { texture?.dispose(); material.dispose(); };
  return group;
}

export function RichClothingPreview({ appearance, item, variant }: { appearance: PlayerAppearance; item: ClothingItem; variant?: ClothingPreviewVariant }) {
  const canvas = useRef<HTMLCanvasElement>(null), api = useRef<PreviewApi | null>(null), latest = useRef({ appearance, item, variant }); latest.current = { appearance, item, variant };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!canvas.current) return;
    let alive = true, raf = 0, base: T.Group | null = null, garment: T.Group | null = null, library: ModelLibrary | null = null;
    let renderer: T.WebGLRenderer | undefined, environment: T.WebGLRenderTarget | undefined, controls: OrbitControls | undefined, observer: ResizeObserver | undefined;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, 1, .05, 30), element = canvas.current;
    const replace = () => {
      if (!library) return;
      if (base) { scene.remove(base); disposeModel(base); }
      if (garment) { scene.remove(garment); garment.userData.dispose?.(); disposeModel(garment); }
      base = assemblePlayerModel(library, latest.current.appearance); base.position.y = 0; scene.add(base);
      garment = buildGarment(latest.current.item, latest.current.variant); garment.scale.y *= latest.current.appearance.body.height; scene.add(garment);
    };
    try {
      renderer = new T.WebGLRenderer({ canvas: element, antialias: true, powerPreference: 'high-performance' }); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3; renderer.shadowMap.enabled = true;
      scene.background = new T.Color('#101823');
      const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment(); environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
      scene.add(new T.HemisphereLight('#cddaf0', '#202938', 1.4)); const key = new T.SpotLight('#ffe4c7', 38, 14, .72, .8, 1.4); key.position.set(-2.4, 4.3, 4); key.target.position.set(0, 1, 0); key.castShadow = true; scene.add(key, key.target); const rim = new T.DirectionalLight('#66d4ee', 2); rim.position.set(2.5, 3, -2); scene.add(rim);
      const floor = new T.Mesh(new T.CircleGeometry(1.25, 64), new T.MeshStandardMaterial({ color: '#293545', roughness: .65, metalness: .22 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.035; floor.receiveShadow = true; scene.add(floor);
      camera.position.set(2.05, 1.55, 4.65); controls = new OrbitControls(camera, element); controls.target.set(0, .95, 0); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2.1; controls.maxDistance = 6.4; controls.update(); controls.saveState();
      observer = new ResizeObserver(() => { const rect = element.getBoundingClientRect(); renderer!.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer!.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix(); }); observer.observe(element);
      const frame = () => { if (!alive) return; controls?.update(); renderer?.render(scene, camera); raf = requestAnimationFrame(frame); }; raf = requestAnimationFrame(frame);
      void loadModelLibrary((['masculine', 'feminine'] as const).flatMap(frameType => STYLES.map(style => modelFile(frameType, style)))).then(loaded => { if (!alive) { loaded.forEach(disposeModel); return; } library = loaded; replace(); api.current = { rotate: angle => { camera.position.sub(controls!.target).applyAxisAngle(new T.Vector3(0,1,0), angle).add(controls!.target); controls!.update(); }, zoom: factor => { const offset = camera.position.clone().sub(controls!.target); offset.setLength(T.MathUtils.clamp(offset.length() * factor, controls!.minDistance, controls!.maxDistance)); camera.position.copy(controls!.target).add(offset); controls!.update(); }, reset: () => controls!.reset() }; setStatus('ready'); }).catch(() => alive && setStatus('error'));
    } catch { setStatus('error'); }
    return () => { alive = false; cancelAnimationFrame(raf); observer?.disconnect(); controls?.dispose(); if (garment) garment.userData.dispose?.(); disposeModel(scene); library?.forEach(disposeModel); environment?.dispose(); renderer?.dispose(); api.current = null; };
  }, [attempt]);
  useEffect(() => { if (status === 'ready') { try { const event = new CustomEvent('rockmundo-rich-clothing-refresh'); canvas.current?.dispatchEvent(event); } catch {} } }, [appearance, item, variant, status]);
  useEffect(() => {
    if (status !== 'ready') return;
    setAttempt(value => value + 1);
    // Rebuild is deliberate: generated textures/materials are item+variant specific and disposed cleanly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance, item.id, variant?.id]);
  return <div className="player-model-preview">
    <canvas ref={canvas} tabIndex={0} role="img" aria-label={`${item.name} on your avatar. Drag to rotate 360 degrees and scroll to zoom.`} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') api.current?.rotate(event.key === 'ArrowLeft' ? -.25 : .25); }} />
    <div className="player-model-preview__label" aria-hidden="true">ROCKMUNDO <span>RICH GARMENT FITTING ROOM</span></div>
    {status !== 'ready' && <div className="player-model-preview__overlay"><strong>{status === 'error' ? 'Rich garment preview could not load' : 'Building garment preview…'}</strong>{status === 'error' && <button type="button" onClick={() => setAttempt(v => v + 1)}>Retry</button>}</div>}
    <div className="player-model-preview__controls" aria-label="Model camera"><button type="button" onClick={() => api.current?.rotate(-Math.PI / 4)}>↶</button><button type="button" onClick={() => api.current?.rotate(Math.PI / 4)}>↷</button><button type="button" onClick={() => api.current?.zoom(.85)}>＋</button><button type="button" onClick={() => api.current?.zoom(1.15)}>−</button><button type="button" onClick={() => api.current?.reset()}>Full body</button></div>
  </div>;
}
