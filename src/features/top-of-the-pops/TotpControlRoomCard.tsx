import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, CircleDashed, ClipboardCheck, History, Radio, ShieldCheck } from "lucide-react";
import type { TotpEpisode } from "./api";
import { buildTotpEpisodeManifestFromEpisode, getStoredTotpEpisodeManifest, saveTotpEpisodeManifest } from "./episodeManifestApi";
import { getTotpRenderJobs } from "./renderQueueApi";
import { getTotpEpisodePlan } from "./scheduleApi";
import { getTotpReleaseHealth } from "./releaseHealthApi";
import {
  TOTP_PREFLIGHT_AREA_LABELS,
  buildTotpPreflight,
  totpPreflightSeverityLabel,
  type TotpPreflightCheck,
} from "./preflight";
import {
  getTotpProductionAudit,
  logTotpProductionEvent,
  preflightAuditDetail,
  totpAuditKindLabel,
  type TotpAuditEventKind,
} from "./productionAuditApi";

function formatWhen(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function CheckRow({ item }: { item: TotpPreflightCheck }) {
  const Icon = item.passed ? CheckCircle2 : item.severity === "blocker" ? AlertTriangle : CircleDashed;
  const tone = item.passed
    ? "text-emerald-500"
    : item.severity === "blocker"
      ? "text-destructive"
      : "text-amber-500";
  return (
    <li className="flex items-start gap-2 rounded-md bg-muted/40 px-2 py-1.5" data-totp-preflight-check={item.code}>
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <p className="text-xs font-medium">
          {item.label}
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
            {TOTP_PREFLIGHT_AREA_LABELS[item.area]}
            {item.passed ? "" : ` · ${totpPreflightSeverityLabel(item.severity)}`}
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">{item.detail}</p>
      </div>
    </li>
  );
}

export function TotpControlRoomCard({ episode }: { episode: TotpEpisode }) {
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
  const renders = useQuery({
    queryKey: ["totp", "render-jobs", episode.id],
    queryFn: () => getTotpRenderJobs(episode.id),
  });
  const health = useQuery({
    queryKey: ["totp", "release-health"],
    queryFn: getTotpReleaseHealth,
    staleTime: 60_000,
  });
  const audit = useQuery({
    queryKey: ["totp", "production-audit", episode.id],
    queryFn: () => getTotpProductionAudit(episode.id, 30),
  });

  const lastRehearsal = useMemo(
    () => (audit.data ?? []).find((entry) => entry.event_kind === "rehearsal")?.created_at ?? null,
    [audit.data],
  );

  const report = useMemo(
    () =>
      buildTotpPreflight({
        manifest: live.data?.manifest ?? null,
        issues: live.data?.issues ?? [],
        stored: stored.data ?? null,
        plan: plan.data ?? null,
        renderJobs: renders.data ?? [],
        automationHealthy: health.data?.healthy ?? null,
        rehearsalCheckedAt: lastRehearsal,
      }),
    [live.data, stored.data, plan.data, renders.data, health.data, lastRehearsal],
  );

  const logEvent = useMutation({
    mutationFn: async (kind: TotpAuditEventKind) => {
      if (kind === "approval") {
        if (live.data) {
          await saveTotpEpisodeManifest({
            episodeId: episode.id,
            manifest: live.data.manifest,
            issues: live.data.issues,
            productionState: "production_ready",
          });
        }
        return await logTotpProductionEvent({
          episodeId: episode.id,
          eventKind: "approval",
          headline: "Episode signed off for broadcast",
          detail: preflightAuditDetail(report),
          passed: true,
          manifestChecksum: live.data?.manifest.checksum ?? null,
        });
      }
      if (kind === "rehearsal") {
        return await logTotpProductionEvent({
          episodeId: episode.id,
          eventKind: "rehearsal",
          headline: `Rehearsal pass over ${report.checks.length} checks`,
          detail: preflightAuditDetail(report),
          passed: report.blockers.length === 0,
          manifestChecksum: live.data?.manifest.checksum ?? null,
        });
      }
      return await logTotpProductionEvent({
        episodeId: episode.id,
        eventKind: "preflight",
        headline: `Pre-show checks: ${report.passedCount}/${report.checks.length} passed`,
        detail: preflightAuditDetail(report),
        passed: report.blockers.length === 0,
        manifestChecksum: live.data?.manifest.checksum ?? null,
      });
    },
    onSuccess: (entry) => {
      toast({ title: totpAuditKindLabel(entry.event_kind), description: entry.headline });
      void queryClient.invalidateQueries({ queryKey: ["totp", "production-audit", episode.id] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "running-sheet"] });
    },
    onError: (error: Error) =>
      toast({ title: "Could not save to the production log", description: error.message, variant: "destructive" }),
  });

  const loading = live.isLoading || stored.isLoading;

  return (
    <Card data-totp-control-room>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-4 w-4" /> Control room
            </CardTitle>
            <CardDescription>
              Everything that has to be right before this episode is rehearsed, exported and published.
            </CardDescription>
          </div>
          <Badge variant={report.blockers.length === 0 ? "secondary" : "destructive"} data-totp-preflight-status>
            {report.blockers.length === 0 ? "Ready" : `${report.blockers.length} to fix`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Running the pre-show checks…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>
                {report.passedCount}/{report.checks.length} checks passed
              </span>
              <span>{report.warnings.length} to look at</span>
              <span>{report.renderReady ? "Cleared to export" : "Not cleared to export"}</span>
              <span>{report.publishReady ? "Cleared to publish" : "Not cleared to publish"}</span>
            </div>

            <ul className="space-y-1">
              {report.checks.map((item) => (
                <CheckRow key={item.code} item={item} />
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => logEvent.mutate("preflight")}
                disabled={logEvent.isPending}
                data-totp-run-preflight
              >
                <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Run pre-show checks
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => logEvent.mutate("rehearsal")}
                disabled={logEvent.isPending || !report.rehearsalReady}
                data-totp-log-rehearsal
              >
                <Radio className="mr-1.5 h-3.5 w-3.5" /> Log rehearsal pass
              </Button>
              <Button
                size="sm"
                onClick={() => logEvent.mutate("approval")}
                disabled={logEvent.isPending || !report.renderReady}
                data-totp-sign-off
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Sign off for broadcast
              </Button>
            </div>
            {!report.rehearsalReady && (
              <p className="text-xs text-muted-foreground">
                A rehearsal needs at least one act with a playable recording.
              </p>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-medium">
                <History className="h-3.5 w-3.5" /> Production log
              </p>
              {audit.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading the production log…</p>
              ) : (audit.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing logged for this episode yet.</p>
              ) : (
                <ol className="space-y-1" data-totp-production-log>
                  {(audit.data ?? []).map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border px-2 py-1.5 text-xs">
                      <span className="min-w-0">
                        <span className="font-medium">{totpAuditKindLabel(entry.event_kind)}</span>
                        <span className="text-muted-foreground"> — {entry.headline}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {entry.passed === false ? "Problems · " : ""}
                        {formatWhen(entry.created_at)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
