import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, Cuboid, Gauge, ShieldCheck } from 'lucide-react';
import { AVATAR_V2_BUDGETS } from '@/features/player-model/v2/avatarV2Contract';
import {
  AVATAR_V2_BASE_ASSETS,
  AVATAR_V2_ROLLOUT,
  avatarV2Readiness,
} from '@/features/player-model/v2/avatarV2Registry';

const statusVariant = (status: string): 'default' | 'destructive' | 'secondary' =>
  status === 'validated' ? 'default' : status === 'blocked' ? 'destructive' : 'secondary';

export default function AvatarV2Admin() {
  const readiness = avatarV2Readiness();
  const validated = AVATAR_V2_BASE_ASSETS.filter(asset => asset.status === 'validated').length;
  const progress = Math.round((validated / AVATAR_V2_BASE_ASSETS.length) * 100);

  return (
    <main className="container mx-auto space-y-6 p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">Avatar V2 Mesh System</h1>
          <Badge variant={readiness.productionReady ? 'default' : 'secondary'}>
            {readiness.assetVersion}
          </Badge>
          <Badge variant={AVATAR_V2_ROLLOUT.enabled ? 'default' : 'outline'}>
            Rollout {AVATAR_V2_ROLLOUT.enabled ? 'enabled' : 'locked'}
          </Badge>
        </div>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Replacement high-quality humanoid rig for the Character Designer, Skin Store,
          gigs and Top of the Pops. V1 remains the production fallback until both frames
          and the clothing/tattoo compatibility gates are certified.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Cuboid className="h-4 w-4" /> Base meshes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{validated}/{AVATAR_V2_BASE_ASSETS.length}</div>
            <p className="text-sm text-muted-foreground">Validated LOD assets</p>
            <Progress className="mt-3" value={progress} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Production gate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {readiness.productionReady ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <AlertTriangle className="h-6 w-6 text-amber-500" />}
              <span className="font-semibold">{readiness.productionReady ? 'Base rig ready' : 'Not ready'}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">LOD0 + LOD1 must pass for both body frames.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" /> Safe rollout</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              V2 is already wired behind a fail-closed engine adapter. Missing or invalid
              assets continue rendering Avatar V1 instead of breaking the player.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base asset matrix</CardTitle>
          <CardDescription>Authoring files expected under public/avatar-v2.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Frame</th>
                <th className="py-2 pr-4">LOD</th>
                <th className="py-2 pr-4">Purpose / budget</th>
                <th className="py-2 pr-4">Asset</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {AVATAR_V2_BASE_ASSETS.map(asset => {
                const budget = AVATAR_V2_BUDGETS[asset.lod];
                return (
                  <tr key={asset.file} className="border-b last:border-0">
                    <td className="py-3 pr-4 capitalize">{asset.frame}</td>
                    <td className="py-3 pr-4 font-mono">LOD{asset.lod}</td>
                    <td className="py-3 pr-4">
                      {budget.maxTriangles.toLocaleString()} tris · {budget.targetTextureSize}px textures
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{asset.file}</td>
                    <td className="py-3"><Badge variant={statusVariant(asset.status)}>{asset.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import gate</CardTitle>
          <CardDescription>What must happen before an authored mesh can replace V1.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>1.</strong> Export GLB 2.0 in metres, +Y up, +Z forward, A-pose.</p>
          <p><strong>2.</strong> Include the required humanoid bones and close-up facial morphs.</p>
          <p><strong>3.</strong> Put it at the path listed above and change its manifest state to <code>asset_ready</code>.</p>
          <p><strong>4.</strong> Run <code>npm run validate:avatar-v2</code>. Automated rig, morph, triangle, vertex and bone-budget checks must pass.</p>
          <p><strong>5.</strong> Complete visual QA for singing, guitar, bass, drums, hair/accessories and garment fit before changing state to <code>validated</code>.</p>
          <p><strong>6.</strong> Rollout stays locked until V2 clothing and tattoo projection are compatible; V1 remains the fallback throughout.</p>
        </CardContent>
      </Card>
    </main>
  );
}
