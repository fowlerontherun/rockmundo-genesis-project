import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Clapperboard, Download, RefreshCw, XCircle } from "lucide-react";
import type { TotpEpisode } from "./api";
import { buildTotpEpisodeManifestFromEpisode, getStoredTotpEpisodeManifest } from "./episodeManifestApi";
import {
  activeTotpRenderJob,
  cancelTotpRender,
  enqueueTotpRender,
  getTotpRenderJobs,
  resolveTotpRenderArtifactUrl,
  totpRenderStateLabel,
} from "./renderQueueApi";
import { buildTotpRenderPlan } from "./renderSpec";

function formatRuntime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, "0")}s`;
}

export function TotpRenderQueueCard({ episode }: { episode: TotpEpisode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const stored = useQuery({
    queryKey: ["totp", "running-sheet", "stored", episode.id],
    queryFn: () => getStoredTotpEpisodeManifest(episode.id),
  });

  const live = useQuery({
    queryKey: ["totp", "running-sheet", "live", episode.id],
    queryFn: () => buildTotpEpisodeManifestFromEpisode(episode),
  });

  const jobs = useQuery({
    queryKey: ["totp", "render-jobs", episode.id],
    queryFn: () => getTotpRenderJobs(episode.id),
    refetchInterval: 20_000,
  });

  const active = activeTotpRenderJob(jobs.data ?? []);
  const manifest = stored.data?.manifest ?? live.data?.manifest ?? null;
  const plan = manifest ? buildTotpRenderPlan(manifest) : null;
  const savedAndCurrent = Boolean(stored.data && live.data && stored.data.checksum === live.data.manifest.checksum);
  const productionCleared = stored.data?.production_state === "production_ready" || stored.data?.production_state === "rendered_master";

  const queue = useMutation({
    mutationFn: async () => {
      if (!stored.data) throw new Error("Save the episode running sheet first.");
      if (!savedAndCurrent) throw new Error("The running sheet has changed — save it again before rendering.");
      if (!productionCleared) throw new Error("Sign off the episode in the control room before rendering the broadcast master.");
      return await enqueueTotpRender(stored.data.manifest);
    },
    onSuccess: () => {
      toast({ title: "Episode queued for rendering", description: "The render worker will pick it up shortly." });
      void queryClient.invalidateQueries({ queryKey: ["totp", "render-jobs", episode.id] });
    },
    onError: (error: unknown) => {
      toast({ title: "Could not queue the render", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const openArtifact = useMutation({
    mutationFn: resolveTotpRenderArtifactUrl,
    onSuccess: (url) => {
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (error: unknown) => {
      toast({ title: "Could not open render file", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const cancel = useMutation({
    mutationFn: (jobId: string) => cancelTotpRender(jobId),
    onSuccess: () => {
      toast({ title: "Render cancelled" });
      void queryClient.invalidateQueries({ queryKey: ["totp", "render-jobs", episode.id] });
    },
    onError: (error: unknown) => {
      toast({ title: "Could not cancel the render", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  return (
    <Card data-totp-render-queue>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-4 w-4" /> Episode file
            </CardTitle>
            <CardDescription>
              Turn the saved running sheet into a finished widescreen episode file with poster, subtitles and chapters.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={active ? "secondary" : savedAndCurrent ? "default" : "outline"}>
              {active ? totpRenderStateLabel(active.state) : savedAndCurrent && productionCleared ? "Ready to render" : savedAndCurrent ? "Needs sign-off" : "Running sheet not saved"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => void jobs.refetch()} disabled={jobs.isFetching}>
              <RefreshCw className={`h-4 w-4 ${jobs.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {plan ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border p-2">
              <p className="text-[11px] uppercase text-muted-foreground">Planned length</p>
              <p className="font-semibold">{formatRuntime(plan.total_duration_ms)}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-[11px] uppercase text-muted-foreground">Chapters</p>
              <p className="font-semibold">{plan.chapters.length}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-[11px] uppercase text-muted-foreground">Master file</p>
              <p className="truncate font-mono text-[11px]">{plan.delivery.master}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Build and save the running sheet to plan the episode file.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => queue.mutate()} disabled={queue.isPending || Boolean(active) || !savedAndCurrent || !productionCleared}>
            <Clapperboard className="mr-2 h-4 w-4" /> Render episode file
          </Button>
          {active ? (
            <Button size="sm" variant="outline" onClick={() => cancel.mutate(active.id)} disabled={cancel.isPending}>
              <XCircle className="mr-2 h-4 w-4" /> Cancel render
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          {(jobs.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No renders requested for this episode yet.</p>
          ) : (
            (jobs.data ?? []).map((job) => (
              <div key={job.id} className="rounded-lg border p-2" data-totp-render-job>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{totpRenderStateLabel(job.state)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    Attempt {job.attempts} · {new Date(job.created_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}
                  </span>
                </div>
                {job.state === "queued" || job.state === "rendering" ? (
                  <div className="mt-2 space-y-1">
                    <Progress value={job.progress_percent} className="h-1.5" />
                    <p className="text-[11px] text-muted-foreground">
                      {job.progress_percent}%{job.progress_stage ? ` · ${job.progress_stage.replaceAll("_", " ")}` : ""}
                      {job.attempts > 0 ? ` · attempt ${job.attempts}/${job.max_attempts}` : ""}
                    </p>
                  </div>
                ) : null}
                {job.error_message ? <p className="mt-1 text-[11px] text-destructive">{job.error_message}</p> : null}
                {job.qc && "failures" in job.qc && job.qc.failures?.length ? (
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-destructive">
                    {job.qc.failures.map((failure) => (
                      <li key={failure.code}>{failure.detail}</li>
                    ))}
                  </ul>
                ) : null}
                {job.artifacts.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {job.artifacts.map((artifact, index) => (
                      <Button
                        key={`${artifact.kind}-${artifact.filename}-${index}`}
                        size="sm"
                        variant="outline"
                        disabled={!artifact.url || openArtifact.isPending}
                        onClick={() => openArtifact.mutate(artifact)}
                      >
                        <Download className="mr-2 h-3.5 w-3.5" /> {artifact.kind}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TotpRenderQueueCard;
