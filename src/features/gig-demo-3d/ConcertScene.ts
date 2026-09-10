import { stageLightPositions } from './venueProduction';
import { updateVenueAudience } from './venueAudience';
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildVenue, cylinder, rod, matte } from './stage';
import { loadBand, type Musician, type DemoCrowd } from './performers';
import type { CrowdTuningOptions } from '@/features/gig-experience/viewer/engine/CrowdTuning';
import { resolveVenueProfile, stageTransform, type VenueProfile } from './venueProfile';
import type { ConcertOptions, ConcertFrame } from './liveTypes';
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
  private fog = new T.FogExp2('#020307', 0.025);
  private resizeObserver: ResizeObserver;
  private lookAt = new T.Vector3(0, 2.2, -1.9);
  private cameraPos = new T.Vector3();
  private targetPos = new T.Vector3();
  private previewCrowdReaction = 'auto';
  setPreviewCrowdReaction(reaction: string) { this.previewCrowdReaction = reaction; }
  private crowdTuning: Partial<CrowdTuningOptions> = {};
  private renderedAt = 0;
  private playback: ConcertFrame | null = null;
  private effectsEnabled = true;
  private effectsIntensity = 1;
  private confetti: T.Points | null = null;
  private venueProfile: VenueProfile | null = null;
  private distantAudience: T.Group | null = null;
  private sceneKey: CameraShot = 'front';
  private onStats: (stats: DemoStats) => void;
  constructor(private canvas: HTMLCanvasElement, initial: DemoSettings, onStats: (stats: DemoStats) => void, private onState: (state: 'loading' | 'ready' | 'error', message?: string) => void, private options?: ConcertOptions) {
    this.settings = { ...initial }; this.onStats = onStats;
    this.venueProfile = options ? resolveVenueProfile(options.venue) : null;
    if (this.venueProfile) { this.camera.far = Math.max(220, this.venueProfile.roomDepth * 3); this.fog.density = .7 / this.venueProfile.roomDepth; }
    try {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = initial.quality !== 'low'; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.assetsReady = new Promise(resolve => { this.assetManager.onLoad = () => resolve(); });
    this.assetManager.onError = () => { this.assetsFailed = true; };
    const pmrem = new T.PMREMGenerator(this.renderer), room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04); this.scene.environment = this.environment.texture; room.dispose(); pmrem.dispose();
    this.scene.background = new T.Color('#010205'); this.scene.fog = this.fog;
    // Keep house lighting almost entirely off. The audience should read mostly as silhouettes,
    // with the stage spots providing the only meaningful illumination during a performance.
    this.scene.add(new T.HemisphereLight('#526070', '#050406', 0.18));
    const key = new T.DirectionalLight('#f4d5b3', 0.22); key.position.set(0, 5, 6); this.scene.add(key);
    const backFill = new T.DirectionalLight('#5f7390', 0.08); backFill.position.set(0, 5, -7); this.scene.add(backFill);
    buildVenue(this.scene, this.assetManager, options?.venue);
    this.distantAudience = this.scene.getObjectByName('venue-distant-audience') as T.Group ?? null;
    this.buildLighting(); this.particles = this.buildParticles();
    this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.2, 0.4, 1.18); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
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
      const [band] = await Promise.all([loadBand(this.scene, this.assetManager, this.options?.performers, this.options?.venue.seed, this.venueProfile ?? undefined), this.assetsReady]);
      if (this.disposed) { this.disposeScene(); return; }
      if (this.assetsFailed) throw new Error('Missing demo material');
      this.actors = band.actors; if (this.options && !this.options.externalClock) this.actors.forEach(actor => { actor.root.visible = true; }); this.crowd = band.crowd; this.cymbals.push(...band.cymbals); this.loaded = true;
      if (this.hasContext) this.onState('ready');
    } catch (error) {
      cancelAnimationFrame(this.raf); this.raf = 0; this.assetsFailed = true;
      if (!this.disposed) this.onState('error', 'A band model or stage material could not load. Retry to reload the stage assets.');
    }
  }
  private buildLighting() {
    for (let i = 0; i < (this.venueProfile?.production === 'portable' ? 4 : 8); i++) {
      const back = i < 4, x = -4.4 + (i % 4) * 2.95, z = back ? -4.3 : 0.6;
      const light = new T.SpotLight('#ffe0b8', back ? 90 : 72, 16, back ? 0.24 : 0.34, 0.72, 1.55);
      light.position.set(x, 5.7, z); light.target.position.set(x * 0.5, 1, back ? 1.0 : -2.4);
      if (this.venueProfile) {
        const positions=stageLightPositions(this.venueProfile);
        light.position.set(...positions[Math.floor(i*positions.length/(this.venueProfile.production==='portable'?4:8))]);
        light.target.position.set(x/5*this.venueProfile.stageWidth*.35,this.venueProfile.stageHeight+.8,.65-this.venueProfile.stageDepth*(back?.25:.6));
        light.angle=back?.28:.38;
        // Stop the cones shortly beyond the performance area so they do not wash the crowd.
        light.distance = light.position.distanceTo(light.target.position) * 1.35;
        if (this.venueProfile.production === 'portable') rod(this.scene, [light.position.x, 0, light.position.z], light.position.toArray(), .025, matte('#343b43'));
      }
      if (i === 4 || i === 7) { light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.0005; light.shadow.normalBias = 0.035; }
      this.scene.add(light, light.target); this.lights.push(light);
      const fixture = new T.Group(); fixture.position.copy(light.position); fixture.lookAt(light.target.position); if(!this.venueProfile)this.scene.add(fixture);
      if (!this.venueProfile) cylinder(fixture, 0.17, 0.21, 0.34, [0, 0, 0], matte('#10151e')).rotation.x = Math.PI / 2;
      const lens = new T.MeshStandardMaterial({ color: '#f4e9dd', emissive: '#f3dcc8', emissiveIntensity: 2.25 });
      if (!this.venueProfile) cylinder(fixture, 0.145, 0.145, 0.025, [0, 0, 0.19], lens).rotation.x = Math.PI / 2; this.lenses.push(lens);
      if (back) {
        const geometry = new T.CylinderGeometry(0.04, 0.9, 5.6, 28, 1, true); geometry.translate(0, -2.8, 0);
        const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
          uniforms: { color: { value: new T.Color('#1ea2dd') }, opacity: { value: 0.045 } },
          vertexShader: 'varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
          fragmentShader: 'uniform vec3 color; uniform float opacity; varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; void main(){float edge=pow(abs(dot(normalize(vNormal),normalize(vView))),1.4);float lengthFade=pow(vUv.y,1.2);gl_FragColor=vec4(color,opacity*edge*lengthFade);}' });
        const beam = new T.Mesh(geometry, material); beam.position.copy(light.position); this.scene.add(beam); this.beams.push(beam);
      }
    }
    if(this.venueProfile?.production === 'touring' && this.beams[0]) {
      const positions=stageLightPositions(this.venueProfile);
      for(let i=1;i<positions.length;i+=4){
        const source=this.beams[0],beam=new T.Mesh(source.geometry.clone(),(source.material as T.ShaderMaterial).clone());
        beam.position.set(...positions[i]);beam.userData.extraProductionBeam=true;this.scene.add(beam);this.beams.push(beam);
      }
    }
    // Small warm footlights outline the stage without illuminating the room.
    for (let i = 0; i < 8; i++) {
      const mat = new T.MeshStandardMaterial({ color: '#ffd09c', emissive: '#ff8844', emissiveIntensity: 2.2 });
      const point = [-5 + i * 1.42, 0.93, 0.4];
      cylinder(this.scene, 0.075, 0.075, 0.05, this.venueProfile ? stageTransform(this.venueProfile, point) : point, mat, 16);
    }
  }
  private buildParticles() {
    const random = seededRandom(44820), coords = new Float32Array(100 * 3);
    for (let i = 0; i < 100; i++) coords.set([(random() - 0.5) * 12, 1 + random() * 5, -4 + random() * 7], i * 3);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(coords, 3));
    const points = new T.Points(geo, new T.PointsMaterial({ color: '#7d8797', size: 0.012, transparent: true, opacity: 0.16, depthWrite: false })); this.scene.add(points); return points;
  }
  setSettings(next: DemoSettings) {
    const qualityChanged = this.settings.quality !== next.quality;
    this.settings = { ...next };
    const look = LOOKS[next.look];
    this.fog.color.set(new T.Color(look.ambient).multiplyScalar(0.18)); this.scene.fog = next.haze ? this.fog : null;
    this.lights.forEach((light, i) => { const color = i >= 4 ? look.key : i % 2 === 0 ? look.left : look.right; light.color.set(color); this.lenses[i].emissive.set(color); });
    this.beams.forEach((beam, i) => { const mat = beam.material as T.ShaderMaterial; mat.uniforms.color.value.set(i % 2 === 0 ? look.left : look.right); beam.visible = next.haze && this.venueProfile?.production !== 'portable' && (!beam.userData.extraProductionBeam || next.quality !== 'low'); });
    this.scene.traverse(object=>{if(object instanceof T.Mesh){const material=object.material;if(!Array.isArray(material)&&material.name==='production-light-lens')(material as T.MeshStandardMaterial).emissive.set(look.left);}});
    this.particles.visible = next.haze && !next.reducedMotion && this.venueProfile?.production !== 'portable';
    this.bloom.strength = next.quality === 'high' ? 0.26 : 0.16;
    this.renderer.shadowMap.enabled = next.quality !== 'low';
    this.bloom.enabled = next.quality !== 'low';
    if (qualityChanged) this.resize();
    if (next.reducedMotion && this.sceneKey !== 'front') this.sceneKey = 'front';
  }
  setCrowdTuning(tuning: Partial<CrowdTuningOptions>) { this.crowdTuning = tuning; }
  setFrame(frame: ConcertFrame) { this.playback = frame; this.seconds = Math.max(0, frame.positionMs / 1000); }
  setEffects(enabled: boolean, intensity = 1) { this.effectsEnabled = enabled; this.effectsIntensity = T.MathUtils.clamp(intensity, 0, 1); }
  restart() { this.seconds = 0; this.last = 0; }
  private resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, this.settings.quality === 'high' ? 1.75 : this.settings.quality === 'low' ? .9 : 1.15);
    this.renderer.setPixelRatio(ratio); this.renderer.setSize(width, height, false); this.composer?.setPixelRatio(ratio); this.composer?.setSize(width, height);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  private moveCamera(dt: number) {
    const { camera, reducedMotion } = this.settings;
    const sequence: Exclude<CameraShot, 'director'>[] = ['front', 'guitar', 'front', 'drums', 'guitar', 'stage'];
    let selected = camera === 'director' ? reducedMotion ? 'front' : sequence[Math.floor(this.seconds / 16) % sequence.length] : camera;
    const shot = CAMERAS[selected];
    this.cameraPos.fromArray(shot.position); this.targetPos.fromArray(shot.target);
    if (this.options && (selected === 'guitar' || selected === 'drums')) {
      const actor = selected === 'drums' ? this.actors.find(p => p.role === 'drums' && p.root.visible) : this.actors.find(p => p.id === this.playback?.focusId && p.root.visible) ?? this.actors.find(p => p.role === 'guitar' && p.root.visible) ?? this.actors.find(p => p.id === 'preview-1' && p.root.visible);
      if (actor) { this.targetPos.copy(actor.root.position).add(new T.Vector3(0, 1.2, .1)); this.cameraPos.copy(this.targetPos).add(selected === 'drums' ? new T.Vector3(2.4, 1.6, -1.5) : new T.Vector3(-1.8, .45, 3.1)); }
      else { selected = 'front'; this.cameraPos.fromArray(CAMERAS.front.position); this.targetPos.fromArray(CAMERAS.front.target); }
    }
    if (!reducedMotion) { this.cameraPos.x += Math.sin(this.seconds * 0.15) * 0.16; this.cameraPos.y += Math.sin(this.seconds * 0.13) * 0.035; }
    // Keep the complete band in frame when the viewport narrows.
    if (this.venueProfile) {
      const p = this.venueProfile;
      if (selected === 'front') {
        this.targetPos.set(0, p.stageHeight + Math.min(4,(p.rigHeight-p.stageHeight)*.32), .65 - p.stageDepth * .42);
        const distance = Math.max(p.stageDepth + 4, p.stageWidth * .62 / (Math.tan(shot.fov * Math.PI / 360) * this.camera.aspect));
        this.cameraPos.set(.4, Math.max(p.stageHeight + Math.min(9, 2 + p.stageWidth * .14), p.seating && distance > p.crowdDepth ? p.seatRows * .48 + 3.2 : 0), this.targetPos.z + distance);
      }
      if (selected === 'drums') { this.cameraPos.z = Math.max(this.cameraPos.z, .65 - p.stageDepth + .4); this.cameraPos.x = T.MathUtils.clamp(this.cameraPos.x, -p.stageWidth / 2 + .3, p.stageWidth / 2 - .3); }
      if (selected === 'stage') {
        this.cameraPos.set(-p.stageWidth * .32, p.stageHeight + 1.9, .65 - p.stageDepth * .85);
        this.targetPos.set(0, 1.5, Math.min(p.crowdDepth * .55, 20));
      }
    }
    if (!this.options && this.camera.aspect < 1.15 && selected === 'front') this.cameraPos.z += (1.15 - this.camera.aspect) * 8;
    // An external replay uses analytic cuts/dollies: seeking to a timestamp must
    // produce the same camera, including while paused and after a backwards seek.
    const lerp = this.options?.externalClock ? 1 : reducedMotion || this.seconds === 0 ? 1 : 1 - Math.exp(-dt * (selected === this.sceneKey ? 2 : 1.1));
    this.camera.position.lerp(this.cameraPos, lerp); this.lookAt.lerp(this.targetPos, lerp);
    this.camera.fov = T.MathUtils.lerp(this.camera.fov, shot.fov, lerp); this.camera.updateProjectionMatrix(); this.camera.lookAt(this.lookAt); this.sceneKey = selected;
  }
  private frame = (now: number) => {
    if (this.disposed || !this.hasContext || document.hidden) { this.raf = 0; return; }
    if (this.settings.quality === 'low' && now - this.renderedAt < 1000 / 30) { this.raf = requestAnimationFrame(this.frame); return; }
    this.renderedAt = now;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0; this.last = now;
    if (!this.options?.externalClock && this.settings.playing && this.loaded) this.seconds += dt;
    const t = this.settings.reducedMotion ? 0 : this.seconds;
    const energy = this.playback?.energy ?? this.settings.energy;
    this.actors.forEach(actor => {
      const state = this.playback?.performers.find(p => p.id === actor.id);
      if (state) {
        actor.root.visible = state.visible; actor.root.position.set(...state.position); actor.walking = state.walking; actor.action = state.action;
        actor.root.rotation.set(0, 0, 0);
        if (!this.settings.reducedMotion && state.action === 'dance') { actor.root.rotation.y = Math.sin(t * 2) * .24; actor.root.position.y += Math.abs(Math.sin(t * 5)) * .06; }
        if (!this.settings.reducedMotion && /stage_dive|crowd_surf/.test(state.action ?? '')) { const arc = Math.sin(state.actionProgress * Math.PI); actor.root.position.z += arc * 2.3; actor.root.position.y += arc * .55; actor.root.rotation.x = -arc * Math.PI / 2; }
      }
      actor.update(this.playback && !this.playback.performing && !actor.walking ? 0 : t, energy, this.settings.reducedMotion);
    });
    this.crowd?.update(t, this.playback?.crowd ?? this.settings.crowd, energy, this.settings.reducedMotion, this.crowdTuning, this.playback?.crowdReaction ?? (this.previewCrowdReaction === 'auto' ? 'bounce' : this.previewCrowdReaction));
    if (this.distantAudience) {
      const occupancy = this.playback?.occupancy ?? this.settings.crowd;
      updateVenueAudience(this.distantAudience, occupancy, t, this.settings.reducedMotion, energy, Math.round(160 * (this.playback?.crowd ?? this.settings.crowd)));
    }
    this.updateEffects();
    this.lights.forEach((light, i) => {
      light.intensity = (i < 4 ? 90 : 72) * (this.venueProfile?.production === 'portable' ? .4 : this.venueProfile ? Math.pow((this.venueProfile.rigHeight-this.venueProfile.stageHeight)/5.3,1.3) : 1) * (this.playback?.lightLevel ?? 1);
      if (i < 4) { light.target.position.x = ((i - 1.5) * 1.4 + Math.sin(t * 0.35 + i * 1.4) * (this.settings.reducedMotion ? 0 : 1.4)) * (this.venueProfile ? this.venueProfile.stageWidth / 11.6 : 1); const beam = this.beams[i]; const reach=light.position.distanceTo(light.target.position)/5.6;beam.scale.set(Math.max(1,reach*.62),reach,Math.max(1,reach*.62));beam.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), light.target.position.clone().sub(light.position).normalize()); } });
    if(this.venueProfile) this.beams.slice(4).forEach((beam,i)=>{
      const p=this.venueProfile!,target=new T.Vector3(beam.position.x*.6+(this.settings.reducedMotion ? 0 : Math.sin(t*.3+i)*Math.min(3,p.stageWidth*.1)),p.stageHeight,.65-p.stageDepth*.28);
      const reach=beam.position.distanceTo(target)/5.6;beam.scale.set(Math.max(1,reach*.52),reach,Math.max(1,reach*.52));beam.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),target.sub(beam.position).normalize());
    });
    this.cymbals.forEach((object, i) => { object.rotation.z = this.settings.reducedMotion ? 0 : Math.sin(t * 12.56 + i) * 0.012 * this.settings.energy; });
    this.particles.rotation.y = t * 0.008; this.moveCamera(dt);
    this.renderer.info.reset(); this.composer.render();
    this.frames++;
    if (now - this.sampleAt >= 1000) { this.onStats({ fps: this.sampleAt ? Math.round(this.frames * 1000 / (now - this.sampleAt)) : 0, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, seconds: this.seconds }); this.sampleAt = now; this.frames = 0; }
    this.raf = requestAnimationFrame(this.frame);
  };
  private updateEffects() {
    const effect = this.playback?.effect;
    const visible = !!effect && this.effectsEnabled && !this.settings.reducedMotion;
    if (visible && !this.confetti) {
      const random = seededRandom(this.options?.venue.seed ?? 712), positions = new Float32Array(180 * 3), colors = new Float32Array(180 * 3);
      for (let i = 0; i < 180; i++) { positions.set([(random() - .5) * 11, random() * 5, -4 + random() * 4], i * 3); colors.set(new T.Color().setHSL(random(), .8, .6).toArray(), i * 3); }
      const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      this.confetti = new T.Points(geometry, new T.PointsMaterial({ vertexColors: true, size: .045, transparent: true, depthWrite: false })); this.scene.add(this.confetti);
    }
    if (this.confetti) {
      this.confetti.visible = visible && /confetti|special_effect/.test(effect?.type ?? '');
      if (effect) { this.confetti.position.y = 5 - effect.progress * 6; this.confetti.rotation.y = effect.progress * .4; (this.confetti.material as T.PointsMaterial).opacity = Math.sin(effect.progress * Math.PI) * effect.intensity * this.effectsIntensity; }
    }
    this.bloom.strength = (this.settings.quality === 'high' ? .26 : .16) + (visible && effect ? Math.sin(effect.progress * Math.PI) * effect.intensity * this.effectsIntensity * .25 : 0);
  }
  private start() { if (!this.raf && !this.disposed && !this.assetsFailed && this.hasContext && !document.hidden) { this.last = 0; this.raf = requestAnimationFrame(this.frame); } }
  private visibilityChanged = () => { if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; } else this.start(); };
  private contextLost = (event: Event) => { event.preventDefault(); this.hasContext = false; cancelAnimationFrame(this.raf); this.raf = 0; this.onState('error', 'The graphics connection was interrupted. Retry to restore the scene.'); };
  private contextRestored = () => { this.onState('error', 'The graphics connection is restored. Retry to rebuild the stage lighting and materials.'); };
  private disposeScene() {
    this.crowd?.dispose();
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
