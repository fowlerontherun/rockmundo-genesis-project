import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileAudio2,
  Loader2,
  Mic2,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { TotpEpisode } from "./api";
import { canonicalise, manifestChecksum } from "./episodeManifest";
import { buildTotpPresenterDialogue, type TotpPresenterDialogueLine } from "./presenterDialogue";
import {
  getTotpBandNameAudioCatalog,
  saveTotpBandNameAudio,
  type TotpBandNameAudioCatalogRow,
} from "./bandNameAudioApi";
import { getTotpEpisodePlan, saveTotpEpisodePlan, type TotpEpisodePlan, type TotpPresenterAudioPlan } from "./scheduleApi";
import { detectTotpUploadMime, TOTP_MEDIA_BUCKET, TOTP_MEDIA_PATHS, totpMediaPublicUrl } from "./totpMedia";
import { TOTP_CHART_POSITIONS, TOTP_REUSABLE_VOICE_SCRIPT_GUIDE, totpChartPositionScript } from "./chartPositionAudio";
import { totpAudioDurationMs, totpAudioFileExtension, totpAudioSha256 } from "./audioAsset";

const ACCEPTED_AUDIO = "audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,.mp3,.wav,.ogg,.webm,.m4a";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

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

function recordingReady(asset: TotpPresenterAudioPlan | undefined, script: string): boolean {
  if (!asset || !script.trim()) return false;
  return Boolean(
    asset.audio_url
      && asset.duration_ms > 0
      && asset.sha256
      && asset.version > 0
      && asset.script_checksum === manifestChecksum(canonicalise(script)),
  );
}

async function validateAndMeasure(file: File) {
  if (file.size <= 0) throw new Error("The selected recording is empty.");
  if (file.size > MAX_AUDIO_BYTES) throw new Error("Recordings must be 25 MB or smaller.");
  const mime = await detectTotpUploadMime(file);
  if (!mime.startsWith("audio/")) {
    throw new Error(`The selected file was detected as ${mime}; choose an audio recording.`);
  }
  const [sha256, durationMs] = await Promise.all([
    totpAudioSha256(file),
    totpAudioDurationMs(file),
  ]);
  return { mime, sha256, durationMs };
}

function safeCuePath(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "cue";
}

function statusBadge(status: "recorded" | "stale" | "missing") {
  if (status === "recorded") {
    return <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" /> recorded</Badge>;
  }
  if (status === "stale") {
    return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> stale</Badge>;
  }
  return <Badge variant="outline">missing</Badge>;
}

export function TotpAudioStudio({ episode }: { episode: TotpEpisode | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bandSearch, setBandSearch] = useState("");
  const [uploadingCue, setUploadingCue] = useState<string | null>(null);
  const [uploadingBand, setUploadingBand] = useState<string | null>(null);
  const [uploadingRank, setUploadingRank] = useState<number | null>(null);
  const [recordingRank, setRecordingRank] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const presenterKey = episode?.presenter_key ?? "alex_rayne";

  const planQuery = useQuery({
    queryKey: ["totp", "episode-plan", episode?.id ?? "none"],
    queryFn: () => getTotpEpisodePlan(episode!.id),
    enabled: !!episode,
  });

  const bandsQuery = useQuery({
    queryKey: ["totp", "band-name-audio"],
    queryFn: getTotpBandNameAudioCatalog,
  });

  const chartPositionAssets = useQuery({
    queryKey: ["totp", "chart-position-audio", presenterKey],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(TOTP_MEDIA_BUCKET)
        .list(TOTP_MEDIA_PATHS.chartPositionFolder(presenterKey), { limit: 100 });
      if (error) throw new Error(error.message);
      return new Set(
        (data ?? [])
          .map((item) => Number(item.name))
          .filter((rank) => Number.isInteger(rank) && rank >= 1 && rank <= 40),
      );
    },
  });

  const dialogue = useMemo(
    () => (episode ? buildTotpPresenterDialogue(episode) : []),
    [episode],
  );

  const filteredBands = useMemo(() => {
    const needle = bandSearch.trim().toLowerCase();
    const rows = bandsQuery.data ?? [];
    if (!needle) return rows;
    return rows.filter((row) => row.band_name.toLowerCase().includes(needle));
  }, [bandSearch, bandsQuery.data]);

  const currentDialogueCount = dialogue.filter((line) =>
    recordingReady(planQuery.data?.presenter_audio?.[line.planKey], line.script),
  ).length;
  const bandRecordedCount = (bandsQuery.data ?? []).filter((row) => row.status === "recorded").length;
  const bandNeedsAudioCount = (bandsQuery.data ?? []).length - bandRecordedCount;

  const presenterUpload = useMutation({
    mutationFn: async ({ line, file }: { line: TotpPresenterDialogueLine; file: File }) => {
      if (!episode) throw new Error("No Top of the Pops episode is scheduled.");
      if (!line.script.trim()) throw new Error("This presenter cue has no dialogue to record yet.");

      const { mime, sha256, durationMs } = await validateAndMeasure(file);
      const current = (await getTotpEpisodePlan(episode.id)) ?? blankPlan(episode.id);
      const previous = current.presenter_audio?.[line.planKey];
      const version = Math.max(1, Number(previous?.version ?? 0) + 1);
      const scriptChecksum = manifestChecksum(canonicalise(line.script));
      const path = [
        "episodes",
        episode.id,
        "presenter-dialogue",
        safeCuePath(line.id),
        `v${version}-${scriptChecksum.slice(0, 10)}-${sha256.slice(0, 12)}.${totpAudioFileExtension(mime)}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage.from(TOTP_MEDIA_BUCKET).upload(path, file, {
        upsert: false,
        contentType: mime,
        cacheControl: "31536000",
      });
      if (uploadError) throw new Error(uploadError.message);

      const asset: TotpPresenterAudioPlan = {
        cue_id: line.id,
        kind: line.kind,
        performance_id: line.performanceId,
        presenter_key: episode.presenter_key,
        script_text: line.script,
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
          [line.planKey]: asset,
        },
        updated_at: current.updated_at,
      });
    },
    onMutate: ({ line }) => setUploadingCue(line.id),
    onSuccess: () => {
      setUploadingCue(null);
      toast({
        title: "Presenter recording saved",
        description: "The take is versioned against the exact dialogue currently displayed.",
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "episode-plan"] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "running-sheet"] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "manifest"] });
    },
    onError: (error: Error) => {
      setUploadingCue(null);
      toast({ title: "Presenter upload failed", description: error.message, variant: "destructive" });
    },
  });

  const bandUpload = useMutation({
    mutationFn: async ({ band, file }: { band: TotpBandNameAudioCatalogRow; file: File }) => {
      const { mime, sha256, durationMs } = await validateAndMeasure(file);
      const nextVersion = Math.max(1, Number(band.version ?? 0) + 1);
      const path = [
        "band-names",
        band.band_id,
        `v${nextVersion}-${sha256.slice(0, 16)}.${totpAudioFileExtension(mime)}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage.from(TOTP_MEDIA_BUCKET).upload(path, file, {
        upsert: false,
        contentType: mime,
        cacheControl: "31536000",
      });
      if (uploadError) throw new Error(uploadError.message);

      return await saveTotpBandNameAudio({
        bandId: band.band_id,
        audioUrl: totpMediaPublicUrl(path),
        storagePath: path,
        durationMs,
        sha256,
      });
    },
    onMutate: ({ band }) => setUploadingBand(band.band_id),
    onSuccess: (saved) => {
      setUploadingBand(null);
      toast({
        title: "Band-name audio saved",
        description: `${saved.band_name} is now recorded for presenter use.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "band-name-audio"] });
    },
    onError: (error: Error) => {
      setUploadingBand(null);
      toast({ title: "Band-name upload failed", description: error.message, variant: "destructive" });
    },
  });


  const chartPositionUpload = useMutation({
    mutationFn: async ({ rank, file }: { rank: number; file: File }) => {
      const { mime } = await validateAndMeasure(file);
      const path = TOTP_MEDIA_PATHS.chartPosition(presenterKey, rank);
      const { error } = await supabase.storage.from(TOTP_MEDIA_BUCKET).upload(path, file, {
        upsert: true,
        contentType: mime,
        cacheControl: "3600",
      });
      if (error) throw new Error(error.message);
      return rank;
    },
    onMutate: ({ rank }) => setUploadingRank(rank),
    onSuccess: (rank) => {
      setUploadingRank(null);
      toast({
        title: `Chart position ${rank} saved`,
        description: `“${totpChartPositionScript(rank)}” is now available for the presenter voice library.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "chart-position-audio", presenterKey] });
    },
    onError: (error: Error) => {
      setUploadingRank(null);
      toast({ title: "Chart position upload failed", description: error.message, variant: "destructive" });
    },
  });

  const stopChartPositionRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const startChartPositionRecording = async (rank: number) => {
    if (recordingRank !== null) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({
        title: "Microphone recording unavailable",
        description: "This browser cannot record directly. You can still upload an MP3, WAV, OGG, WebM or M4A file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setRecordingRank(rank);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setRecordingRank(null);
        toast({ title: "Recording failed", description: "The browser could not capture that take.", variant: "destructive" });
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: finalMime });
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setRecordingRank(null);
        if (blob.size > 0) {
          const extension = finalMime.includes("ogg") ? "ogg" : "webm";
          chartPositionUpload.mutate({
            rank,
            file: new File([blob], `totp-chart-position-${rank}.${extension}`, { type: finalMime }),
          });
        }
      };

      recorder.start();
    } catch (error) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      recordingChunksRef.current = [];
      setRecordingRank(null);
      toast({
        title: "Microphone access failed",
        description: error instanceof Error ? error.message : "Allow microphone access and try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card id="totp-audio-studio">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic2 className="h-5 w-5" /> Presenter audio studio
            </CardTitle>
            <CardDescription>
              Record against the exact on-air wording, then maintain a reusable pronunciation clip for every band name.
              Audio is immutable and versioned; script or band-name changes are shown as stale instead of silently reusing an old take.
            </CardDescription>
          </div>
          {episode ? (
            <Badge variant={currentDialogueCount === dialogue.length && dialogue.length > 0 ? "secondary" : "outline"}>
              {currentDialogueCount}/{dialogue.length} episode lines current
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">Full episode dialogue</h3>
            <p className="text-xs text-muted-foreground">
              This is the complete presenter recording sheet in programme order: opening, act links, between-act continuity,
              the UK chart line and closing. The full text is intentionally visible while you record.
            </p>
          </div>

          {!episode ? (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Schedule a Top of the Pops episode to generate its full presenter script. The band-name library below remains available at all times.
            </div>
          ) : planQuery.isLoading ? (
            <div className="rounded-lg border p-5 text-sm text-muted-foreground">Loading presenter recordings…</div>
          ) : planQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 p-5 text-sm text-destructive">
              {(planQuery.error as Error).message}
            </div>
          ) : dialogue.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Lock acts into the running order to generate the presenter dialogue.
            </div>
          ) : (
            <div className="space-y-3">
              {dialogue.map((line, index) => {
                const asset = planQuery.data?.presenter_audio?.[line.planKey];
                const ready = recordingReady(asset, line.script);
                const stale = Boolean(asset && !ready);
                const status = ready ? "recorded" : stale ? "stale" : "missing";
                const disabled = !line.script.trim() || uploadingCue === line.id;

                return (
                  <div key={line.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold tabular-nums text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-semibold">{line.label}</span>
                          <Badge variant="outline">{line.kind.replaceAll("_", " ")}</Badge>
                        </div>
                        <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm leading-6">
                          {line.script || <span className="text-destructive">No presenter dialogue has been written for this cue.</span>}
                        </div>
                        {asset ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            v{asset.version} · {(asset.duration_ms / 1000).toFixed(1)}s · SHA-256 {asset.sha256.slice(0, 12)}…
                          </p>
                        ) : null}
                      </div>
                      {statusBadge(status)}
                    </div>

                    {asset?.audio_url ? (
                      <audio className="mt-3 h-8 w-full" controls preload="none" src={asset.audio_url} />
                    ) : null}

                    <label
                      htmlFor={`totp-dialogue-${safeCuePath(line.id)}`}
                      className={`mt-3 flex items-center justify-center rounded-md border border-dashed px-3 py-3 text-xs ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/40"}`}
                    >
                      {uploadingCue === line.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Upload className="mr-2 h-4 w-4" />}
                      {ready ? "Upload a new take" : stale ? "Record current wording" : "Upload recorded dialogue"}
                    </label>
                    <input
                      id={`totp-dialogue-${safeCuePath(line.id)}`}
                      className="sr-only"
                      type="file"
                      accept={ACCEPTED_AUDIO}
                      disabled={disabled}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) presenterUpload.mutate({ line, file });
                        event.currentTarget.value = "";
                      }}
                    />

                    {stale ? (
                      <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        The displayed dialogue changed after this take was recorded. Upload a new take before production sign-off.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>


        <section id="chart-position-audio" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Mic2 className="h-4 w-4" /> Chart position voice library
              </h3>
              <p className="text-xs text-muted-foreground">
                Record the forty reusable chart-position phrases once for this presenter. Use a clean, neutral delivery so the clips can be joined to artist and song audio in any episode.
              </p>
            </div>
            <Badge variant={chartPositionAssets.data?.size === 40 ? "secondary" : "outline"}>
              {chartPositionAssets.data?.size ?? 0}/40 positions recorded
            </Badge>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <h4 className="text-sm font-semibold">Supporting presenter lines</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              These are the other reusable chart phrases worth recording. The main chart introduction is already supported by the episode audio sheet; the remaining cues are recommended building blocks for richer chart narration.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {TOTP_REUSABLE_VOICE_SCRIPT_GUIDE.map((line) => (
                <div key={line.id} className="rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold">{line.label}</span>
                    <Badge variant="outline">{line.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6">“{line.script}”</p>
                </div>
              ))}
            </div>
          </div>

          {chartPositionAssets.isError ? (
            <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
              {(chartPositionAssets.error as Error).message}
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {TOTP_CHART_POSITIONS.map((rank) => {
                const exists = chartPositionAssets.data?.has(rank) ?? false;
                const isRecording = recordingRank === rank;
                const isBusy = uploadingRank === rank;
                const audioUrl = totpMediaPublicUrl(TOTP_MEDIA_PATHS.chartPosition(presenterKey, rank));
                return (
                  <div key={rank} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black tabular-nums">#{rank}</span>
                          {exists ? statusBadge("recorded") : statusBadge("missing")}
                        </div>
                        <p className="mt-2 text-sm font-medium">“{totpChartPositionScript(rank)}”</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={isRecording ? "destructive" : "outline"}
                          disabled={(recordingRank !== null && !isRecording) || isBusy}
                          onClick={() => isRecording ? stopChartPositionRecording() : void startChartPositionRecording(rank)}
                        >
                          {isRecording ? "Stop & save" : <><Mic2 className="mr-2 h-4 w-4" /> Record</>}
                        </Button>
                        <label
                          htmlFor={`totp-chart-position-${rank}`}
                          className={`inline-flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted/40 ${isBusy ? "pointer-events-none opacity-50" : ""}`}
                        >
                          {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          {exists ? "Replace file" : "Upload"}
                        </label>
                        <input
                          id={`totp-chart-position-${rank}`}
                          className="sr-only"
                          type="file"
                          accept={ACCEPTED_AUDIO}
                          disabled={isBusy}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file) chartPositionUpload.mutate({ rank, file });
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>
                    </div>
                    {exists ? <audio className="mt-3 h-8 w-full" controls preload="none" src={audioUrl} /> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section id="band-name-audio" className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Users className="h-4 w-4" /> Band-name pronunciation library
              </h3>
              <p className="text-xs text-muted-foreground">
                Every band and solo act is listed here. Missing and renamed acts appear first; recording one clears its admin action.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={bandNeedsAudioCount > 0 ? "destructive" : "secondary"}>
                {bandNeedsAudioCount} need audio
              </Badge>
              <Badge variant="outline">{bandRecordedCount} current</Badge>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={bandSearch}
              onChange={(event) => setBandSearch(event.target.value)}
              placeholder="Search band or artist name…"
            />
          </div>

          {bandsQuery.isLoading ? (
            <div className="rounded-lg border p-5 text-sm text-muted-foreground">Loading band-name recordings…</div>
          ) : bandsQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 p-5 text-sm text-destructive">
              {(bandsQuery.error as Error).message}
            </div>
          ) : filteredBands.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              No bands match that search.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBands.map((band) => (
                <div key={band.band_id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileAudio2 className="h-4 w-4" />
                        <span className="font-semibold">{band.band_name}</span>
                        {band.is_solo_artist ? <Badge variant="outline">solo artist</Badge> : null}
                        {statusBadge(band.status)}
                      </div>
                      {band.status === "stale" && band.recorded_band_name ? (
                        <p className="mt-1 text-xs text-destructive">
                          Existing take says “{band.recorded_band_name}”; the current name is “{band.band_name}”.
                        </p>
                      ) : null}
                      {band.audio_url ? (
                        <audio className="mt-2 h-8 w-full" controls preload="none" src={band.audio_url} />
                      ) : null}
                      {band.version ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          v{band.version}{band.duration_ms ? ` · ${(band.duration_ms / 1000).toFixed(1)}s` : ""}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      <label
                        htmlFor={`totp-band-name-${band.band_id}`}
                        className="inline-flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-xs hover:bg-muted/40"
                      >
                        {uploadingBand === band.band_id
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Upload className="mr-2 h-4 w-4" />}
                        {band.status === "recorded" ? "Replace name clip" : "Upload name clip"}
                      </label>
                      <input
                        id={`totp-band-name-${band.band_id}`}
                        className="sr-only"
                        type="file"
                        accept={ACCEPTED_AUDIO}
                        disabled={uploadingBand === band.band_id}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) bandUpload.mutate({ band, file });
                          event.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export default TotpAudioStudio;
