import { stageLightPositions } from './venueProduction';
import { updateTvStudioMonitors } from './tvStudioProduction';
import { resolveTotpStudioStageGeometry, totpStudioStageCenter } from './totpStudioGeometry';
import { updateVenueAudience } from './venueAudience';
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildVenue, cylinder, rod, matte } from './stage';
import { loadBand, type Musician, type DemoCrowd } from './performers';
import { smoothMotion } from './performanceMotion';
import type { CrowdTuningOptions } from '@/features/gig-experience/viewer/engine/CrowdTuning';
import { resolveVenueProfile, stageTransform, type VenueProfile } from './venueProfile';
import type { ConcertOptions, ConcertFrame } from './liveTypes';
import { DEFAULT_SETTINGS, LOOKS, seededRandom, type DemoSettings, type DemoStats, type CameraShot } from './config';

const CAMERAS = {
  front: { position: [0.4, 2.8, 6.7], target: [0, 2.4, -1.9], fov: 42 },
  guitar: { position: [-4, 2.35, 1.2], target: [-2.0, 2.05, -1.5], fov: 49 },
  drums: { position: [3.5, 3.65, -4.45], target: [0.7, 2.15, -2.65], fov: 55 },
  stage: { position: [-3.7, 2.75, -4.1], target: [1.25, 1.65, 6], fov: 58 },
  tv_presenter_wide: { position: [-5.1, 2.8, 4.8], target: [-3.2, 1.75, -0.4], fov: 46 },
  tv_presenter_close: { position: [-4.25, 2.15, 2.05], target: [-3.2, 1.72, -0.45], fov: 34 },
  tv_crane: { position: [6.8, 6.6, 6.5], target: [0, 1.75, -1.2], fov: 50 },
  tv_overhead: { position: [0, 10.5, 1.8], target: [0, 0.6, -0.9], fov: 48 },
  tv_audience_reverse: { position: [0, 2.15, -3.1], target: [0, 1.55, 7.0], fov: 58 },
  tv_tracking: { position: [-5.8, 2.35, 3.45], target: [0, 1.55, -1.5], fov: 46 },
  tv_low_angle: { position: [0.3, 0.95, 3.65], target: [0, 1.95, -1.6], fov: 46 },
  tv_lead_close: { position: [0.7, 2.05, 3.35], target: [0, 1.63, -1.55], fov: 30 },
  tv_lead_medium: { position: [-1.5, 2.35, 4.25], target: [0, 1.62, -1.55], fov: 39 },
  tv_instrument_left: { position: [-3.0, 1.95, 3.1], target: [-1.45, 1.35, -1.5], fov: 34 },
  tv_drummer_close: { position: [2.15, 2.55, 1.0], target: [0, 1.55, -3.0], fov: 36 },
  tv_push_in: { position: [0, 2.0, 3.95], target: [0, 1.58, -1.55], fov: 35 },
} as const;

const TV_CAMERA_SHOTS = new Set<CameraShot>([
  'tv_presenter_wide', 'tv_presenter_close', 'tv_crane', 'tv_overhead',
  'tv_audience_reverse', 'tv_tracking', 'tv_low_angle', 'tv_lead_close',
  'tv_lead_medium', 'tv_instrument_left', 'tv_drummer_close', 'tv_push_in',
]);

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
  setTelevisionMonitorContent(primary: string | null, secondary: string | null, mode: string) {
    if (!this.options?.television || this.venueProfile?.kind !== 'tv_studio') return;
    updateTvStudioMonitors(this.scene, primary?.trim() || 'TOP OF THE POPS', secondary?.trim() || 'LIVE FROM LONDON', mode);
  }
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
    if (!reducedMotion) {
      const drift = TV_CAMERA_SHOTS.has(selected) ? 0.055 : 0.16;
      this.cameraPos.x += Math.sin(this.seconds * 0.15) * drift;
      this.cameraPos.y += Math.sin(this.seconds * 0.13) * (TV_CAMERA_SHOTS.has(selected) ? 0.018 : 0.035);
      if (selected === 'tv_crane') {
        this.cameraPos.x += Math.sin(this.seconds * 0.28) * 1.25;
        this.cameraPos.z += Math.cos(this.seconds * 0.2) * 0.6;
      } else if (selected === 'tv_tracking') {
        this.cameraPos.x += Math.sin(this.seconds * 0.42) * 1.4;
      }
    }
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
      if (p.kind === 'tv_studio') {
        const sx = p.stageWidth / 12, sz = p.stageDepth / 7.2;
        if (selected === 'tv_presenter_wide' || selected === 'tv_presenter_close') {
          this.cameraPos.x *= sx; this.cameraPos.z *= sz;
          this.targetPos.x *= sx; this.targetPos.z *= sz;
        }
        if (selected === 'tv_crane' || selected === 'tv_tracking' || selected === 'tv_low_angle') {
          this.cameraPos.x *= sx; this.cameraPos.z *= sz;
          this.targetPos.set(0, p.stageHeight + 1.25, .65 - p.stageDepth * .45);
        }
        if (selected === 'tv_overhead') {
          this.cameraPos.set(0, Math.min(p.roofHeight - .35, p.rigHeight + 2.2), p.crowdDepth * .24);
          this.targetPos.set(0, p.stageHeight + .3, .65 - p.stageDepth * .35);
        }
        if (selected === 'tv_audience_reverse') {
          this.cameraPos.set(0, 1.85, .65 - p.stageDepth + .55);
          this.targetPos.set(0, 1.35, Math.min(p.crowdDepth * .62, 8.5));
        }
      }
    }
    if (!this.options && this.camera.aspect < 1.15 && selected === 'front') this.cameraPos.z += (1.15 - this.camera.aspect) * 8;

    if (this.options?.television && this.venueProfile?.kind === 'tv_studio') {
      const stageKey = this.options.television.stageKey ?? 'main_stage';
      const geometry = resolveTotpStudioStageGeometry(stageKey, this.venueProfile);
      const stageX = geometry.centerX;
      const stageZ = geometry.centerZ;

      const stageWideShot = ['front','tv_crane','tv_tracking','tv_low_angle','tv_overhead','tv_audience_reverse'].includes(selected);
      if (stageWideShot && stageKey !== 'main_stage') {
        this.targetPos.x += stageX;
        this.targetPos.z += stageZ;

        // Keep the camera relationship coherent with the active performance zone,
        // but don't drag audience-reverse or overhead cameras fully across the room.
        if (selected === 'front' || selected === 'tv_crane' || selected === 'tv_tracking' || selected === 'tv_low_angle') {
          this.cameraPos.x += stageX * .72;
          this.cameraPos.z += stageZ * .42;
        } else if (selected === 'tv_overhead') {
          this.cameraPos.x += stageX * .45;
          this.cameraPos.z += stageZ * .28;
        }
      }
    }

    if (this.options?.television && (selected === 'tv_presenter_wide' || selected === 'tv_presenter_close')) {
      const presenter = this.scene.getObjectByName(`totp-presenter-${(this.options.television.presenterKey ?? 'alex_rayne').replaceAll('_', '-')}`)
        ?? this.scene.children.find(child => child.name.startsWith('totp-presenter-'));
      if (presenter) {
        const subject = presenter.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 1.18, 0));
        this.targetPos.copy(subject);
        this.cameraPos.copy(subject).add(
          selected === 'tv_presenter_close'
            ? new T.Vector3(.72, .2, 2.35)
            : new T.Vector3(1.9, .65, 4.2),
        );
      }
    }

    if (this.options?.television) {
      const visible = this.actors.filter(actor => actor.root.visible);
      const vocalist = visible.find(actor => actor.hasVocals()) ?? visible.find(actor => actor.role === 'vocals');
      const instrumentPlayers = visible.filter(actor => actor.role === 'guitar' || actor.role === 'bass');
      const drummer = visible.find(actor => actor.role === 'drums');
      const instrumentSubject = instrumentPlayers.length
        ? instrumentPlayers[Math.floor(this.seconds / 8) % instrumentPlayers.length]
        : visible.find(actor => actor.role !== 'drums' && !actor.hasVocals());

      const frameActor = (actor: Musician | undefined, offset: T.Vector3, targetHeight = 1.42) => {
        if (!actor) return false;
        this.targetPos.copy(actor.root.position).add(new T.Vector3(0, targetHeight, .04));
        this.cameraPos.copy(this.targetPos).add(offset);
        return true;
      };

      if (selected === 'tv_lead_close') {
        frameActor(vocalist, new T.Vector3(.72, .28, 2.65), 1.48);
      } else if (selected === 'tv_lead_medium') {
        frameActor(vocalist, new T.Vector3(-1.15, .48, 3.55), 1.38);
      } else if (selected === 'tv_push_in') {
        frameActor(vocalist, new T.Vector3(.2, .34, 3.05), 1.42);
      } else if (selected === 'tv_instrument_left') {
        frameActor(instrumentSubject, new T.Vector3(-1.2, .35, 2.55), 1.18);
      } else if (selected === 'tv_drummer_close') {
        frameActor(drummer, new T.Vector3(1.55, .82, 2.15), 1.18);
      }
    }

    // Television cameras cut between pre-planned positions instead of flying through
    // the stage. Keep every TOTP lens outside a performer safety bubble as a final
    // presentation-only guard against clipping through heads, torsos or instruments.
    if (this.options?.television) {
      const closeShot = ['tv_lead_close','tv_lead_medium','tv_instrument_left','tv_drummer_close','tv_push_in'].includes(selected);
      const minSubjectDistance = selected === 'guitar' || selected === 'drums' || closeShot ? 1.65 : 1.35;
      for (const actor of this.actors) {
        if (!actor.root.visible) continue;
        const centre = actor.root.position.clone().add(new T.Vector3(0, 1.15, 0));
        const away = this.cameraPos.clone().sub(centre);
        if (away.lengthSq() < minSubjectDistance * minSubjectDistance) {
          if (away.lengthSq() < 0.0001) away.copy(this.cameraPos).sub(this.targetPos);
          if (away.lengthSq() < 0.0001) away.set(0, .3, 1);
          this.cameraPos.copy(centre).add(away.normalize().multiplyScalar(minSubjectDistance));
        }
      }
      const sightline = this.cameraPos.clone().sub(this.targetPos);
      const minimumLensDistance = selected === 'tv_presenter_close' ? 2.2 : 2.8;
      if (sightline.length() < minimumLensDistance) {
        if (sightline.lengthSq() < 0.0001) sightline.set(0, .2, 1);
        this.cameraPos.copy(this.targetPos).add(sightline.normalize().multiplyScalar(minimumLensDistance));
      }
    }

    const televisionCut = !!this.options?.television && selected !== this.sceneKey;
    const lerp = televisionCut || this.options?.externalClock ? 1 : reducedMotion || this.seconds === 0 ? 1 : 1 - Math.exp(-dt * (selected === this.sceneKey ? 2 : 1.1));
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
    const section = this.playback?.section ?? 'idle';
    const sectionScale = section === 'intro' ? .72
      : section === 'verse' ? .84
      : section === 'chorus' ? 1.08
      : section === 'breakdown' ? .58
      : section === 'solo' ? 1.02
      : section === 'outro' ? 1.12
      : 1;
    const visibleActors = this.actors.filter(actor => actor.root.visible);
    const singer = visibleActors.find(actor => actor.hasVocals()) ?? visibleActors.find(actor => actor.role === 'vocals');
    const drummer = visibleActors.find(actor => actor.role === 'drums');
    const stringPlayers = visibleActors.filter(actor => actor.role === 'guitar' || actor.role === 'bass');
    const interactionClock = ((t % 24) + 24) % 24;
    const interactionWindow = this.settings.reducedMotion || section === 'breakdown' || section === 'intro' ? 0
      : smoothMotion((interactionClock - 7.5) / .6) * (1 - smoothMotion((interactionClock - 10.5) / .7));
    const fillWindow = this.settings.reducedMotion || section === 'verse' ? 0
      : smoothMotion((interactionClock - 15.2) / .45) * (1 - smoothMotion((interactionClock - 17.5) / .55));

    this.actors.forEach(actor => {
      actor.interactionTarget = null;
      actor.interactionStrength = 0;
      if (actor.root.visible && !actor.walking) {
        if (interactionWindow > 0) {
          if (actor === singer && stringPlayers.length) {
            const featured = stringPlayers[Math.floor(t / 24) % stringPlayers.length];
            actor.interactionTarget = featured.root.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 1.25, 0));
            actor.interactionStrength = interactionWindow;
          } else if (stringPlayers.includes(actor)) {
            const partner = stringPlayers.find(other => other !== actor) ?? singer;
            if (partner) {
              actor.interactionTarget = partner.root.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 1.2, 0));
              actor.interactionStrength = interactionWindow * .78;
            }
          }
        } else if (fillWindow > 0 && drummer && actor !== drummer) {
          actor.interactionTarget = drummer.root.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 1.15, 0));
          actor.interactionStrength = fillWindow * (actor === singer ? .9 : .7);
        } else if (fillWindow > 0 && actor === drummer && singer) {
          actor.interactionTarget = singer.root.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 1.35, 0));
          actor.interactionStrength = fillWindow * .55;
        }
      }
      const state = this.playback?.performers.find(p => p.id === actor.id);
      if (state) {
        const previousPosition = actor.root.position.clone();
        const nextPosition = new T.Vector3(...state.position);
        actor.root.visible = state.visible;
        actor.root.position.copy(nextPosition);
        actor.walking = state.walking;
        actor.action = state.action;
        actor.root.rotation.set(0, 0, 0);

        // When the television blocking moves a performer, turn them into the
        // direction of travel so the existing leg cycle reads as walking rather
        // than a character sliding sideways across the studio floor.
        if (state.walking && !this.settings.reducedMotion) {
          const travel = nextPosition.clone().sub(previousPosition);
          travel.y = 0;
          if (travel.lengthSq() > 0.000001) {
            const targetYaw = Math.atan2(travel.x, travel.z);
            actor.root.rotation.y = T.MathUtils.clamp(targetYaw, -.72, .72);
          }
        }
        if (!this.settings.reducedMotion && state.action === 'dance' && !this.options?.television) {
          actor.root.rotation.y = Math.sin(t * 2) * .24;
          actor.root.position.y += Math.abs(Math.sin(t * 5)) * .06;
        }
        if (!this.settings.reducedMotion && /stage_dive|crowd_surf/.test(state.action ?? '')) { const arc = Math.sin(state.actionProgress * Math.PI); actor.root.position.z += arc * 2.3; actor.root.position.y += arc * .55; actor.root.rotation.x = -arc * Math.PI / 2; }
      }
      actor.restoreEquipmentAnchor();
      actor.performing = this.playback?.performing ?? true;
      const focused = !!this.playback?.focusId && actor.id === this.playback.focusId;
      const soloScale = section === 'solo' ? (focused ? 1.2 : .78) : 1;
      const roleScale = section === 'breakdown' && actor.role === 'drums' ? .82
        : section === 'chorus' && (actor.role === 'vocals' || actor.role === 'guitar') ? 1.05
        : section === 'outro' && actor.role === 'drums' ? 1.08
        : 1;
      const actorEnergy = T.MathUtils.clamp(energy * sectionScale * soloScale * roleScale, 0, 1.25);
      actor.update(this.playback && !this.playback.performing && !actor.walking ? 0 : t, actorEnergy, this.settings.reducedMotion);
    });
    if (this.options?.television?.stageKey) this.crowd?.setTelevisionStage(this.options.television.stageKey);
    this.crowd?.update(t, this.playback?.crowd ?? this.settings.crowd, energy, this.settings.reducedMotion, this.crowdTuning, this.playback?.crowdReaction ?? (this.previewCrowdReaction === 'auto' ? 'bounce' : this.previewCrowdReaction), this.playback?.crowdCueProgress);
    if (this.distantAudience) {
      const occupancy = this.playback?.occupancy ?? this.settings.crowd;
      updateVenueAudience(this.distantAudience, occupancy, t, this.settings.reducedMotion, energy, Math.round(160 * (this.playback?.crowd ?? this.settings.crowd)));
    }
    this.updateTelevisionPresenter(t);
    this.updateTelevisionCrew(t);
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
  private updateTelevisionPresenter(t: number) {
    if (!this.options?.television || this.venueProfile?.kind !== 'tv_studio') return;
    const presenter = this.scene.getObjectByName(`totp-presenter-${(this.options.television.presenterKey ?? 'alex_rayne').replaceAll('_', '-')}`)
      ?? this.scene.children.find(child => child.name.startsWith('totp-presenter-'));
    if (!presenter) return;

    const onCamera = this.settings.camera === 'tv_presenter_wide' || this.settings.camera === 'tv_presenter_close';
    const reduced = this.settings.reducedMotion;
    const energy = onCamera ? 1 : .28;
    const phrase = reduced ? 0 : Math.sin(t * 1.35);
    const emphasis = reduced ? 0 : Math.max(0, Math.sin(t * 2.15));

    presenter.rotation.y = Math.PI * .08 + phrase * .045 * energy;
    presenter.rotation.z = phrase * .012 * energy;
    presenter.position.y = reduced ? 0 : Math.max(0, Math.sin(t * 2.7)) * .012 * energy;

    const leftArm = presenter.getObjectByName('totp-presenter-left-arm');
    const rightArm = presenter.getObjectByName('totp-presenter-right-arm');
    const mic = presenter.getObjectByName('totp-presenter-microphone');

    if (leftArm) {
      leftArm.rotation.z = -.18 - emphasis * .42 * energy;
      leftArm.rotation.y = phrase * .16 * energy;
    }
    if (rightArm) {
      rightArm.rotation.z = .08 + emphasis * .16 * energy;
      rightArm.rotation.y = -phrase * .08 * energy;
    }
    if (mic) {
      mic.rotation.y = -phrase * .04 * energy;
      mic.rotation.z = emphasis * .05 * energy;
    }

    if (onCamera && !reduced) {
      const stageKey = this.options.television.stageKey ?? 'main_stage';
      const [stageX] = totpStudioStageCenter(stageKey, this.venueProfile);
      presenter.rotation.y += T.MathUtils.clamp(stageX / 18, -.22, .22) * emphasis;
    }
  }

  private updateTelevisionCrew(t: number) {
    if (!this.options?.television || this.venueProfile?.kind !== 'tv_studio') return;
    const reduced = this.settings.reducedMotion;
    const stageKey = this.options.television.stageKey ?? 'main_stage';
    const [targetX, targetY, targetZ] = totpStudioStageCenter(stageKey, this.venueProfile);
    const target = new T.Vector3(targetX, targetY, targetZ);

    const panHead = (cameraName: string, phase: number) => {
      const camera = this.scene.getObjectByName(cameraName);
      if (!camera) return;
      const head = camera.children.find(child => child.name.includes('camera-head'));
      if (!head) return;
      const world = camera.getWorldPosition(new T.Vector3());
      const dx = target.x - world.x;
      const dz = target.z - world.z;
      const desired = Math.atan2(-dx, -dz) - camera.rotation.y;
      head.rotation.y = desired + (reduced ? 0 : Math.sin(t * .22 + phase) * .025);
      head.rotation.x = reduced ? 0 : Math.sin(t * .18 + phase) * .012;
    };

    panHead('totp-camera-pedestal-left', 0);
    panHead('totp-camera-pedestal-right', 1.8);
    panHead('totp-camera-handheld', 3.3);

    const handheld = this.scene.getObjectByName('totp-camera-handheld');
    if (handheld) {
      const baseX = this.venueProfile.stageWidth * .24;
      handheld.position.x = baseX + (reduced ? 0 : Math.sin(t * .34) * .12);
      handheld.position.z = 2.4 + (reduced ? 0 : Math.cos(t * .27) * .08);
    }

    const jibHead = this.scene.getObjectByName('totp-camera-jib-head');
    if (jibHead) {
      jibHead.rotation.y = reduced ? 0 : Math.sin(t * .2) * .18;
      jibHead.rotation.x = reduced ? 0 : -.08 + Math.sin(t * .16 + .8) * .05;
      const jibBaseY = Number(jibHead.userData.baseY ?? jibHead.position.y);
      jibHead.userData.baseY = jibBaseY;
      jibHead.position.y = jibBaseY + (!reduced && (this.settings.camera === 'tv_crane' || this.settings.camera === 'front') ? Math.sin(t * .24) * .025 : 0);
    }

    const operators = [
      this.scene.getObjectByName('totp-operator-left'),
      this.scene.getObjectByName('totp-operator-right'),
      this.scene.getObjectByName('totp-operator-handheld'),
    ].filter(Boolean) as T.Object3D[];

    operators.forEach((operator, index) => {
      const world = operator.getWorldPosition(new T.Vector3());
      const dx = target.x - world.x;
      const dz = target.z - world.z;
      const desired = Math.atan2(dx, dz);
      operator.rotation.y = desired + (reduced ? 0 : Math.sin(t * .19 + index) * .025);
      operator.rotation.z = reduced ? 0 : Math.sin(t * .65 + index * 1.7) * .01;
    });
  }

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
