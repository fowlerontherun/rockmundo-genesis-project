import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, CircleDashed, ShieldAlert, ShieldCheck } from "lucide-react";
import type { TotpEpisode } from "./api";
import { buildTotpEpisodeManifestFromEpisode } from "./episodeManifestApi";
import { resolveTotpPresenter } from "./presenters";
import { logTotpProductionEvent } from "./productionAuditApi";
import {
  TOTP_COMPLIANCE_AREA_LABELS,
  screenTotpEpisode,
  type TotpComplianceFinding,
} from "./complianceScreening";
import {
  captionsFromTotpManifest,
  clearTotpTakedown,
  getTotpComplianceReport,
  getTotpEpisodeConsents,
  getTotpEpisodeTakedowns,
  recordTotpTakedown,
  saveTotpComplianceReport,
} from "./complianceApi";

function formatWhen(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function FindingRow({ item }: { item: TotpComplianceFinding }) {
  const Icon = item.passed ? CheckCircle2 : item.severity === "blocker" ? AlertTriangle : CircleDashed;
  const tone = item.passed
    ? "text-emerald-500"
    : item.severity === "blocker"
      ? "text-destructive"
      : "text-amber-500";
  return (
    <li className="flex items-start gap-2 rounded-md bg-muted/40 px-2 py-1.5" data-totp-compliance-finding={item.code}>
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <p className="text-xs font-medium">
          {item.label}
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
            {TOTP_COMPLIANCE_AREA_LABELS[item.area]}
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">{item.detail}</p>
      </div>
    </li>
  );
}

export function TotpComplianceCard({ episode }: { episode: TotpEpisode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const presenterName = resolveTotpPresenter(
    (episode as unknown as { presenter_key?: string }).presenter_key,
  ).displayName;

  const [takedownPerformance, setTakedownPerformance] = useState<string>("episode");
  const [takedownAction, setTakedownAction] = useState<"remove" | "replace" | "mute">("remove");
  const [takedownReason, setTakedownReason] = useState("");
  const [replacementNote, setReplacementNote] = useState("");

  const live = useQuery({
    queryKey: ["totp", "running-sheet", "live", episode.id],
    queryFn: () => buildTotpEpisodeManifestFromEpisode(episode),
  });
  const consents = useQuery({
    queryKey: ["totp", "consents", episode.id],
    queryFn: () => getTotpEpisodeConsents(episode.id),
  });
  const takedowns = useQuery({
    queryKey: ["totp", "takedowns", episode.id],
    queryFn: () => getTotpEpisodeTakedowns(episode.id),
  });
  const stored = useQuery({
    queryKey: ["totp", "compliance", episode.id],
    queryFn: () => getTotpComplianceReport(episode.id),
  });

  const manifest = live.data?.manifest ?? null;

  const report = useMemo(() => {
    if (!manifest) return null;
    return screenTotpEpisode({
      manifest,
      captions: captionsFromTotpManifest(manifest, presenterName),
      consents: consents.data ?? [],
      takedowns: takedowns.data ?? [],
    });
  }, [manifest, consents.data, takedowns.data, presenterName]);

  const save = useMutation({
    mutationFn: async () => {
      if (!report) throw new Error("Build the running sheet before screening the episode.");
      const saved = await saveTotpComplianceReport(report);
      await logTotpProductionEvent({
        episodeId: episode.id,
        eventKind: "preflight",
        headline: report.passed
          ? "Rights, content and accessibility screening passed"
          : `Screening found ${report.blockers.length} must-fix item${report.blockers.length === 1 ? "" : "s"}`,
        detail: {
          blockers: report.blockers.map((item) => ({ code: item.code, detail: item.detail })),
          warnings: report.warnings.map((item) => ({ code: item.code, detail: item.detail })),
          report_checksum: report.checksum,
        },
        passed: report.passed,
        manifestChecksum: report.manifest_checksum,
      });
      return saved;
    },
    onSuccess: () => {
      toast({ title: "Screening saved", description: "The report is attached to this episode." });
      void queryClient.invalidateQueries({ queryKey: ["totp", "compliance", episode.id] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "production-audit", episode.id] });
    },
    onError: (error: Error) => toast({ title: "Could not save screening", description: error.message, variant: "destructive" }),
  });

  const raise = useMutation({
    mutationFn: async () => {
      if (!takedownReason.trim()) throw new Error("Give a reason for the takedown.");
      return await recordTotpTakedown({
        episodeId: episode.id,
        performanceId: takedownPerformance === "episode" ? null : takedownPerformance,
        action: takedownAction,
        reason: takedownReason.trim(),
        replacementNote: replacementNote.trim() || null,
      });
    },
    onSuccess: () => {
      setTakedownReason("");
      setReplacementNote("");
      toast({ title: "Takedown recorded", description: "The episode cannot be published until it is closed." });
      void queryClient.invalidateQueries({ queryKey: ["totp", "takedowns", episode.id] });
    },
    onError: (error: Error) => toast({ title: "Could not record takedown", description: error.message, variant: "destructive" }),
  });

  const close = useMutation({
    mutationFn: (id: string) => clearTotpTakedown(id),
    onSuccess: () => {
      toast({ title: "Takedown closed" });
      void queryClient.invalidateQueries({ queryKey: ["totp", "takedowns", episode.id] });
    },
    onError: (error: Error) => toast({ title: "Could not close takedown", description: error.message, variant: "destructive" }),
  });

  const blockers = report?.blockers ?? [];
  const warnings = report?.warnings ?? [];
  const passedItems = (report?.findings ?? []).filter((item) => item.passed);
  const activeTakedowns = (takedowns.data ?? []).filter((item) => item.active);

  return (
    <Card data-totp-compliance-card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-4 w-4" /> Rights, content and accessibility
            </CardTitle>
            <CardDescription>
              Player permission, content review, music rights and subtitle checks before anything leaves the game.
            </CardDescription>
          </div>
          {report ? (
            <Badge variant={report.passed ? "secondary" : "destructive"}>
              {report.passed ? "Clear to publish" : `${blockers.length} must fix`}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {live.isLoading || consents.isLoading ? (
          <p className="text-sm text-muted-foreground">Screening the episode…</p>
        ) : live.isError ? (
          <p className="text-sm text-destructive">{(live.error as Error).message}</p>
        ) : consents.isError ? (
          <p className="text-sm text-destructive">{(consents.error as Error).message}</p>
        ) : !report ? (
          <p className="text-sm text-muted-foreground">Build the running sheet to screen this episode.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">Must fix</p>
                {blockers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing is blocking publication.</p>
                ) : (
                  <ul className="space-y-1">
                    {blockers.map((item) => (
                      <FindingRow key={`${item.code}-${item.performance_id ?? "episode"}`} item={item} />
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-500">Should fix</p>
                {warnings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No warnings.</p>
                ) : (
                  <ul className="space-y-1">
                    {warnings.map((item) => (
                      <FindingRow key={`${item.code}-${item.performance_id ?? "episode"}`} item={item} />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passed</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {passedItems.map((item) => (
                  <FindingRow key={item.code} item={item} />
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} data-totp-save-compliance>
                {save.isPending ? "Saving…" : "Save screening report"}
              </Button>
              {stored.data ? (
                <span className="text-[11px] text-muted-foreground">
                  Last screened {formatWhen(stored.data.updated_at)} · {stored.data.passed ? "passed" : `${stored.data.blocker_count} must fix`}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">No screening report saved yet.</span>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4" /> Takedowns and corrections
              </p>
              {activeTakedowns.length === 0 ? (
                <p className="text-xs text-muted-foreground">No open requests.</p>
              ) : (
                <ul className="space-y-1">
                  {activeTakedowns.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium capitalize">
                          {item.action} {item.performance_id ? "· one act" : "· whole episode"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{item.reason}</p>
                        {item.replacement_note ? (
                          <p className="text-[11px] text-muted-foreground">Replacement: {item.replacement_note}</p>
                        ) : null}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => close.mutate(item.id)} disabled={close.isPending}>
                        Close
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Applies to</Label>
                  <Select value={takedownPerformance} onValueChange={setTakedownPerformance}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Whole episode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="episode">Whole episode</SelectItem>
                      {(manifest?.segments ?? []).map((segment) => (
                        <SelectItem key={segment.performance_id} value={segment.performance_id}>
                          {segment.band_name} — {segment.song_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Action</Label>
                  <Select value={takedownAction} onValueChange={(value) => setTakedownAction(value as typeof takedownAction)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remove">Remove from the show</SelectItem>
                      <SelectItem value="replace">Replace with another act</SelectItem>
                      <SelectItem value="mute">Mute the audio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <Textarea
                  value={takedownReason}
                  onChange={(event) => setTakedownReason(event.target.value)}
                  placeholder="Why this act or episode cannot be shown as it stands"
                  className="min-h-[60px] text-xs"
                  data-totp-takedown-reason
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Replacement note (optional)</Label>
                <Input
                  value={replacementNote}
                  onChange={(event) => setReplacementNote(event.target.value)}
                  placeholder="What goes in its place"
                  className="h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => raise.mutate()}
                disabled={raise.isPending}
                data-totp-raise-takedown
              >
                {raise.isPending ? "Recording…" : "Record takedown"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Takedowns only stop the show going out. Fame, money and chart results already awarded in the game are left alone.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
