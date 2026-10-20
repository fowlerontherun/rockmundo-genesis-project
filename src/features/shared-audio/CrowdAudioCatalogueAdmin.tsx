import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { CrowdAudioManager } from "@/features/shared-audio/CrowdAudioManager";
import { invalidateCuratedCrowdAudioCache } from "@/features/shared-audio/crowdAudioCatalogue";

type Row = {
  id: string;
  name: string;
  storage_path: string;
  category: string;
  crowd_size: string;
  environments: string[];
  intensity: number;
  duration_seconds: number | null;
  loopable: boolean;
  gain_db: number;
  fade_in_ms: number;
  fade_out_ms: number;
  cue_start_seconds: number;
  cue_end_seconds: number | null;
  enabled: boolean;
  rights_confirmed: boolean;
  source_notes: string | null;
};
const db = supabase as unknown as SupabaseClient;
const categories = ["ambient", "applause", "cheer", "encore", "finale", "reaction"];
const sizes = ["small", "medium", "large", "any"];
const environments = ["pub", "club", "indoor", "arena", "festival", "outdoor", "studio", "any"];

/** Admin-only, RLS-protected review of original source rights and mix settings. */
export function CrowdAudioCatalogueAdmin() {
  const { toast } = useToast();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Row | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<CrowdAudioManager | null>(null);
  if (!previewRef.current) previewRef.current = new CrowdAudioManager();
  const sounds = useQuery({
    queryKey: ["crowd-audio", "admin-catalogue"],
    queryFn: async () => {
      const { data, error } = await db.from("crowd_audio_assets").select("*").order("name");
      if (error) throw error;
      return data as Row[];
    },
  });
  const save = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await db.from("crowd_audio_assets").update({
        name: row.name.trim(),
        storage_path: row.storage_path.trim(),
        category: row.category,
        crowd_size: row.crowd_size,
        environments: row.environments,
        intensity: row.intensity,
        duration_seconds: row.duration_seconds,
        loopable: row.loopable,
        gain_db: row.gain_db,
        fade_in_ms: row.fade_in_ms,
        fade_out_ms: row.fade_out_ms,
        cue_start_seconds: row.cue_start_seconds,
        cue_end_seconds: row.cue_end_seconds,
        rights_confirmed: row.rights_confirmed,
        enabled: row.enabled && row.rights_confirmed,
        source_notes: row.source_notes,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCuratedCrowdAudioCache();
      void client.invalidateQueries({ queryKey: ["crowd-audio"] });
      setDraft(null);
      toast({ title: "Crowd asset saved", description: "Playback availability and metadata updated." });
    },
    onError: (error: Error) => toast({ title: "Could not save crowd asset", description: error.message, variant: "destructive" }),
  });

  useEffect(() => () => {
    previewRef.current?.dispose();
    previewRef.current = null;
  }, []);

  const patch = (fields: Partial<Row>) => setDraft((current) => current ? { ...current, ...fields } : null);
  const preview = (row: Row) => {
    const mixer = previewRef.current!;
    mixer.stop();
    if (previewId === row.id) { setPreviewId(null); return; }
    const { data } = supabase.storage.from("crowd-sounds").getPublicUrl(row.storage_path);
    if (!row.storage_path || row.storage_path.includes("..")) return;
    mixer.prime();
    mixer.setCrowdVolume(.6);
    const clip = {
      id: row.id, url: data.publicUrl, loopable: row.loopable,
      gainDb: row.gain_db, fadeInMs: row.fade_in_ms, fadeOutMs: row.fade_out_ms,
      cueStartSeconds: row.cue_start_seconds, cueEndSeconds: row.cue_end_seconds,
      durationSeconds: row.duration_seconds,
    };
    setPreviewId(row.id);
    if (row.loopable) void mixer.setAmbience(clip);
    else void mixer.playReaction(clip, 0);
  };

  return (
    <Card id="crowd-audio-catalogue">
      <CardHeader>
        <CardTitle>Crowd audio catalogue</CardTitle>
        <CardDescription>
          Processed recordings are staged for review. Confirm recording rights and enable each approved clip before either viewer uses it. These controls do not change music or presenter volume.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sounds.isLoading && <p role="status">Loading crowd recordings…</p>}
        {sounds.isError && <p role="alert">Unable to load the crowd audio catalogue. Check migration and admin access.</p>}
        {sounds.data?.length === 0 && <p>No curated recordings yet. Upload files in Crowd Sounds, then add their storage paths to the curated catalogue.</p>}
        {(sounds.data ?? []).map((row) => (
          <div key={row.id} className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong>{row.name}</strong>
                <p className="text-xs text-muted-foreground">
                  {row.category} · {row.crowd_size} · {row.environments.join(", ")} · {row.rights_confirmed ? (row.enabled ? "Live" : "Approved, disabled") : "Awaiting rights confirmation"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" type="button" variant="outline" onClick={() => preview(row)}>
                  {previewId === row.id ? "Stop preview" : "Preview"}
                </Button>
                <Button size="sm" type="button" variant="outline" onClick={() => { previewRef.current?.stop(); setPreviewId(null); setDraft({ ...row }); }}>
                  Edit
                </Button>
              </div>
            </div>
          </div>
        ))}
        {draft && (
          <form className="space-y-3 rounded-md border p-4" onSubmit={(event) => { event.preventDefault(); save.mutate(draft); }}>
            <h3 className="font-semibold">Edit {draft.name}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="crowd-name">Name</Label><Input id="crowd-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="crowd-path">Storage path (crowd-sounds bucket)</Label><Input id="crowd-path" value={draft.storage_path} onChange={(e) => patch({ storage_path: e.target.value })} /></div>
              <div className="space-y-1"><Label>Category</Label><Select value={draft.category} onValueChange={(category) => patch({ category })}><SelectTrigger aria-label="Crowd category"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Crowd size</Label><Select value={draft.crowd_size} onValueChange={(crowd_size) => patch({ crowd_size })}><SelectTrigger aria-label="Crowd size"><SelectValue /></SelectTrigger><SelectContent>{sizes.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Environments</Label><div className="flex flex-wrap gap-2">{environments.map((environment) => <label key={environment} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.environments.includes(environment)} onChange={(e) => patch({ environments: e.target.checked ? [...draft.environments.filter((env) => environment === "any" ? false : env !== "any"), environment] : draft.environments.filter((env) => env !== environment) })} />{environment}</label>)}</div></div>
              <div className="space-y-1"><Label htmlFor="crowd-intensity">Intensity (1–5)</Label><Input id="crowd-intensity" type="number" min={1} max={5} value={draft.intensity} onChange={(e) => patch({ intensity: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label htmlFor="crowd-gain">Gain (dB)</Label><Input id="crowd-gain" type="number" min={-60} max={6} step={0.5} value={draft.gain_db} onChange={(e) => patch({ gain_db: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label htmlFor="crowd-duration">Duration (seconds)</Label><Input id="crowd-duration" type="number" min={0.01} step={0.01} value={draft.duration_seconds ?? ""} onChange={(e) => patch({ duration_seconds: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label htmlFor="crowd-fade-in">Fade in (ms)</Label><Input id="crowd-fade-in" type="number" min={0} max={10000} value={draft.fade_in_ms} onChange={(e) => patch({ fade_in_ms: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label htmlFor="crowd-fade-out">Fade out (ms)</Label><Input id="crowd-fade-out" type="number" min={0} max={10000} value={draft.fade_out_ms} onChange={(e) => patch({ fade_out_ms: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label htmlFor="crowd-cue-start">Cue start (seconds)</Label><Input id="crowd-cue-start" type="number" min={0} step={0.01} value={draft.cue_start_seconds} onChange={(e) => patch({ cue_start_seconds: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label htmlFor="crowd-cue-end">Cue end (seconds; blank = file end)</Label><Input id="crowd-cue-end" type="number" min={0} step={0.01} value={draft.cue_end_seconds ?? ""} onChange={(e) => patch({ cue_end_seconds: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="space-y-1 md:col-span-2"><Label htmlFor="crowd-notes">Source and licence notes</Label><Input id="crowd-notes" value={draft.source_notes ?? ""} onChange={(e) => patch({ source_notes: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2"><Switch checked={draft.loopable} onCheckedChange={(loopable) => patch({ loopable })} /> Loop ambient clip</label>
            <label className="flex items-center gap-2"><Switch checked={draft.rights_confirmed} onCheckedChange={(rights_confirmed) => patch({ rights_confirmed, enabled: rights_confirmed && draft.enabled })} /> I have verified usage rights for this recording</label>
            <label className="flex items-center gap-2"><Switch checked={draft.enabled} disabled={!draft.rights_confirmed} onCheckedChange={(enabled) => patch({ enabled })} /> Enable clip in both viewers</label>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending || !draft.environments.length || (draft.enabled && !draft.rights_confirmed)}>Save asset</Button>
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
