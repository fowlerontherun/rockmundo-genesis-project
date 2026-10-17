import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { demoAssetUrl } from "@/features/gig-demo-3d/assets";
import { GARMENT_UPLOAD_RULES, validateGarmentScene, type GarmentValidationReport } from "@/features/clothing-preview/garmentUploadValidation";

type Frame = "masculine" | "feminine";
const REFERENCE: Record<Frame, string> = { masculine: "casual.glb", feminine: "female-casual.glb" };
const boneCache = new Map<Frame, Set<string>>();

async function referenceBones(frame: Frame) {
  if (boneCache.has(frame)) return boneCache.get(frame)!;
  const gltf = await new GLTFLoader().loadAsync(demoAssetUrl(REFERENCE[frame]));
  const names = new Set<string>();
  gltf.scene.traverse(n => { if (n instanceof T.Bone) names.add(n.name); });
  boneCache.set(frame, names);
  return names;
}

interface Checked { file: File; report: GarmentValidationReport }

export default function GarmentUploadAdmin() {
  const qc = useQueryClient();
  const [itemId, setItemId] = useState("");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Partial<Record<Frame, Checked>>>({});
  const [busy, setBusy] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["garment-upload-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("avatar_clothing_items")
        .select("id,name,wearable_slot,curated_asset_key,curated_asset_status,render_config").order("name").limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const item = items.find(i => i.id === itemId);
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 60);

  const check = async (frame: Frame, file: File | undefined) => {
    if (!file || !item) return;
    if (file.size > GARMENT_UPLOAD_RULES.maxFileBytes) { toast.error("File is over 20 MB"); return; }
    try {
      const gltf = await new GLTFLoader().parseAsync(await file.arrayBuffer(), "");
      const report = validateGarmentScene(gltf.scene, await referenceBones(frame), String(item.wearable_slot || "top"));
      setChecked(c => ({ ...c, [frame]: { file, report } }));
    } catch (e) {
      toast.error(`Couldn't read ${file.name}: ${(e as Error).message}`);
    }
  };

  const publish = async () => {
    if (!item?.curated_asset_key) { toast.error("Item needs an asset key first"); return; }
    const m = checked.masculine, f = checked.feminine;
    if (!m?.report.ok || !f?.report.ok) return;
    setBusy(true);
    try {
      const safe = item.curated_asset_key.replace(/[^a-z0-9._-]/gi, "-");
      const stamp = Date.now();
      const paths: Record<Frame, string> = { masculine: `${safe}/masculine-${stamp}.glb`, feminine: `${safe}/feminine-${stamp}.glb` };
      for (const frame of ["masculine", "feminine"] as Frame[]) {
        const { error } = await supabase.storage.from("curated-garments").upload(paths[frame], checked[frame]!.file, { contentType: "model/gltf-binary" });
        if (error) throw error;
      }
      const { error } = await (supabase as any).rpc("admin_publish_uploaded_garment", {
        p_item_id: item.id, p_masculine_path: paths.masculine, p_feminine_path: paths.feminine,
        p_report: { masculine: m.report, feminine: f.report, uploaded_at: new Date().toISOString() },
      });
      if (error) throw error;
      toast.success(`${item.name} now uses your uploaded model`);
      setChecked({});
      qc.invalidateQueries({ queryKey: ["garment-upload-items"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const uploaded = (item?.render_config as { uploadedAssets?: unknown } | null)?.uploadedAssets;

  return (
    <div className="space-y-3 p-3">
      <h1 className="text-lg font-bold">Garment Upload</h1>
      <Card>
        <CardHeader className="py-2"><CardTitle className="text-sm">Rules</CardTitle></CardHeader>
        <CardContent className="text-[11px] text-muted-foreground space-y-1">
          <p>.glb only, max 20 MB, one file per body frame (masculine + feminine).</p>
          <p>Skin to the reference body armature (casual.glb / female-casual.glb) with exact bone names; delete the body before export.</p>
          <p>Triangles: hat 4k · glasses 3k · top 16k · outerwear 20k · bottom 14k · shoes 8k. Max 4 materials. Bake prints/stripes into textures.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="py-2"><CardTitle className="text-sm">1. Choose item</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Search clothing…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
            {filtered.map(i => (
              <Button key={i.id} size="sm" variant={i.id === itemId ? "default" : "outline"} className="h-7 text-[11px]"
                onClick={() => { setItemId(i.id); setChecked({}); }}>
                {i.name}
              </Button>
            ))}
          </div>
          {item && (
            <div className="flex flex-wrap gap-1 text-[11px]">
              <Badge variant="secondary">{item.wearable_slot}</Badge>
              <Badge variant="outline">{item.curated_asset_key ?? "no asset key"}</Badge>
              <Badge variant={uploaded ? "default" : "outline"}>{uploaded ? "Uses uploaded model" : "Stand-in shape"}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
      {item && (
        <Card>
          <CardHeader className="py-2"><CardTitle className="text-sm">2. Upload and check</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(["masculine", "feminine"] as Frame[]).map(frame => {
              const c = checked[frame];
              return (
                <div key={frame} className="space-y-1">
                  <label className="text-xs font-medium capitalize">{frame} frame</label>
                  <Input type="file" accept=".glb" onChange={e => check(frame, e.target.files?.[0])} />
                  {c && (
                    <div className="text-[11px] space-y-0.5">
                      <Badge variant={c.report.ok ? "default" : "destructive"}>{c.report.ok ? "Passed" : "Failed"}</Badge>
                      <span className="ml-2 text-muted-foreground">{c.report.triangles} tris · {c.report.materials} materials · {c.report.skinnedMeshes} meshes</span>
                      {c.report.errors.map(e => <p key={e} className="text-destructive">✕ {e}</p>)}
                      {c.report.warnings.map(w => <p key={w} className="text-muted-foreground">! {w}</p>)}
                    </div>
                  )}
                </div>
              );
            })}
            <Button disabled={busy || !checked.masculine?.report.ok || !checked.feminine?.report.ok} onClick={publish}>
              {busy ? "Uploading…" : "Publish to game"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
