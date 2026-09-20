import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clapperboard, Download, RefreshCw, Wrench } from "lucide-react";
import type { TotpEpisode } from "./api";
import {
  buildTotpEpisodeManifestFromEpisode,
  getStoredTotpEpisodeManifest,
  storedManifestMatchesLive,
} from "./episodeManifestApi";
import {
  activeTotpRenderJob,
  enqueueTotpRehearsalRender,
  enqueueTotpSegmentPreview,
  getTotpRenderJobs,
  latestSucceededTotpRehearsal,
  latestSucceededTotpSegmentPreview,
  resolveTotpRenderArtifactUrl,
  totpRenderPurpose,
} from "./renderQueueApi";

export function TotpRehearsalCard({ episode }: { episode: TotpEpisode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const live = useQuery({
    queryKey: ["totp", "running-sheet", "live", episode.id],
    queryFn: () => buildTotpEpisodeManifestFromEpisode(episode),
  });
  const stored = useQuery({
    queryKey: ["totp", "running-sheet", "stored", episode.id],
    queryFn: () => getStoredTotpEpisodeManifest(episode.id),
  });
  const jobs = useQuery({
    queryKey: ["totp", "render-jobs", episode.id],
    queryFn: () => getTotpRenderJobs(episode.id),
    refetchInterval: 15_000,
  });

  const manifest = stored.data?.manifest ?? null;
  const inSync = storedManifestMatchesLive(stored.data ?? null, live.data?.manifest ?? null);
  const allJobs = jobs.data ?? [];
  const active = activeTotpRenderJob(allJobs);
  const rehearsal = latestSucceededTotpRehearsal(allJobs, manifest?.checksum);

  const queue = useMutation({
    mutationFn: async (request: { kind: "rehearsal" } | { kind: "segment"; performanceId: string }) => {
      if (!manifest || !inSync) throw new Error("Save the current running sheet before rehearsal.");
      return request.kind === "rehearsal"
        ? enqueueTotpRehearsalRender(manifest)
        : enqueueTotpSegmentPreview(manifest, request.performanceId);
    },
    onSuccess: (job) => {
      toast({
        title: totpRenderPurpose(job) === "rehearsal" ? "Rehearsal queued" : "Segment preview queued",
        description: "The deterministic render worker will use the exact frozen running sheet.",
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "render-jobs", episode.id] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "production-audit", episode.id] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not queue rehearsal", description: error.message, variant: "destructive" }),
  });

  const openArtifact = useMutation({
    mutationFn: async (artifact: NonNullable<typeof rehearsal>["artifacts"][number]) => {
      const url = await resolveTotpRenderArtifactUrl(artifact);
      if (!url) throw new Error("That rehearsal artifact is not available.");
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (error: Error) =>
      toast({ title: "Could not open preview", description: error.message, variant: "destructive" }),
  });

  const exactReady = Boolean(
    inSync
      && manifest
      && manifest.segments.length > 0
      && manifest.segments.every((segment) =>
        segment.assets.some((asset) => asset.kind === "song_audio" && asset.url && (asset.duration_ms ?? 0) > 0),
      ),
  );

  return (
    <Card data-totp-rehearsal>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-4 w-4" /> Rehearsal & segment review
            </CardTitle>
            <CardDescription>
              Render the frozen programme before sign-off, or inspect one act after replacing audio, presenter links or rights.
            </CardDescription>
          </div>
          <Badge variant={rehearsal ? "secondary" : inSync ? "outline" : "destructive"}>
            {rehearsal ? "QC rehearsal passed" : inSync ? "Rehearsal required" : "Running sheet changed"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {active ? (
          <div className="space-y-1 rounded-md border p-3" data-totp-active-rehearsal>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium">
                {totpRenderPurpose(active) === "rehearsal"
                  ? "Full rehearsal rendering"
                  : totpRenderPurpose(active) === "segment_preview"
                    ? "Segment preview rendering"
                    : "Master rendering"}
              </span>
              <span>{active.progress_percent}%</span>
            </div>
            <Progress value={active.progress_percent} className="h-1.5" />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => queue.mutate({ kind: "rehearsal" })}
            disabled={queue.isPending || Boolean(active) || !exactReady}
            data-totp-run-rehearsal
          >
            {rehearsal ? <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> : <Clapperboard className="mr-1.5 h-3.5 w-3.5" />}
            {rehearsal ? "Re-render full rehearsal" : "Run full rehearsal render"}
          </Button>
          {rehearsal ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> QC passed for {manifest?.checksum.slice(0, 12)}
            </span>
          ) : null}
        </div>

        {!exactReady ? (
          <p className="text-xs text-muted-foreground">
            Save the latest running sheet and make sure every song has playable audio with a known duration before rehearsal.
          </p>
        ) : null}

        <div className="space-y-2">
          {(manifest?.segments ?? []).map((segment) => {
            const preview = latestSucceededTotpSegmentPreview(allJobs, segment.performance_id, manifest?.checksum);
            const artifact = preview?.artifacts.find((item) => item.kind === "proxy")
              ?? preview?.artifacts.find((item) => item.kind === "master")
              ?? null;
            return (
              <div key={segment.performance_id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{segment.band_name} — {segment.song_title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {preview ? "QC preview ready" : "No segment preview yet"} · stage {segment.stage_key.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {artifact ? (
                    <Button size="sm" variant="outline" onClick={() => openArtifact.mutate(artifact)} disabled={openArtifact.isPending}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Open preview
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => queue.mutate({ kind: "segment", performanceId: segment.performance_id })}
                    disabled={queue.isPending || Boolean(active) || !exactReady}
                  >
                    {preview ? <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> : <Clapperboard className="mr-1.5 h-3.5 w-3.5" />}
                    {preview ? "Re-render preview" : "Preview segment"}
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href="#totp-broadcast-contract"><Wrench className="mr-1.5 h-3.5 w-3.5" /> Replace assets</a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default TotpRehearsalCard;
