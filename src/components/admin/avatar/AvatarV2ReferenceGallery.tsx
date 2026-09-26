import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AvatarV2Frame } from '@/features/player-model/v2/avatarV2Contract';
import {
  avatarV2ReferenceImageUrl,
  avatarV2ReferenceManifestUrl,
  avatarV2StarterTeeImageUrl,
  avatarV2StarterTeeModelUrl,
  parseAvatarV2ReferenceManifest,
  type AvatarV2ReferenceVariant,
  type AvatarV2ReferenceView,
  type AvatarV2ReferenceManifest,
  type AvatarV2SourceJointSuggestion,
} from '@/features/player-model/v2/avatarV2ReferencePreview';

const VIEWS: Array<{ key: AvatarV2ReferenceView; title: string }> = [
  { key: 'front', title: 'Front' },
  { key: 'quarter', title: 'Three-quarter' },
  { key: 'side', title: 'Side' },
  { key: 'face', title: 'Face close-up' },
];
const SOURCE_WORKFLOW =
  'https://github.com/fowlerontherun/rockmundo-genesis-project/actions/workflows/avatar-v2-real-source-seeds.yml';

export function AvatarV2ReferenceGallery({
  frame,
  onFrameChange,
  onLandmarks,
  selected,
  onSelectPreview,
}: {
  frame: AvatarV2Frame;
  onFrameChange: (frame: AvatarV2Frame) => void;
  onLandmarks: (landmarks: AvatarV2SourceJointSuggestion[]) => void;
  selected: AvatarV2ReferenceVariant | null;
  onSelectPreview: (variant: AvatarV2ReferenceVariant) => void;
}) {
  const [availability, setAvailability] = useState<'loading' | 'available' | 'missing'>('loading');
  const [view, setView] = useState<AvatarV2ReferenceView>('front');
  const [refresh, setRefresh] = useState(0);
  const [manifest, setManifest] = useState<AvatarV2ReferenceManifest | null>(null);
  const selectedFrame = manifest?.frames.find(item => item.frame === frame);
  const evidence = selectedFrame?.sourceJointSuggestions;
  const motion = selectedFrame?.headMotionEvidence;
  const starterTees = selectedFrame?.starterTees;

  useEffect(() => {
    const controller = new AbortController();
    setAvailability('loading');
    setManifest(null);
    void fetch(avatarV2ReferenceManifestUrl, { signal: controller.signal, cache: 'no-cache' })
      .then(async response => {
        if (!response.ok) throw new Error(`Source gallery HTTP ${response.status}`);
        const raw: unknown = await response.json();
        const validated = parseAvatarV2ReferenceManifest(raw);
        if (!validated) throw new Error('Unverified V2 source gallery manifest');
        if (controller.signal.aborted) return;
        setManifest(validated);
        setAvailability('available');
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailability('missing');
      });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    onLandmarks(evidence?.suggestions ?? []);
  }, [evidence, onLandmarks]);

  return (
    <Card className="border-sky-500/30">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>See the actual Avatar V2 work in progress</CardTitle>
          <Badge variant="outline">artist reference only</Badge>
          {manifest?.frames.every(item => !!item.headMotionEvidence) &&
            <Badge variant="secondary">both real head/eye pose proofs published</Badge>}
          <Button type="button" size="sm" variant="outline" disabled={availability === 'loading'}
            onClick={() => setRefresh(value => value + 1)}>
            Refresh published proofs
          </Button>
        </div>
        <CardDescription>
          These are real masculine/feminine Blender source meshes and the improved physical
          eye, skin, lip, brow and lash lookdev — not another procedural V1 placeholder.
          The original source models remain unweighted. A separate experimental head/eye rig
          can demonstrate early deformation, but cannot replace a live character.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availability === 'loading' && <p role="status" className="text-sm text-muted-foreground">Checking verified Blender preview publication…</p>}
        {availability === 'missing' && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm space-y-2" role="status">
            <p className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Verified V2 previews could not be loaded.</p>
            <p>
              Check the gallery connection or press Refresh published proofs. The gallery
              only displays independently verified Blender source files and real head/eye
              experiments; it never substitutes V1 placeholders. The live game still
              has no certified, fully playable V2 assets.
            </p>
            <a className="inline-flex items-center gap-1 underline underline-offset-4"
              href={SOURCE_WORKFLOW} target="_blank" rel="noreferrer">
              Open the real Blender source workflow <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
        {availability === 'available' && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Body frame">
              {(['masculine', 'feminine'] as const).map(option => (
                <Button key={option} type="button" size="sm"
                  variant={frame === option ? 'default' : 'outline'}
                  onClick={() => onFrameChange(option)}>
                  {option === 'masculine' ? 'Masculine body' : 'Feminine body'}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Preview camera">
              {VIEWS.map(item => (
                <Button key={item.key} type="button" size="sm"
                  variant={view === item.key ? 'default' : 'outline'}
                  onClick={() => setView(item.key)}>{item.title}</Button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(['source', 'lookdev'] as const).map(variant => (
                <div key={variant} className="space-y-3 rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">
                      {variant === 'source' ? 'Original CC0 sculpt' : 'Improved V2 face and material lookdev'}
                    </h4>
                    <Badge variant="secondary">{frame}</Badge>
                  </div>
                  <img
                    key={`${frame}-${variant}-${view}`}
                    src={avatarV2ReferenceImageUrl(frame, variant, view)}
                    alt={`${frame} ${variant === 'source' ? 'original source mesh' : 'improved Blender lookdev'} ${view} proof render`}
                    loading="lazy"
                    className="w-full rounded-lg border bg-slate-950 object-contain aspect-square"
                  />
                  <Button type="button" variant={selected === variant ? 'default' : 'outline'}
                    onClick={() => onSelectPreview(variant)}>
                    {selected === variant ? 'Showing in 3D viewer' : 'Inspect actual mesh in 3D'}
                  </Button>
                </div>
              ))}
            </div>
            {motion && (
              <div className="rounded-xl border border-teal-400/40 bg-teal-950/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">Actual skinned head/eye deformation proof</h4>
                  <Badge variant="outline">Experimental · NOT production</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <img
                      key={`${frame}-motion-${view}`}
                      src={avatarV2ReferenceImageUrl(frame, 'headMotion', view)}
                      alt={`${frame} original Blender source experimentally skinned and posed ${view} proof`}
                      loading="lazy"
                      className="w-full rounded-lg border bg-slate-950 object-contain aspect-square"
                    />
                  </div>
                  <div className="space-y-3 text-sm">
                    <p>Both real CC0 eye spheres have measured bone pivots. A provisional
                      Head/Neck blend moves the source face without moving the tested torso region.
                      Finger, shoulder, mouth and garment weights still need artistic work.</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Head: {motion.headMeanDisplacementMm.toFixed(1)} mm</Badge>
                      <Badge variant="secondary">Stable torso: {motion.torsoMeanDisplacementMm.toFixed(2)} mm</Badge>
                      <Badge variant="secondary">{motion.gltfJointCount} guide joints exported</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      These are preliminary automated weights with an unfitted head pivot. 
                      This file must not be used for performance testing or live characters.
                    </p>
                    <Button type="button" variant={selected === 'headMotion' ? 'default' : 'outline'}
                      onClick={() => onSelectPreview('headMotion')}>
                      {selected === 'headMotion' ? 'Viewing experimental rig in 3D' : 'Inspect skinned experiment in 3D'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {starterTees && (
              <div className="space-y-3 rounded-xl border border-indigo-500/40 bg-indigo-950/15 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">Actual existing Starter Wardrobe tee upgrade proofs</h4>
                  <Badge variant="outline">4 original catalogue keys · unapproved sculpt fit</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Four genuinely source-conforming shirt shells are extracted from each real
                  CC0 body's connected chest and upper-arm geometry. The original Rockmundo
                  image is mapped to curved chest triangles, not a floating graphic plane.
                  No new store products are created and none is a validated V2 garment.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {starterTees.map(tee => (
                    <div key={tee.style} className="space-y-2 rounded-lg border p-3">
                      <img
                        src={avatarV2StarterTeeImageUrl(frame, tee.style, view === 'quarter' || view === 'side' ? 'quarter' : 'front')}
                        alt={`${frame} authentic existing ${tee.catalogueKey} on source body`}
                        loading="lazy" className="w-full rounded-lg border bg-slate-950 object-contain aspect-square"
                      />
                      <div className="text-sm font-semibold">{tee.style === 'logo-tee' ? 'Rockmundo Logo Tee' :
                        tee.style === 'plain-black-tee' ? 'Plain Black Tee' :
                        tee.style === 'plain-white-tee' ? 'Plain White Tee' : 'Vintage Charcoal Tee'}</div>
                      <p className="break-all text-xs text-muted-foreground">
                        {tee.catalogueKey} · {tee.evidence.sourceSelectedFaces.toLocaleString()} original
                        connected sculpt faces · {tee.evidence.averageOffsetMm.toFixed(1)} mm shell offset
                      </p>
                      <a href={avatarV2StarterTeeModelUrl(frame, tee.style)}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4">
                        Inspect real proof GLB <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cloth pattern refinement, correct UV baking, approved full-body weights,
                  animation collision, skin/tattoo occlusion and real LOD0-3 remain mandatory.
                  Inventory IDs, purchase prices and existing game boosts are untouched.
                </p>
              </div>
            )}
            <div className="space-y-2 rounded-xl border border-sky-500/25 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">Actual source rig landmarks</h4>
                <Badge variant="secondary">{evidence ? '4 measured from source geometry' : 'not yet in preview manifest'}</Badge>
                <Badge variant="outline">unreviewed suggestions</Badge>
              </div>
              {evidence ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    The eye centres come from the real eye-sphere vertices; the ear locations
                    are candidates from the actual lower outer head surface. These four
                    markers are present in the Blender rig guide, but still need an artist
                    to confirm and fit them before any skinning or production use.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {evidence.suggestions.map(item => (
                      <div key={item.bone} className="rounded-lg bg-muted/50 p-3 text-sm">
                        <div className="font-medium">{item.bone}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.sourceSamples.toLocaleString()} source vertices used
                          · measured height {(item.position[2] * 100).toFixed(1)} cm
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Existing model previews remain available. Measured landmarks will appear
                  here when the new verified source-build publication completes.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Genuine Blender Workbench renders and GLBs generated from the pinned CC0
              source. Preview-only; even the optional head/eye deformation proof has
              incomplete full-body weights, facial morphs and artist-fitted joints.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
