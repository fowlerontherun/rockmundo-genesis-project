import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AvatarV2Frame } from '@/features/player-model/v2/avatarV2Contract';
import {
  avatarV2ReferenceImageUrl,
  avatarV2ReferenceManifestUrl,
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
  const [manifest, setManifest] = useState<AvatarV2ReferenceManifest | null>(null);
  const evidence = manifest?.frames.find(item => item.frame === frame)?.sourceJointSuggestions;

  useEffect(() => {
    const controller = new AbortController();
    setAvailability('loading');
    setManifest(null);
    void fetch(avatarV2ReferenceManifestUrl, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Source gallery HTTP ${response.status}`);
        const raw: unknown = await response.json();
        const validated = parseAvatarV2ReferenceManifest(raw);
        if (!validated) throw new Error('Unverified V2 source gallery manifest');
        setManifest(validated);
        setAvailability('available');
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailability('missing');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    onLandmarks(evidence?.suggestions ?? []);
  }, [evidence, onLandmarks]);

  return (
    <Card className="border-sky-500/30">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>See the actual Avatar V2 work in progress</CardTitle>
          <Badge variant="outline">artist reference only</Badge>
        </div>
        <CardDescription>
          These are real masculine/feminine Blender source meshes and the improved physical
          eye, skin, lip, brow and lash lookdev — not another procedural V1 placeholder.
          The source models are currently unweighted and cannot replace live characters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availability === 'loading' && <p role="status" className="text-sm text-muted-foreground">Checking verified Blender preview publication…</p>}
        {availability === 'missing' && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm space-y-2" role="status">
            <p className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Real preview files have not been published yet.</p>
            <p>
              The current live game has no completed Avatar V2 GLBs. Source-only Blender
              scenes and proof renders are created by a separate workflow; this gallery
              will show both real frames once its verified preview publication succeeds.
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
              source. Preview-only; the new facial material pass is not a finished
              skinned, singing or tattoo-ready game avatar.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
