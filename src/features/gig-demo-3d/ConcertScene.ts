import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildVenue, buildDrums, microphone, cylinder, matte } from './stage';
import { loadBand, type Musician, type DemoCrowd } from './performers';
import { DEFAULT_SETTINGS, LOOKS, seededRandom, type DemoSettings, type DemoStats, type CameraShot } from './config';

const CAMERAS = {
  front: { position: [0.4, 2.8, 6.7], target: [0, 2.4, -1.9], fov: 42 },
  guitar: { position: [-4, 2.35, 1.2], target: [-2.0, 2.05, -1.5], fov: 49 },
  drums: { position: [3.5, 3.65, -4.45], target: [0.7, 2.15, -2.65], fov: 55 },
  stage: { position: [-3.7, 2.75, -4.1], target: [1.25, 1.65, 6], fov: 58 },
} as const;

export class ConcertScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(42, 1, 0.08, 65);
  private renderer: T.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private settings: DemoSettings = { ...DEFAULT_SETTINGS };
  private actors: Musician[] = [];
  private crowd: DemoCrowd | null = null;
  private lights: T.SpotLight[] = [];
  private beams: T.Mesh[] = [];
  private lenses: T.MeshStandardMaterial[] = [];
  private cymbals: T.Object3D[] = [];
  private particles: T.Points;
  private raf = 0;
  private seconds = 0;
  private last = 0;
  private frames = 0;
  private sampleAt = 0;
  private disposed = false;
  private loaded = false;
  private hasContext = true;
  private assetsFailed = false;
  private assetManager = new T.LoadingManager();
  private assetsReady: Promise<void>;
  private environment: T.WebGLRenderTarget;
  private fog = new T.FogExp2('#0b1020', 0.025);
  private resizeObserver: ResizeObserver;
  private lookAt = new T.Vector3(0, 2.2, -1.9);
  private cameraPos = new T.Vector3();
  private targetPos = new T.Vector3();
  private sceneKey: CameraShot = 'front';
  private onStats: (stats: DemoStats) => void;
  constructor(private canvas: HTMLCanvasElement, initial: DemoSettings, onStats: (stats: DemoStats) => void, private onState: (state: 'loading' | 'ready' | 'error', message?: string) => void) {
    this.settings = { ...initial }; this.onStats = onStats;
    try {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.assetsReady = new Promise(resolve => { this.assetManager.onLoad = () => resolve(); });
    this.assetManager.onError = () => { this.assetsFailed = true; };
    const pmrem = new T.PMREMGenerator(this.renderer), room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04); this.scene.environment = this.environment.texture; room.dispose(); pmrem.dispose();
    this.scene.background = new T.Color('#060a12'); this.scene.fog = this.fog;
    this.scene.add(new T.HemisphereLight('#a5c9e8', '#29212b', 1.15));
    const key = new T.DirectionalLight('#f4d5b3', 1.3); key.position.set(0, 5, 6); this.scene.add(key);
    const backFill = new T.DirectionalLight('#759cc7', 0.6); backFill.position.set(0, 5, -7); this.scene.add(backFill);
    buildVenue(this.scene, this.assetManager); this.cymbals = buildDrums(this.scene); microphone(this.scene, [0, 0.9, -0.43]);
    this.buildLighting(); this.particles = this.buildParticles();
    this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.28, 0.45, 1.12); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.camera.position.set(...CAMERAS.front.position); this.camera.lookAt(this.lookAt);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    canvas.addEventListener('webglcontextlost', this.contextLost); canvas.addEventListener('webglcontextrestored', this.contextRestored);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.resize(); this.setSettings(initial); this.start();
    void this.load();
    } catch (error) { this.destroy(); throw error; }
  }
  private async load() {
    try {
      const [band] = await Promise.all([loadBand(this.scene, this.assetManager), this.assetsReady]);
      if (this.disposed) { this.disposeScene(); return; }
      if (this.assetsFailed) throw new Error('Missing demo material');
      this.actors = band.actors; this.crowd = band.crowd; this.loaded = true;
      if (this.hasContext) this.onState('ready');
    } catch (error) {
      if (!this.disposed) this.onState('error', 'A band model or stage material could not load. Retry the demo to reload its local assets.');
    }
  }
  private buildLighting() {
    for (let i = 0; i < 8; i++) {
      const back = i < 4, x = -4.4 + (i % 4) * 2.95, z = back ? -4.3 : 0.6;
      const light = new T.SpotLight('#ffe0b8', back ? 85 : 65, 20, back ? 0.27 : 0.43, 0.62, 1.3);
      light.position.set(x, 5.7, z); light.target.position.set(x * 0.5, 1, back ? 1.0 : -2.4);
      if (i === 4 || i === 7) { light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.0005; light.shadow.normalBias = 0.035; }
      this.scene.add(light, light.target); this.lights.push(light);
      const fixture = new T.Group(); fixture.position.copy(light.position); fixture.lookAt(light.target.position); this.scene.add(fixture);
      cylinder(fixture, 0.17, 0.21, 0.34, [0, 0, 0], matte('#10151e')).rotation.x = Math.PI / 2;
      const lens = new T.MeshStandardMaterial({ color: '#f4e9dd', emissive: '#f3dcc8', emissiveIntensity: 2.5 });
      cylinder(fixture, 0.145, 0.145, 0.025, [0, 0, 0.19], lens).rotation.x = Math.PI / 2; this.lenses.push(lens);
      if (back) {
        const geometry = new T.CylinderGeometry(0.055, 1.35, 6.6, 28, 1, true); geometry.translate(0, -3.3, 0);
        const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
          uniforms: { color: { value: new T.Color('#1ea2dd') }, opacity: { value: 0.065 } },
          vertexShader: 'varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
          fragmentShader: 'uniform vec3 color; uniform float opacity; varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; void main(){float edge=pow(abs(dot(normalize(vNormal),normalize(vView))),1.4);float lengthFade=pow(vUv.y,1.2);gl_FragColor=vec4(color,opacity*edge*lengthFade);}' });
        const beam = new T.Mesh(geometry, material); beam.position.copy(light.position); this.scene.add(beam); this.beams.push(beam);
      }
    }
    // Small warm footlights outline the stage without rapid flashing.
    for (let i = 0; i < 8; i++) {
      const mat = new T.MeshStandardMaterial({ color: '#ffd09c', emissive: '#ff8844', emissiveIntensity: 3 });
      cylinder(this.scene, 0.075, 0.075, 0.05, [-5 + i * 1.42, 0.93, 0.4], mat, 16);
    }
  }
  private buildParticles() {
    const random = seededRandom(44820), coords = new Float32Array(100 * 3);
    for (let i = 0; i < 100; i++) coords.set([(random() - 0.5) * 12, 1 + random() * 5, -4 + random() * 7], i * 3);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(coords, 3));
    const points = new T.Points(geo, new T.PointsMaterial({ color: '#a9bcd9', size: 0.016, transparent: true, opacity: 0.3, depthWrite: false })); this.scene.add(points); return points;
  }
  setSettings(next: DemoSettings) {
    const qualityChanged = this.settings.quality !== next.quality;
    this.settings = { ...next };
    const look = LOOKS[next.look];
    this.fog.color.set(look.ambient); this.scene.fog = next.haze ? this.fog : null;
    this.lights.forEach((light, i) => { const color = i >= 4 ? look.key : i % 2 === 0 ? look.left : look.right; light.color.set(color); this.lenses[i].emissive.set(color); });
    this.beams.forEach((beam, i) => { const mat = beam.material as T.ShaderMaterial; mat.uniforms.color.value.set(i % 2 === 0 ? look.left : look.right); beam.visible = next.haze; });
    this.particles.visible = next.haze && !next.reducedMotion;
    this.bloom.strength = next.quality === 'high' ? 0.4 : 0.25;
    if (qualityChanged) this.resize();
    if (next.reducedMotion && this.sceneKey !== 'front') this.sceneKey = 'front';
  }
  restart() { this.seconds = 0; this.last = 0; }
  private resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, this.settings.quality === 'high' ? 1.75 : 1.15);
    this.renderer.setPixelRatio(ratio); this.renderer.setSize(width, height, false); this.composer?.setPixelRatio(ratio); this.composer?.setSize(width, height);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  private moveCamera(dt: number) {
    const { camera, reducedMotion } = this.settings;
    const sequence: Exclude<CameraShot, 'director'>[] = ['front', 'guitar', 'front', 'drums', 'guitar', 'stage'];
    const selected = camera === 'director' ? reducedMotion ? 'front' : sequence[Math.floor(this.seconds / 16) % sequence.length] : camera;
    const shot = CAMERAS[selected];
    this.cameraPos.fromArray(shot.position); this.targetPos.fromArray(shot.target);
    if (!reducedMotion) { this.cameraPos.x += Math.sin(this.seconds * 0.15) * 0.16; this.cameraPos.y += Math.sin(this.seconds * 0.13) * 0.035; }
    // Keep the complete band in frame when the viewport narrows.
    if (this.camera.aspect < 1.15 && selected === 'front') this.cameraPos.z += (1.15 - this.camera.aspect) * 8;
    const lerp = reducedMotion || this.seconds === 0 ? 1 : 1 - Math.exp(-dt * (selected === this.sceneKey ? 2 : 1.1));
    this.camera.position.lerp(this.cameraPos, lerp); this.lookAt.lerp(this.targetPos, lerp);
    this.camera.fov = T.MathUtils.lerp(this.camera.fov, shot.fov, lerp); this.camera.updateProjectionMatrix(); this.camera.lookAt(this.lookAt); this.sceneKey = selected;
  }
  private frame = (now: number) => {
    if (this.disposed || !this.hasContext || document.hidden) { this.raf = 0; return; }
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0; this.last = now;
    if (this.settings.playing && this.loaded) this.seconds += dt;
    const t = this.settings.reducedMotion ? 0 : this.seconds;
    this.actors.forEach(actor => actor.update(t, this.settings.energy, this.settings.reducedMotion));
    this.crowd?.update(t, this.settings.crowd, this.settings.energy, this.settings.reducedMotion);
    this.lights.forEach((light, i) => { if (i < 4) { light.target.position.x = (i - 1.5) * 1.4 + Math.sin(t * 0.35 + i * 1.4) * (this.settings.reducedMotion ? 0 : 1.4); const beam = this.beams[i]; beam.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), light.target.position.clone().sub(light.position).normalize()); } });
    this.cymbals.forEach((object, i) => { object.rotation.z = this.settings.reducedMotion ? 0 : Math.sin(t * 12.56 + i) * 0.012 * this.settings.energy; });
    this.particles.rotation.y = t * 0.008; this.moveCamera(dt);
    this.renderer.info.reset(); this.composer.render();
    this.frames++;
    if (now - this.sampleAt >= 1000) { this.onStats({ fps: this.sampleAt ? Math.round(this.frames * 1000 / (now - this.sampleAt)) : 0, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, seconds: this.seconds }); this.sampleAt = now; this.frames = 0; }
    this.raf = requestAnimationFrame(this.frame);
  };
  private start() { if (!this.raf && !this.disposed && this.hasContext && !document.hidden) { this.last = 0; this.raf = requestAnimationFrame(this.frame); } }
  private visibilityChanged = () => { if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; } else this.start(); };
  private contextLost = (event: Event) => { event.preventDefault(); this.hasContext = false; cancelAnimationFrame(this.raf); this.raf = 0; this.onState('error', 'The graphics connection was interrupted. Retry the demo to restore the scene.'); };
  private contextRestored = () => { this.onState('error', 'The graphics connection is restored. Retry to rebuild the stage lighting and materials.'); };
  private disposeScene() {
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
    this.scene.traverse(object => {
      const mesh = object as T.Mesh; if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(mat => { materials.add(mat); Object.values(mat).forEach(value => { if (value instanceof T.Texture) textures.add(value); }); });
      if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
      if (object instanceof T.SpotLight) object.shadow.dispose();
    });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); this.scene.clear();
  }
  destroy() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.resizeObserver?.disconnect(); document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.canvas.removeEventListener('webglcontextlost', this.contextLost); this.canvas.removeEventListener('webglcontextrestored', this.contextRestored);
    this.disposeScene(); this.environment?.dispose(); this.composer?.passes.forEach(pass => pass.dispose()); this.composer?.dispose(); this.renderer?.dispose();
  }
}
