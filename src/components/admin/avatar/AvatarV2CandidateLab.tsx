import { useEffect, useMemo, useRef, useState } from 'react';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayerModelPreview } from '@/features/player-model/PlayerModelPreview';
import { AvatarV2ReferenceGallery } from './AvatarV2ReferenceGallery';
import { avatarV2ReferenceModelUrl, type AvatarV2ReferenceVariant } from '@/features/player-model/v2/avatarV2ReferencePreview';
import { Musician } from '@/features/gig-demo-3d/performers';
import { stageAssignment } from '@/features/gig-demo-3d/instrumentCatalog';
import { BODY_MUSCLE_LABELS, BODY_MUSCLE_TYPES, defaultAppearance } from '@/features/player-model/appearance';
import { disposeModel } from '@/features/player-model/model';
import { AvatarV2ExpressionController } from '@/features/player-model/v2/avatarV2Expressions';
import { prepareAvatarV2CandidateModel } from '@/features/player-model/v2/avatarV2Model';
import { applyAvatarV2Compatibility } from '@/features/player-model/v2/avatarV2Compatibility';
import {
  inspectAvatarV2Performance,
  type AvatarV2PerformancePreset,
  type AvatarV2PerformanceQaReport,
} from '@/features/player-model/v2/avatarV2PerformanceQa';
import {
  validateAvatarV2Scene,
  type AvatarV2Frame,
  type AvatarV2Lod,
  type AvatarV2ValidationReport,
} from '@/features/player-model/v2/avatarV2Contract';
import '@/features/player-model/player-model.css';

type CandidateViewPreset = 'full' | 'face' | 'hands' | 'feet';

const CANDIDATE_VIEW = {
  full: { position: [2.05, 1.5, 4.25], target: [0, .92, 0], fov: 32, minDistance: 1.2, maxDistance: 7 },
  face: { position: [0, 1.56, 1.18], target: [0, 1.56, 0], fov: 27, minDistance: .45, maxDistance: 2.2 },
  hands: { position: [0, 1.02, 2.35], target: [0, 1.02, 0], fov: 29, minDistance: .8, maxDistance: 4 },
  feet: { position: [0, .18, 1.35], target: [0, .18, 0], fov: 28, minDistance: .45, maxDistance: 2.6 },
} as const satisfies Record<CandidateViewPreset, {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  minDistance: number;
  maxDistance: number;
}>;

function CandidateCanvas({
  file,
  referenceUrl,
  frame,
  lod,
  onReport,
  onError,
  onPerformanceReport,
  animateFace,
  appearance,
  performancePreset,
  viewPreset,
}: {
  file: File | null;
  referenceUrl: string | null;
  frame: AvatarV2Frame;
  lod: AvatarV2Lod;
  onReport: (report: AvatarV2ValidationReport | null) => void;
  onError: (message: string) => void;
  onPerformanceReport: (report: AvatarV2PerformanceQaReport | null) => void;
  animateFace: boolean;
  appearance: ReturnType<typeof defaultAppearance>;
  performancePreset: AvatarV2PerformancePreset;
  viewPreset: CandidateViewPreset;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;

    let alive = true;
    let raf = 0;
    let model: T.Object3D | null = null;
    let actor: Musician | null = null;
    let equipment: T.Group | null = null;
    let objectUrl: string | null = null;
    let renderer: T.WebGLRenderer | null = null;
    let environment: T.WebGLRenderTarget | null = null;
    let faceController: AvatarV2ExpressionController | null = null;
    const startedAt = performance.now();

    const scene = new T.Scene();
    scene.background = new T.Color('#101823');
    const view = CANDIDATE_VIEW[viewPreset];
    const camera = new T.PerspectiveCamera(view.fov, 1, .05, 30);
    camera.position.set(view.position[0], view.position[1], view.position[2]);

    const controls = new OrbitControls(camera, element);
    controls.target.set(view.target[0], view.target[1], view.target[2]);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = view.minDistance;
    controls.maxDistance = view.maxDistance;

    const render = (now = performance.now()) => {
      if (!alive) return;
      const seconds = (now - startedAt) / 1000;
      if (actor) {
        actor.update(animateFace ? seconds : 0, .78, !animateFace);
      } else if (faceController && animateFace) {
        const opening = .18 + Math.pow(Math.max(0, Math.sin(seconds * 4.2)), 1.35) * .72;
        faceController.update({
          seconds,
          phase: .25,
          vocalActive: true,
          opening,
          energy: .85,
          reducedMotion: false,
        });
      } else {
        faceController?.reset();
      }
      controls.update();
      renderer?.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    try {
      renderer = new T.WebGLRenderer({ canvas: element, antialias: true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const pmrem = new T.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, .04);
      scene.environment = environment.texture;
      room.dispose();
      pmrem.dispose();

      scene.add(new T.HemisphereLight('#d9e5f5', '#283241', 1.7));
      const key = new T.DirectionalLight('#ffe8d2', 3.2);
      key.position.set(-2.5, 4, 3.5);
      key.castShadow = true;
      scene.add(key);
      const rim = new T.DirectionalLight('#68c9f4', 1.7);
      rim.position.set(2.5, 2.8, -2.2);
      scene.add(rim);

      const floor = new T.Mesh(
        new T.CircleGeometry(1.28, 96),
        new T.MeshStandardMaterial({ color: '#222c3b', roughness: .54, metalness: .2 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      const resize = () => {
        const rect = element.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        renderer?.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(element);

      raf = requestAnimationFrame(render);
      onReport(null);
      onError('');
      onPerformanceReport(null);

      if (file || referenceUrl) {
        // Generated source previews are read-only remote assets. Never expose
        // them to the production model library or treat them as validated.
        objectUrl = file ? URL.createObjectURL(file) : null;
        const candidateUrl = objectUrl ?? referenceUrl;
        if (!candidateUrl) throw new Error('Candidate GLB URL is missing.');
        void new GLTFLoader().loadAsync(candidateUrl).then(gltf => {
          if (!alive) {
            disposeModel(gltf.scene);
            return;
          }

          const source = gltf.scene;
          source.updateMatrixWorld(true);
          const report = validateAvatarV2Scene(source, frame, lod);
          onReport(report);

          if (report.valid) {
            const compatibilityQuality = lod === 0 ? 'cinematic' : lod === 1 ? 'high' : lod === 2 ? 'balanced' : 'crowd';
            const prepared = prepareAvatarV2CandidateModel(source, appearance, lod, compatibilityQuality);
            if (prepared.model) {
              applyAvatarV2Compatibility(prepared.model, appearance, [], [], compatibilityQuality);
              const assignment = performancePreset === 'backstage'
                ? stageAssignment(null, 'other')
                : stageAssignment(performancePreset);
              actor = new Musician(
                prepared.model,
                assignment.role,
                [0, 0, 0],
                .25,
                undefined,
                appearance,
                assignment.instrument,
                assignment.vocal,
              );
              disposeModel(prepared.model);
              model = actor.root;
              scene.add(actor.root);
              equipment = actor.equipment;
              if (equipment) scene.add(equipment);
              onPerformanceReport(inspectAvatarV2Performance(actor, performancePreset));
              return;
            }
          }

          // Failed contract candidates still render in A-pose so artists can see
          // what needs fixing; they are never routed through live performance.
          model = source;
          faceController = new AvatarV2ExpressionController(model);
          model.traverse(node => {
            if (!(node instanceof T.Mesh)) return;
            node.castShadow = true;
            node.receiveShadow = true;
            node.frustumCulled = false;
          });

          const bounds = new T.Box3().setFromObject(model);
          const size = bounds.getSize(new T.Vector3());
          if (!Number.isFinite(size.y) || size.y <= .01) throw new Error('Candidate mesh has no measurable height.');
          const scale = 1.78 / size.y;
          model.scale.setScalar(scale);
          model.updateMatrixWorld(true);
          const scaled = new T.Box3().setFromObject(model);
          model.position.y -= scaled.min.y;
          model.updateMatrixWorld(true);
          scene.add(model);
        }).catch(error => {
          if (!alive) return;
          onReport(null);
          onPerformanceReport(null);
          onError(error instanceof Error ? error.message : 'Candidate GLB could not be loaded.');
        });
      }

      return () => {
        alive = false;
        cancelAnimationFrame(raf);
        observer.disconnect();
        controls.dispose();
        if (model) {
          model.removeFromParent();
          disposeModel(model);
        }
        if (equipment) {
          equipment.removeFromParent();
          disposeModel(equipment);
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        disposeModel(floor);
        environment?.dispose();
        renderer?.dispose();
      };
    } catch (error) {
      onError(error instanceof Error ? error.message : 'WebGL candidate preview could not start.');
      controls.dispose();
      renderer?.dispose();
      return () => {
        alive = false;
        cancelAnimationFrame(raf);
      };
    }
  }, [file, referenceUrl, frame, lod, onError, onPerformanceReport, onReport, animateFace, appearance, performancePreset, viewPreset]);

  return (
    <canvas
      ref={canvas}
      className="h-[520px] w-full rounded-lg border bg-slate-950"
      aria-label="Avatar V2 candidate mesh preview"
    />
  );
}

export function AvatarV2CandidateLab() {
  const [frame, setFrame] = useState<AvatarV2Frame>('masculine');
  const [muscle, setMuscle] = useState<(typeof BODY_MUSCLE_TYPES)[number]>('natural');
  const [lod, setLod] = useState<AvatarV2Lod>(0);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState<AvatarV2ReferenceVariant | null>(null);
  const [report, setReport] = useState<AvatarV2ValidationReport | null>(null);
  const [error, setError] = useState('');
  const [animateFace, setAnimateFace] = useState(true);
  const [performance, setPerformance] = useState<AvatarV2PerformancePreset>('vocals');
  const [viewPreset, setViewPreset] = useState<CandidateViewPreset>('full');
  const [faceDetailProof, setFaceDetailProof] = useState(false);
  const [performanceReport, setPerformanceReport] = useState<AvatarV2PerformanceQaReport | null>(null);

  const appearance = useMemo(() => {
    const next = defaultAppearance('avatar-v2-side-by-side');
    next.body.frame = frame;
    next.body.muscle = muscle;
    next.head.hairStyle = 'quiff';
    if (faceDetailProof) {
      next.head.eyebrowStyle = 'arched';
      next.head.eyebrowColor = '#854b32';
      next.head.skinDetail = 'freckles';
    }
    if (next.accessories) {
      next.accessories.glasses = 'square';
      next.accessories.leftEarring = 'hoops';
      next.accessories.rightEarring = 'studs';
    }
    return next;
  }, [frame, muscle, faceDetailProof]);

  const referenceUrl = !file && reference ? avatarV2ReferenceModelUrl(frame, reference) : null;

  const comparisonAssignment = useMemo(
    () => performance === 'backstage' ? stageAssignment(null, 'other') : stageAssignment(performance),
    [performance],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>V1 ↔ V2 candidate lab</CardTitle>
        <CardDescription>
          Inspect real source-only V2 references or load your own GLB locally for side-by-side visual inspection. The lab applies the same saved-hair and
          accessory bridge as the live V2 path, using a quiff, square glasses and independent earrings as
          visible fit checks. Face-detail proof mode additionally checks custom eyebrows and freckles against the V2 head.
          The file stays in this browser session and is not published, uploaded or made
          available to players.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <AvatarV2ReferenceGallery frame={frame} selected={reference}
          onSelectPreview={variant => { setFile(null); setReference(variant); setPerformance('backstage'); setAnimateFace(false); }} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Frame</span>
            <select
              className="block rounded-md border bg-background px-3 py-2"
              value={frame}
              onChange={event => setFrame(event.target.value as AvatarV2Frame)}
            >
              <option value="masculine">Masculine</option>
              <option value="feminine">Feminine</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Muscle definition</span>
            <select
              className="block rounded-md border bg-background px-3 py-2"
              value={muscle}
              onChange={event => setMuscle(event.target.value as typeof muscle)}
            >
              {BODY_MUSCLE_TYPES.map(value => <option key={value} value={value}>{BODY_MUSCLE_LABELS[value]}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Target LOD</span>
            <select
              className="block rounded-md border bg-background px-3 py-2"
              value={lod}
              onChange={event => setLod(Number(event.target.value) as AvatarV2Lod)}
            >
              <option value={0}>LOD0 · close-up</option>
              <option value={1}>LOD1 · performer</option>
              <option value={2}>LOD2 · medium</option>
              <option value={3}>LOD3 · distant</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Candidate GLB</span>
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              className="block max-w-xs rounded-md border bg-background px-3 py-2 text-sm"
              onChange={event => { setFile(event.target.files?.[0] ?? null); setReference(null); }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Performance test</span>
            <select
              className="block rounded-md border bg-background px-3 py-2"
              value={performance}
              onChange={event => setPerformance(event.target.value as typeof performance)}
            >
              <option value="backstage">Backstage / A-pose</option>
              <option value="vocals">Vocals</option>
              <option value="electric_guitar">Electric guitar</option>
              <option value="bass_guitar">Bass guitar</option>
              <option value="rock_drums">Rock drums</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">QA camera</span>
            <select
              className="block rounded-md border bg-background px-3 py-2"
              value={viewPreset}
              onChange={event => setViewPreset(event.target.value as CandidateViewPreset)}
            >
              <option value="full">Full body</option>
              <option value="face">Face close-up</option>
              <option value="hands">Hands / instruments</option>
              <option value="feet">Feet / footwear</option>
            </select>
          </label>
          <Button
            type="button"
            variant={animateFace ? 'default' : 'outline'}
            onClick={() => setAnimateFace(value => !value)}
          >
            {animateFace ? 'Animation on' : 'Animation off'}
          </Button>
          <Button
            type="button"
            variant={faceDetailProof ? 'default' : 'outline'}
            onClick={() => setFaceDetailProof(value => !value)}
          >
            {faceDetailProof ? 'Face detail proof on' : 'Face detail proof off'}
          </Button>
          {(file || reference) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFile(null);
                setReference(null);
                setReport(null);
                setError('');
              }}
            >
              Clear candidate
            </Button>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Current Avatar V1</h3>
              <Badge variant="outline">live fallback</Badge>
            </div>
            <PlayerModelPreview
              appearance={appearance}
              role={comparisonAssignment.role}
              instrument={comparisonAssignment.instrument ?? undefined}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Avatar V2 candidate</h3>
              <Badge variant={report?.valid ? 'default' : 'secondary'}>
                {reference && !file ? 'unrigged reference — not game ready' : file ? report?.valid ? 'contract pass' : report ? 'needs fixes' : 'checking' : 'choose a preview or GLB'}
              </Badge>
            </div>
            <CandidateCanvas
              file={file}
              referenceUrl={referenceUrl}
              frame={frame}
              lod={lod}
              onReport={setReport}
              onError={setError}
              onPerformanceReport={setPerformanceReport}
              animateFace={animateFace}
              appearance={appearance}
              performancePreset={performance}
              viewPreset={viewPreset}
            />
          </div>
        </div>

        {reference && !file && <p className="rounded-md border border-sky-500/30 p-3 text-sm text-muted-foreground">This is the actual {frame} Blender {reference === 'lookdev' ? 'look-development' : 'original CC0'} reference mesh, not a production avatar. It has no fitted skin weights, finished facial morphs or stage animations; A-pose is intentional. The validation gap below must not be interpreted as production certification.</p>}
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {performanceReport && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={performanceReport.valid ? 'default' : 'destructive'}>
                {performanceReport.valid ? 'Performance QA pass' : 'Performance QA needs fixes'}
              </Badge>
              {performanceReport.maxLeftGripError != null && (
                <Badge variant="outline">left hand {(performanceReport.maxLeftGripError * 100).toFixed(1)}cm max drift</Badge>
              )}
              {performanceReport.maxRightGripError != null && (
                <Badge variant="outline">right hand {(performanceReport.maxRightGripError * 100).toFixed(1)}cm max drift</Badge>
              )}
              {performanceReport.maxFingerContactError != null && (
                <Badge variant="outline">finger contact {(performanceReport.maxFingerContactError * 100).toFixed(1)}cm max drift</Badge>
              )}
              {performanceReport.preset === 'vocals' && (
                <>
                  <Badge variant="outline">{performanceReport.activeVocalVisemes}/5 active visemes</Badge>
                  {performanceReport.maxJawWeight != null && (
                    <Badge variant="outline">jaw morph {(performanceReport.maxJawWeight * 100).toFixed(0)}% max</Badge>
                  )}
                  {performanceReport.maxJawBoneMotion != null && (
                    <Badge variant="outline">jaw bone {T.MathUtils.radToDeg(performanceReport.maxJawBoneMotion).toFixed(1)}° max</Badge>
                  )}
                  {performanceReport.maxVocalShapeWeight != null && (
                    <Badge variant="outline">lip shape {(performanceReport.maxVocalShapeWeight * 100).toFixed(0)}% max</Badge>
                  )}
                  {performanceReport.maxExpressiveFaceWeight != null && (
                    <Badge variant="outline">brow/cheek {(performanceReport.maxExpressiveFaceWeight * 100).toFixed(0)}% max</Badge>
                  )}
                </>
              )}
              <Badge variant="outline">{performanceReport.faceMorphs} face morphs</Badge>
              <Badge variant="outline">{performanceReport.eyeBones}/2 eye bones</Badge>
              {performanceReport.maxEyeMotion != null && (
                <Badge variant="outline">eye motion {T.MathUtils.radToDeg(performanceReport.maxEyeMotion).toFixed(1)}°</Badge>
              )}
              <Badge variant="outline">{performanceReport.shoulderBones}/2 shoulder bones</Badge>
              {performanceReport.maxShoulderMotion != null && (
                <Badge variant="outline">shoulder {T.MathUtils.radToDeg(performanceReport.maxShoulderMotion).toFixed(1)}° max</Badge>
              )}
              <Badge variant="outline">{performanceReport.toeBones}/2 toe bones</Badge>
              {performanceReport.maxToeMotion != null && (
                <Badge variant="outline">toe flex {T.MathUtils.radToDeg(performanceReport.maxToeMotion).toFixed(1)}° max</Badge>
              )}
              <Badge variant="outline">{performanceReport.twistBones}/6 twist bones</Badge>
              {performanceReport.maxTwistMotion != null && (
                <Badge variant="outline">twist {T.MathUtils.radToDeg(performanceReport.maxTwistMotion).toFixed(1)}° max</Badge>
              )}
              {performanceReport.preset === 'electric_guitar' && (
                <Badge variant="outline">{performanceReport.guitarPicks}/1 pick</Badge>
              )}
              {performanceReport.preset === 'rock_drums' && (
                <Badge variant="outline">{performanceReport.drumsticks}/2 drumsticks</Badge>
              )}
              {performanceReport.maxDrumstickError != null && (
                <Badge variant="outline">stick/hand {(performanceReport.maxDrumstickError * 100).toFixed(1)}cm max drift</Badge>
              )}
            </div>
            {performanceReport.issues.length === 0 ? (
              <p className="text-sm text-emerald-600">
                The candidate stayed within the automated facial-articulation, hand/grip, eye-gaze, shoulder-girdle, toe/forefoot and limb-twist limits across the sampled performance motion.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {performanceReport.issues.map(issue => (
                  <div key={issue.code} className="rounded-md border p-3 text-sm">
                    <code className="text-xs">{issue.code}</code>
                    <p className="mt-1 text-muted-foreground">{issue.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {report && reference && !file && (
          <div className="rounded-lg border p-4 text-sm" role="status">
            Actual source geometry loaded in the candidate lab. It is intentionally not certified: {report.issues.length} automated production-contract gaps remain. Continue with the artist-fitted rig, real morphs and LOD validation before live rollout.
          </div>
        )}
        {report && (!reference || !!file) && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={report.valid ? 'default' : 'destructive'}>{report.valid ? 'Automated contract passed' : 'Contract failed'}</Badge>
              <Badge variant="outline">{report.triangles.toLocaleString()} tris</Badge>
              <Badge variant="outline">{report.vertices.toLocaleString()} vertices</Badge>
              <Badge variant="outline">{report.bones} bones</Badge>
              <Badge variant="outline">{report.skinnedMeshes} skinned mesh{report.skinnedMeshes === 1 ? '' : 'es'}</Badge>
              <Badge variant="outline">{report.morphTargets.length} morph targets</Badge>
              {lod === 0 && [
                ['iris pair', ['missing-dedicated-surface:iris', 'missing-surface-binding:iris:Eye.L', 'missing-surface-binding:iris:Eye.R']],
                ['sclera pair', ['missing-dedicated-surface:sclera', 'missing-surface-binding:sclera:Eye.L', 'missing-surface-binding:sclera:Eye.R']],
                ['cornea pair', ['missing-dedicated-surface:cornea', 'missing-surface-binding:cornea:Eye.L', 'missing-surface-binding:cornea:Eye.R']],
                ['eyelid wetlines', ['missing-dedicated-surface:wetline', 'missing-wetline-side:L', 'missing-wetline-side:R', 'missing-wetline-blink:L', 'missing-wetline-blink:R', 'invalid-wetline-binding:L', 'invalid-wetline-binding:R']],
                ['eyelashes', ['missing-dedicated-surface:eyelashes', 'missing-eyelashes-side:L', 'missing-eyelashes-side:R', 'missing-eyelashes-blink:L', 'missing-eyelashes-blink:R', 'invalid-eyelashes-binding:L', 'invalid-eyelashes-binding:R', 'misaligned-eyelashes:L', 'misaligned-eyelashes:R']],
                ['lip material', ['missing-head-lip-material']],
                ['natural eyebrows', ['missing-head-eyebrow-material']],
                ['mouth cavity depth', ['shallow-mouth-cavity']],
                ['upper/lower teeth', ['missing-dedicated-surface:teeth', 'missing-surface-binding:teeth:Head', 'missing-surface-binding:teeth:Jaw']],
                ['tongue→Jaw', ['missing-dedicated-surface:tongue', 'missing-surface-binding:tongue:Jaw']],
                ['mouth interior→Head', ['missing-dedicated-surface:mouthInterior', 'missing-surface-binding:mouthInterior:Head']],
              ].map(([label, codes]) => {
                const failed = (codes as string[]).some(code => report.issues.some(issue => issue.code === code));
                return (
                  <Badge key={label as string} variant={failed ? 'destructive' : 'outline'}>
                    {failed ? 'fix ' : '✓ '}{label as string}
                  </Badge>
                );
              })}
            </div>
            {report.issues.length === 0 ? (
              <p className="text-sm text-emerald-600">No automated contract issues. Visual and performance-pose QA is still required.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {report.issues.map(issue => (
                  <div key={issue.code} className="rounded-md border p-3 text-sm">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={issue.level === 'error' ? 'destructive' : 'secondary'}>{issue.level}</Badge>
                      <code className="text-xs">{issue.code}</code>
                    </div>
                    <p className="text-muted-foreground">{issue.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
