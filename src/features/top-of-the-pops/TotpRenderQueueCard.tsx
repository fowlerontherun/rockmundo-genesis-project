import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clapperboard, Download, RefreshCw, XCircle } from "lucide-react";
import type { TotpEpisode } from "./api";
import { buildTotpEpisodeManifestFromEpisode, getStoredTotpEpisodeManifest } from "./episodeManifestApi";
import {
  activeTotpRenderJob,
  cancelTotpRender,
  enqueueTotpRender,
  getTotpRenderArtifactUrl,
  getTotpRenderJobs,
  totpRenderStateLabel,
  type TotpRenderArtifact,
} from "./renderQueueApi";
import { buildTotpRenderPlan } from "./renderSpec";

function formatRuntime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, "0")}s`;
}

function shortHash(value: string | null | undefined) {
  return value ? value.slice(0, 12) : "—";
}

function ArtifactButton({ jobId, artifact }: { jobId: string; artifact: TotpRenderArtifact }) {
  const link = useQuery({
    queryKey: ["totp", "render-artifact", jobId, artifact.storage_path ?? artifact.url ?? artifact.filename],
    queryFn: () => getTotpRenderArtifactUrl(artifact),
    enabled: Boolean(artifact.storage_path || artifact.url),
    staleTime: 50 * 60 * 1000,
  });
  const label = artifact.label || artifact.kind.replace("_", " ");

  return (
    <Button size="sm" variant="outline" asChild={Boolean(link.data)} disabled={!link.data || link.isLoading}>
      {link.data ? (
        <a href={link.data} target="_blank" rel="noreferrer"><Download className="mr-2 h-3.5 w-3.5" /> {label}</a>
      ) : <span>{link.isLoading ? "Preparing link…" : label}</span>}
    </Button>
  );
}

export function TotpRenderQueueCard({ episode }: { episode: TotpEpisode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const stored = useQuery({ queryKey: ["totp", "running-sheet", "stored", episode.id], queryFn: () => getStoredTotpEpisodeManifest(episode.id) });
  const live = useQuery({ queryKey: ["totp", "running-sheet", "live", episode.id], queryFn: () => buildTotpEpisodeManifestFromEpisode(episode) });
  const jobs = useQuery({ queryKey: ["totp", "render-jobs", episode.id], queryFn: () => getTotpRenderJobs(episode.id), refetchInterval: 10_000 });

  const active = activeTotpRenderJob(jobs.data ?? []);
  const manifest = stored.data?.manifest ?? live.data?.manifest ?? null;
  const plan = manifest ? buildTotpRenderPlan(manifest) : null;
  const savedAndCurrent = Boolean(stored.data && live.data && stored.data.checksum === live.data.manifest.checksum);
  const blockers = live.data?.issues.filter((issue) => issue.severity === "blocking") ?? [];

  const queue = useMutation({
    mutationFn: async () => {
      if (!stored.data) throw new Error("Save the episode running sheet first.");
      if (!savedAndCurrent) throw new Error("The running sheet has changed — save it again before rendering.");
      if (blockers.length) throw new Error(blockers.map((item) => item.message).join(" "));
      return await enqueueTotpRender(stored.data.manifest);
    },
    onSuccess: () => {
      toast({ title: "Episode queued for rendering", description: "The deterministic render worker will claim it shortly." });
      void queryClient.invalidateQueries({ queryKey: ["totp", "render-jobs", episode.id] });
    },
    onError: (error: unknown) => toast({ title: "Could not queue the render", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: (jobId: string) => cancelTotpRender(jobId),
    onSuccess: () => {
      toast({ title: "Render cancelled" });
      void queryClient.invalidateQueries({ queryKey: ["totp", "render-jobs", episode.id] });
    },
    onError: (error: unknown) => toast({ title: "Could not cancel the render", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }),
  });

  return (
    <Card data-totp-render-queue>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Clapperboard className="h-4 w-4" /> Episode master</CardTitle>
            <CardDescription>Deterministically render the frozen running sheet to 1080p30 H.264/AAC, then run frame, audio, caption and format QC.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={active ? "secondary" : savedAndCurrent && blockers.length === 0 ? "default" : "outline"}>
              {active ? totpRenderStateLabel(active.state) : savedAndCurrent && blockers.length === 0 ? "Ready to render" : "Preflight incomplete"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => void jobs.refetch()} disabled={jobs.isFetching}><RefreshCw className={`h-4 w-4 ${jobs.isFetching ? "animate-spin" : ""}`} /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {plan ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border p-2"><p className="text-[11px] uppercase text-muted-foreground">Planned length</p><p className="font-semibold">{formatRuntime(plan.total_duration_ms)}</p></div>
            <div className="rounded-lg border p-2"><p className="text-[11px] uppercase text-muted-foreground">Expected frames</p><p className="font-semibold">{Math.round((plan.total_duration_ms / 1000) * plan.programme_spec.frame_rate).toLocaleString()}</p></div>
            <div className="rounded-lg border p-2"><p className="text-[11px] uppercase text-muted-foreground">Master file</p><p className="truncate font-mono text-[11px]">{plan.delivery.master}</p></div>
          </div>
        ) : <p className="text-xs text-muted-foreground">Build and save the running sheet to plan the episode master.</p>}

        {blockers.length ? <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{blockers.map((item) => <p key={item.code + (item.performance_id ?? "")}>{item.message}</p>)}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => queue.mutate()} disabled={queue.isPending || Boolean(active) || !savedAndCurrent || blockers.length > 0}><Clapperboard className="mr-2 h-4 w-4" /> Render approved master</Button>
          {active ? <Button size="sm" variant="outline" onClick={() => cancel.mutate(active.id)} disabled={cancel.isPending}><XCircle className="mr-2 h-4 w-4" /> Cancel render</Button> : null}
        </div>

        <div className="space-y-2">
          {(jobs.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No renders requested for this episode yet.</p> : (jobs.data ?? []).map((job) => (
            <div key={job.id} className="rounded-lg border p-3" data-totp-render-job>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold">{job.state === "succeeded" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : null}{totpRenderStateLabel(job.state)}</span>
                <span className="text-[11px] text-muted-foreground">Attempt {job.attempts} · {new Date(job.created_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}</span>
              </div>
              {job.state === "rendering" ? <div className="mt-2 space-y-1"><Progress value={job.progress_percent} className="h-1.5" /><p className="text-[11px] text-muted-foreground">{job.progress_percent}% · worker heartbeat {job.heartbeat_at ? new Date(job.heartbeat_at).toLocaleTimeString("en-GB", { timeZone: "Europe/London" }) : "waiting"}</p></div> : null}
              {job.error_message ? <p className="mt-1 text-[11px] text-destructive">{job.error_message}</p> : null}
              {job.qc && "failures" in job.qc && job.qc.failures?.length ? <ul className="mt-1 list-disc pl-4 text-[11px] text-destructive">{job.qc.failures.map((failure) => <li key={failure.code}>{failure.detail}</li>)}</ul> : null}
              {job.state === "succeeded" ? <div className="mt-2 grid gap-1 text-[10px] text-muted-foreground sm:grid-cols-3"><span>Master {shortHash(job.master_sha256)}</span><span>Timeline {shortHash(job.timeline_sha256)}</span><span>Inputs {shortHash(job.input_sha256)}</span></div> : null}
              {job.artifacts.length ? <div className="mt-2 flex flex-wrap gap-2">{job.artifacts.map((artifact) => <ArtifactButton key={`${artifact.kind}:${artifact.filename}`} jobId={job.id} artifact={artifact} />)}</div> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default TotpRenderQueueCard;
