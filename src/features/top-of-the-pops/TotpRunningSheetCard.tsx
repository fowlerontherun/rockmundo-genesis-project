import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, RefreshCw, Save } from "lucide-react";
import type { TotpEpisode } from "./api";
import {
  buildTotpEpisodeManifestFromEpisode,
  getStoredTotpEpisodeManifest,
  saveTotpEpisodeManifest,
  storedManifestMatchesLive,
} from "./episodeManifestApi";
import type { TotpProductionState } from "./episodeManifest";
import { getTotpEpisodePlan } from "./scheduleApi";
import { formatPlannedRuntime, plannedRuntimeSeconds } from "./scheduleWeeks";

const STATE_LABELS: Record<TotpProductionState, string> = {
  gameplay: "In-game only",
  production_ready: "Production ready",
  rendered_master: "Rendered master",
  published: "Published",
};

function formatRuntime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function TotpRunningSheetCard({ episode }: { episode: TotpEpisode }) {
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

  const plan = useQuery({
    queryKey: ["totp", "episode-plan", episode.id],
    queryFn: () => getTotpEpisodePlan(episode.id),
  });



  const save = useMutation({
    mutationFn: async (productionState: TotpProductionState) => {
      if (!live.data) throw new Error("The running sheet has not been built yet.");
      return await saveTotpEpisodeManifest({
        episodeId: episode.id,
        manifest: live.data.manifest,
        issues: live.data.issues,
        productionState,
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Running sheet saved",
        description: `${result.segment_count} act${result.segment_count === 1 ? "" : "s"} stored as ${STATE_LABELS[result.production_state]}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "running-sheet"] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not save running sheet", description: error.message, variant: "destructive" }),
  });

  const blocking = (live.data?.issues ?? []).filter((issue) => issue.severity === "blocking");
  const warnings = (live.data?.issues ?? []).filter((issue) => issue.severity === "warning");
  const inSync = storedManifestMatchesLive(stored.data ?? null, live.data?.manifest ?? null);

  return (
    <Card data-totp-running-sheet>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" /> Episode running sheet
            </CardTitle>
            <CardDescription>
              The fixed order of acts, songs, audio and music permissions for this episode.
            </CardDescription>
          </div>
          {stored.data ? (
            <Badge variant={inSync ? "secondary" : "destructive"}>
              {inSync ? STATE_LABELS[stored.data.production_state] : "Out of date"}
            </Badge>
          ) : (
            <Badge variant="outline">Not saved</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {live.isLoading ? (
          <p className="text-muted-foreground">Building the running sheet…</p>
        ) : live.isError ? (
          <p className="text-destructive">{(live.error as Error).message}</p>
        ) : live.data ? (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>{live.data.manifest.segments.length} acts</span>
              <span>Runtime {formatRuntime(live.data.manifest.total_runtime_ms)}</span>
              <span>Fingerprint {live.data.manifest.checksum.slice(0, 12)}</span>
            </div>

            <ol className="space-y-1">
              {live.data.manifest.segments.map((segment) => (
                <li key={segment.performance_id} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-2 py-1">
                  <span className="truncate">
                    <span className="text-muted-foreground">{segment.index}.</span> {segment.band_name} — {segment.song_title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">#{segment.qualifying_rank}</span>
                </li>
              ))}
            </ol>

            {blocking.length > 0 && (
              <ul className="space-y-1 text-xs text-destructive">
                {blocking.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            )}
            {warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {warnings.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            )}

            {plan.data && (
              <div className="space-y-1 rounded-md border border-dashed p-2 text-xs" data-totp-sheet-plan>
                <p className="font-medium">Planned in advance{plan.data.theme ? `: ${plan.data.theme}` : ""}</p>
                {plan.data.opening_link && <p className="text-muted-foreground">Opening link: {plan.data.opening_link}</p>}
                {plan.data.closing_link && <p className="text-muted-foreground">Closing link: {plan.data.closing_link}</p>}
                {plan.data.segments.length > 0 && (
                  <p className="text-muted-foreground">
                    {plan.data.segments.length} planned segment{plan.data.segments.length === 1 ? "" : "s"} ·{" "}
                    {formatPlannedRuntime(plannedRuntimeSeconds(plan.data.segments))} planned runtime
                  </p>
                )}
                {plan.data.notes && <p className="text-muted-foreground">Notes: {plan.data.notes}</p>}
              </div>
            )}



            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => void live.refetch()} disabled={live.isFetching}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rebuild
              </Button>
              <Button size="sm" variant="secondary" onClick={() => save.mutate("gameplay")} disabled={save.isPending}>
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save sheet
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Final production sign-off happens in the control room after a QC-approved rehearsal render.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}