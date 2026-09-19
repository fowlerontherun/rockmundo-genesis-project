import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileAudio2, Loader2, ShieldCheck, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { TotpEpisode, TotpPerformance } from "./api";
import { canonicalise, manifestChecksum } from "./episodeManifest";
import {
  getTotpEpisodePlan,
  saveTotpEpisodePlan,
  type TotpEpisodePlan,
  type TotpPresenterAudioPlan,
  type TotpTrackBroadcastRightsPlan,
} from "./scheduleApi";
import { TOTP_MEDIA_BUCKET, detectTotpUploadMime, totpMediaPublicUrl } from "./totpMedia";
import { supabase } from "@/integrations/supabase/client";
import { logTotpProductionEvent } from "./productionAuditApi";

type RightsDraft = TotpTrackBroadcastRightsPlan;

const EMPTY_RIGHTS: RightsDraft = {
  owner: "",
  licence: "",
  territories: [],
  expires_on: null,
  content_id_allowlisted: false,
  youtube_live_permitted: false,
  status: "pending",
  notes: null,
};

function blankPlan(episodeId: string): TotpEpisodePlan {
  return {
    episode_id: episodeId,
    theme: null,
    opening_link: null,
    closing_link: null,
    segments: [],
    notes: null,
    broadcast_rights: {},
    presenter_audio: {},
  };
}

function currentScriptChecksum(performance: TotpPerformance): string {
  return manifestChecksum(canonicalise(performance.presenter_intro ?? ""));
}

function fileExtension(mime: string): string {
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function audioDurationMs(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      const cleanup = () => {
        audio.removeAttribute("src");
        audio.load();
      };
      audio.onloadedmetadata = () => {
        const duration = Math.round(audio.duration * 1000);
        cleanup();
        if (!Number.isFinite(duration) || duration <= 0) reject(new Error("Could not measure the presenter recording duration."));
        else resolve(duration);
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error("The presenter recording could not be decoded."));
      };
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rightsReady(rights: RightsDraft | undefined): boolean {
  if (!rights || rights.status !== "cleared") return false;
  return Boolean(
    rights.owner.trim()
    && rights.licence.trim()
    && rights.territories.length
    && rights.content_id_allowlisted
    && rights.youtube_live_permitted,
  );
}

function audioReady(asset: TotpPresenterAudioPlan | undefined, performance: TotpPerformance): boolean {
  return Boolean(
    asset
    && asset.audio_url
    && asset.duration_ms > 0
    && asset.sha256
    && asset.version > 0
    && asset.script_checksum === currentScriptChecksum(performance),
  );
}

export function TotpBroadcastContractCard({ episode }: { episode: TotpEpisode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rightsDrafts, setRightsDrafts] = useState<Record<string, RightsDraft>>({});
  const [uploadingPerformance, setUploadingPerformance] = useState<string | null>(null);

  const planQuery = useQuery({
    queryKey: ["totp", "episode-plan", episode.id],
    queryFn: () => getTotpEpisodePlan(episode.id),
  });

  const plan = planQuery.data ?? null;

  const uniquePerformances = useMemo(() => {
    const seen = new Set<string>();
    return [...episode.performances]
      .sort((a, b) => a.running_order - b.running_order)
      .filter((performance) => {
        if (seen.has(performance.song_id)) return false;
        seen.add(performance.song_id);
        return true;
      });
  }, [episode.performances]);

  useEffect(() => {
    if (planQuery.isLoading) return;
    const next: Record<string, RightsDraft> = {};
    for (const performance of uniquePerformances) {
      next[performance.song_id] = {
        ...EMPTY_RIGHTS,
        ...(plan?.broadcast_rights?.[performance.song_id] ?? {}),
        territories: plan?.broadcast_rights?.[performance.song_id]?.territories ?? [],
      };
    }
    setRightsDrafts(next);
  }, [planQuery.isLoading, plan?.broadcast_rights, uniquePerformances]);

  const persistPlan = async (
    update: (current: TotpEpisodePlan) => TotpEpisodePlan,
  ): Promise<TotpEpisodePlan> => {
    const current = (await getTotpEpisodePlan(episode.id)) ?? blankPlan(episode.id);
    const next = update(current);
    return await saveTotpEpisodePlan(episode.id, {
      theme: next.theme,
      opening_link: next.opening_link,
      closing_link: next.closing_link,
      segments: next.segments,
      notes: next.notes,
      broadcast_rights: next.broadcast_rights,
      presenter_audio: next.presenter_audio,
      updated_at: next.updated_at,
    });
  };

  const saveRights = useMutation({
    mutationFn: async () => {
      const clean = Object.fromEntries(
        Object.entries(rightsDrafts).map(([songId, rights]) => [
          songId,
          {
            ...rights,
            owner: rights.owner.trim(),
            licence: rights.licence.trim(),
            territories: rights.territories.map((item) => item.trim().toUpperCase()).filter(Boolean),
            expires_on: rights.expires_on || null,
            notes: rights.notes?.trim() || null,
          },
        ]),
      );
      return await persistPlan((current) => ({ ...current, broadcast_rights: clean }));
    },
    onSuccess: () => {
      toast({ title: "Broadcast rights saved", description: "The episode manifest will now use these explicit clearance records." });
      void logTotpProductionEvent({
        episodeId: episode.id,
        eventKind: "replacement",
        headline: "Broadcast rights contract updated",
        detail: { area: "rights", songs: Object.keys(rightsDrafts) },
      }).then(() => queryClient.invalidateQueries({ queryKey: ["totp", "production-audit", episode.id] }));
      void queryClient.invalidateQueries({ queryKey: ["totp", "episode-plan", episode.id] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "running-sheet"] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not save rights", description: error.message, variant: "destructive" }),
  });

  const uploadPresenter = useMutation({
    mutationFn: async ({ performance, file }: { performance: TotpPerformance; file: File }) => {
      if (!performance.presenter_intro?.trim()) {
        throw new Error("Write the presenter introduction before recording it.");
      }
      if (file.size <= 0) throw new Error("The selected presenter recording is empty.");
      if (file.size > 25 * 1024 * 1024) throw new Error("Presenter recordings must be 25 MB or smaller.");

      const mime = await detectTotpUploadMime(file);
      if (!mime.startsWith("audio/")) throw new Error(`The selected file was detected as ${mime}; choose an audio recording.`);

      const [sha256, durationMs] = await Promise.all([sha256Hex(file), audioDurationMs(file)]);
      const scriptChecksum = currentScriptChecksum(performance);
      const current = (await getTotpEpisodePlan(episode.id)) ?? blankPlan(episode.id);
      const previous = current.presenter_audio?.[performance.performance_id];
      const version = Math.max(1, Number(previous?.version ?? 0) + 1);
      const path = [
        "episodes",
        episode.id,
        "presenter",
        performance.performance_id,
        `v${version}-${scriptChecksum.slice(0, 10)}-${sha256.slice(0, 12)}.${fileExtension(mime)}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage.from(TOTP_MEDIA_BUCKET).upload(path, file, {
        upsert: false,
        contentType: mime,
        cacheControl: "31536000",
      });
      if (uploadError) throw new Error(uploadError.message);

      const asset: TotpPresenterAudioPlan = {
        performance_id: performance.performance_id,
        presenter_key: episode.presenter_key,
        script_text: performance.presenter_intro,
        script_checksum: scriptChecksum,
        audio_url: totpMediaPublicUrl(path),
        duration_ms: durationMs,
        sha256,
        version,
        uploaded_at: new Date().toISOString(),
      };

      return await saveTotpEpisodePlan(episode.id, {
        theme: current.theme,
        opening_link: current.opening_link,
        closing_link: current.closing_link,
        segments: current.segments,
        notes: current.notes,
        broadcast_rights: current.broadcast_rights,
        presenter_audio: {
          ...current.presenter_audio,
          [performance.performance_id]: asset,
        },
        updated_at: current.updated_at,
      });
    },
    onMutate: ({ performance }) => setUploadingPerformance(performance.performance_id),
    onSuccess: (_result, variables) => {
      setUploadingPerformance(null);
      toast({ title: "Presenter recording saved", description: "This exact recording is now versioned against the current script." });
      void logTotpProductionEvent({
        episodeId: episode.id,
        eventKind: "replacement",
        headline: "Presenter recording replaced",
        detail: { area: "presenter_audio", performance_id: variables.performance.performance_id },
      }).then(() => queryClient.invalidateQueries({ queryKey: ["totp", "production-audit", episode.id] }));
      void queryClient.invalidateQueries({ queryKey: ["totp", "episode-plan", episode.id] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "running-sheet"] });
    },
    onError: (error: Error) => {
      setUploadingPerformance(null);
      toast({ title: "Presenter upload failed", description: error.message, variant: "destructive" });
    },
  });

  if (planQuery.isLoading) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading broadcast contract…</CardContent></Card>
    );
  }

  if (planQuery.isError) {
    return (
      <Card><CardContent className="p-6 text-sm text-destructive">{(planQuery.error as Error).message}</CardContent></Card>
    );
  }

  const clearedTracks = uniquePerformances.filter((performance) => rightsReady(rightsDrafts[performance.song_id])).length;
  const recordedLinks = episode.performances.filter((performance) =>
    audioReady(plan?.presenter_audio?.[performance.performance_id], performance),
  ).length;
  const allReady = clearedTracks === uniquePerformances.length
    && recordedLinks === episode.performances.length
    && episode.performances.length > 0;

  return (
    <Card id="totp-broadcast-contract" data-totp-broadcast-contract>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Broadcast contract
            </CardTitle>
            <CardDescription>
              Explicit external music clearance and immutable presenter recordings. Nothing is auto-cleared for YouTube.
            </CardDescription>
          </div>
          <Badge variant={allReady ? "secondary" : "destructive"}>
            {allReady ? "Phase 0 contract ready" : "Contract incomplete"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Track rights</h3>
              <p className="text-xs text-muted-foreground">{clearedTracks}/{uniquePerformances.length} tracks explicitly cleared.</p>
            </div>
            <Button size="sm" onClick={() => saveRights.mutate()} disabled={saveRights.isPending}>
              {saveRights.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save rights
            </Button>
          </div>

          <div className="space-y-3">
            {uniquePerformances.map((performance) => {
              const rights = rightsDrafts[performance.song_id] ?? EMPTY_RIGHTS;
              const ready = rightsReady(rights);
              const update = (patch: Partial<RightsDraft>) =>
                setRightsDrafts((current) => ({
                  ...current,
                  [performance.song_id]: { ...(current[performance.song_id] ?? EMPTY_RIGHTS), ...patch },
                }));

              return (
                <div key={performance.song_id} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{performance.band_name} — {performance.song_title}</p>
                      <p className="text-[11px] text-muted-foreground">Song {performance.song_id}</p>
                    </div>
                    <Badge variant={ready ? "secondary" : "outline"}>
                      {ready ? <><CheckCircle2 className="mr-1 h-3 w-3" /> cleared</> : "not cleared"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Rights owner</Label>
                      <Input value={rights.owner} onChange={(event) => update({ owner: event.target.value })} placeholder="Master owner" />
                    </div>
                    <div>
                      <Label className="text-xs">Licence / agreement</Label>
                      <Input value={rights.licence} onChange={(event) => update({ licence: event.target.value })} placeholder="Agreement or licence reference" />
                    </div>
                    <div>
                      <Label className="text-xs">Territories</Label>
                      <Input
                        value={rights.territories.join(", ")}
                        onChange={(event) => update({ territories: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
                        placeholder="WORLD or GB, US, CA"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Expiry</Label>
                      <Input type="date" value={rights.expires_on ?? ""} onChange={(event) => update({ expires_on: event.target.value || null })} />
                    </div>
                    <div>
                      <Label className="text-xs">Clearance state</Label>
                      <Select value={rights.status} onValueChange={(value) => update({ status: value as RightsDraft["status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="cleared">Cleared</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 pt-5 text-xs">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rights.content_id_allowlisted}
                          onChange={(event) => update({ content_id_allowlisted: event.target.checked })}
                        />
                        Content ID allowlisting confirmed
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rights.youtube_live_permitted}
                          onChange={(event) => update({ youtube_live_permitted: event.target.checked })}
                        />
                        YouTube publishing/live use permitted
                      </label>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Clearance notes</Label>
                      <Textarea
                        rows={2}
                        value={rights.notes ?? ""}
                        onChange={(event) => update({ notes: event.target.value })}
                        placeholder="Contract reference, claimant/Content ID notes, restrictions…"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">Recorded presenter links</h3>
            <p className="text-xs text-muted-foreground">
              {recordedLinks}/{episode.performances.length} current scripts have immutable recordings. Changing a presenter line automatically makes its old recording stale.
            </p>
          </div>

          <div className="space-y-3">
            {[...episode.performances].sort((a, b) => a.running_order - b.running_order).map((performance) => {
              const asset = plan?.presenter_audio?.[performance.performance_id];
              const ready = audioReady(asset, performance);
              const stale = Boolean(asset && !ready);
              return (
                <div key={performance.performance_id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileAudio2 className="h-4 w-4" />
                        <p className="text-sm font-semibold">#{performance.running_order} {performance.band_name}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {performance.presenter_intro?.trim() || "No presenter introduction has been written."}
                      </p>
                      {asset ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          v{asset.version} · {(asset.duration_ms / 1000).toFixed(1)}s · SHA-256 {asset.sha256.slice(0, 12)}…
                        </p>
                      ) : null}
                    </div>
                    <Badge variant={ready ? "secondary" : stale ? "destructive" : "outline"}>
                      {ready ? "recorded" : stale ? "stale recording" : "missing"}
                    </Badge>
                  </div>

                  {asset?.audio_url ? <audio className="mt-3 h-8 w-full" controls preload="none" src={asset.audio_url} /> : null}

                  <label
                    htmlFor={`totp-presenter-${performance.performance_id}`}
                    className="mt-3 flex cursor-pointer items-center justify-center rounded-md border border-dashed px-3 py-3 text-xs hover:bg-muted/40"
                  >
                    {uploadingPerformance === performance.performance_id
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Upload className="mr-2 h-4 w-4" />}
                    {ready ? "Upload a new version" : "Upload recorded presenter line"}
                  </label>
                  <input
                    id={`totp-presenter-${performance.performance_id}`}
                    className="sr-only"
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,.mp3,.wav,.ogg,.webm,.m4a"
                    disabled={uploadingPerformance === performance.performance_id || !performance.presenter_intro?.trim()}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) uploadPresenter.mutate({ performance, file });
                      event.currentTarget.value = "";
                    }}
                  />
                  {stale ? (
                    <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      The presenter script changed after this recording was made. Record the current wording before sign-off.
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

export default TotpBroadcastContractCard;