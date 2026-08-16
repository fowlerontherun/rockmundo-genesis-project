import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildGigViewerReplay } from "@/features/gig-experience/events/generator";
import { validateGigViewerReplay } from "@/features/gig-experience/events/schema";
import { GIG_EVENT_SCHEMA_VERSION, GIG_VIEWER_VERSION } from "@/features/gig-experience/events/constants";
import { getGigViewerReplay } from "@/features/gig-experience/services/GigViewerReplayService";
import { getGigExperience } from "@/features/gig-experience/services/GigExperienceService";
import { metricValue } from "@/features/gig-experience/reportMetric";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

type StoredState = "ready" | "generating" | "failed" | "unavailable" | "unsupported_version" | "not_provisioned" | "unknown";

interface AuditRow {
  gigId: string;
  gigDate: string | null;
  completedAt: string | null;
  bandName: string;
  venueName: string;
  attendance: number | null;
  capacity: number | null;
  rating: number | null;
  outcomeId: string | null;
  songPerformanceCount: number;
  storedState: StoredState;
  storedVersion: number | null;
  storedDurationMs: number | null;
}

interface CheckResult {
  state: "running" | "valid" | "invalid" | "error";
  eventCount?: number;
  durationMs?: number;
  errors?: string[];
  message?: string;
  checkedAt?: string;
  regenerated?: boolean;
}

const MISSING_TABLE = "42P01";

function storedBadge(state: StoredState) {
  switch (state) {
    case "ready":
      return <Badge className="bg-emerald-600 text-emerald-50">Stored replay</Badge>;
    case "generating":
      return <Badge variant="secondary">Generating</Badge>;
    case "failed":
      return <Badge variant="destructive">Generation failed</Badge>;
    case "unsupported_version":
      return <Badge variant="destructive">Version mismatch</Badge>;
    case "not_provisioned":
      return <Badge variant="outline">Storage not provisioned</Badge>;
    default:
      return <Badge variant="outline">On-demand replay</Badge>;
  }
}

async function loadAuditRows(): Promise<{ rows: AuditRow[]; storageProvisioned: boolean }> {
  const { data: gigs, error } = await (supabase as any)
    .from("gigs")
    .select("id,scheduled_date,completed_at,status,bands:bands(name),venues:venues!gigs_venue_id_fkey(name,capacity)")
    .in("status", ["completed", "performed"])
    .order("scheduled_date", { ascending: false })
    .limit(200);
  if (error) throw error;

  const gigIds = ((gigs ?? []) as any[]).map((gig) => gig.id);
  if (!gigIds.length) return { rows: [], storageProvisioned: false };

  const { data: outcomes, error: outcomeError } = await (supabase as any)
    .from("gig_outcomes")
    .select("id,gig_id,actual_attendance,venue_capacity,overall_rating")
    .in("gig_id", gigIds);
  if (outcomeError) throw outcomeError;
  const outcomeByGig = new Map(((outcomes ?? []) as any[]).map((row) => [row.gig_id, row]));

  const outcomeIds = ((outcomes ?? []) as any[]).map((row) => row.id);
  const songCounts = new Map<string, number>();
  if (outcomeIds.length) {
    const { data: perfs } = await (supabase as any)
      .from("gig_song_performances")
      .select("gig_outcome_id")
      .in("gig_outcome_id", outcomeIds);
    for (const row of ((perfs ?? []) as any[])) {
      songCounts.set(row.gig_outcome_id, (songCounts.get(row.gig_outcome_id) ?? 0) + 1);
    }
  }

  const replayRes = await (supabase as any)
    .from("gig_viewer_replays")
    .select("gig_id,viewer_version,event_schema_version,duration_ms,generation_status,generated_at")
    .in("gig_id", gigIds)
    .order("generated_at", { ascending: false });
  const storageProvisioned = !(replayRes.error && replayRes.error.code === MISSING_TABLE);
  if (replayRes.error && replayRes.error.code !== MISSING_TABLE) throw replayRes.error;
  const replayByGig = new Map<string, any>();
  for (const row of ((replayRes.data ?? []) as any[])) {
    if (!replayByGig.has(row.gig_id)) replayByGig.set(row.gig_id, row);
  }

  const rows: AuditRow[] = ((gigs ?? []) as any[]).map((gig) => {
    const outcome = outcomeByGig.get(gig.id);
    const replay = replayByGig.get(gig.id);
    let storedState: StoredState = storageProvisioned ? "unavailable" : "not_provisioned";
    if (replay) {
      if (replay.generation_status === "ready") {
        storedState =
          replay.viewer_version === GIG_VIEWER_VERSION && replay.event_schema_version === GIG_EVENT_SCHEMA_VERSION
            ? "ready"
            : "unsupported_version";
      } else if (replay.generation_status === "generating") storedState = "generating";
      else if (replay.generation_status === "failed") storedState = "failed";
      else storedState = "unavailable";
    }
    return {
      gigId: gig.id,
      gigDate: gig.scheduled_date ?? null,
      completedAt: gig.completed_at ?? null,
      bandName: gig.bands?.name ?? "Unknown band",
      venueName: gig.venues?.name ?? "Unknown venue",
      attendance: outcome?.actual_attendance ?? null,
      capacity: outcome?.venue_capacity ?? gig.venues?.capacity ?? null,
      rating: outcome?.overall_rating ?? null,
      outcomeId: outcome?.id ?? null,
      songPerformanceCount: outcome ? songCounts.get(outcome.id) ?? 0 : 0,
      storedState,
      storedVersion: replay?.viewer_version ?? null,
      storedDurationMs: replay?.duration_ms ?? null,
    };
  });

  return { rows, storageProvisioned };
}

export default function GigViewerReplayAudit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [inspected, setInspected] = useState<Record<string, GigViewerReplay>>({});
  const [batchRunning, setBatchRunning] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["admin-gig-viewer-replay-audit"],
    queryFn: loadAuditRows,
  });

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.bandName, row.venueName, row.gigId].some((value) => value.toLowerCase().includes(term)),
    );
  }, [rows, search]);

  const summary = useMemo(() => {
    const checked = Object.values(results);
    return {
      total: rows.length,
      stored: rows.filter((row) => row.storedState === "ready").length,
      missingSongs: rows.filter((row) => row.songPerformanceCount === 0).length,
      valid: checked.filter((row) => row.state === "valid").length,
      failing: checked.filter((row) => row.state === "invalid" || row.state === "error").length,
    };
  }, [rows, results]);

  async function runCheck(row: AuditRow, regenerate: boolean) {
    setResults((prev) => ({ ...prev, [row.gigId]: { state: "running", regenerated: regenerate } }));
    try {
      if (regenerate) {
        await queryClient.invalidateQueries({ queryKey: ["gig-experience", row.gigId] });
      }

      if (!regenerate && data?.storageProvisioned) {
        const stored = await getGigViewerReplay(row.gigId).catch((error: any) => {
          if (error?.code === MISSING_TABLE) return null;
          throw error;
        });
        if (stored?.state === "ready" && stored.replay) {
          const validation = validateGigViewerReplay(stored.replay);
          setResults((prev) => ({
            ...prev,
            [row.gigId]: {
              state: validation.valid ? "valid" : "invalid",
              eventCount: stored.replay!.events.length,
              durationMs: stored.replay!.durationMs,
              errors: validation.valid ? [] : validation.errors,
              message: "Validated the stored canonical replay.",
              checkedAt: new Date().toISOString(),
            },
          }));
          return;
        }
      }

      const experience = await getGigExperience(row.gigId);
      if (!experience) throw new Error("No gig experience data could be loaded for this gig.");
      if (!experience.songs.length) throw new Error("No setlist or song performance rows were stored, so no replay can be built.");

      const replay = await buildGigViewerReplay({
        replayId: `audit-${row.gigId}`,
        outcomeId: experience.viewer.outcomeId ?? `audit-${row.gigId}`,
        generatedAt: new Date().toISOString(),
        gig: {
          id: row.gigId,
          completedAt: experience.gig.completedAt ?? new Date().toISOString(),
          actualAttendance: metricValue(experience.headline.attendance, 0),
          venueCapacity: experience.gig.venue.capacity,
          overallRating: metricValue(experience.headline.overallRating, 0),
          netProfit: metricValue(experience.finances.netProfit, 0),
        },
        songs: experience.songs.map((song) => ({
          id: song.id,
          songId: song.songId,
          title: song.title,
          position: song.position - 1,
          performanceScore: metricValue(song.performanceScore, 0),
        })),
        performers: experience.performers.map((performer) => ({
          profileId: performer.profileId,
          displayName: performer.displayName,
          roleOrInstrument: performer.roleOrInstrument,
        })),
      });

      const validation = validateGigViewerReplay(replay);
      setResults((prev) => ({
        ...prev,
        [row.gigId]: {
          state: validation.valid ? "valid" : "invalid",
          eventCount: replay.events.length,
          durationMs: replay.durationMs,
          errors: validation.valid ? [] : validation.errors,
          message: regenerate
            ? "Rebuilt the deterministic replay from live gig data."
            : "No stored replay found — validated the on-demand replay instead.",
          checkedAt: new Date().toISOString(),
          regenerated: regenerate,
        },
      }));
    } catch (error: any) {
      setResults((prev) => ({
        ...prev,
        [row.gigId]: {
          state: "error",
          message: error?.message ?? "Replay check failed.",
          checkedAt: new Date().toISOString(),
        },
      }));
    }
  }

  async function runAll() {
    setBatchRunning(true);
    for (const row of filtered.slice(0, 25)) {
      await runCheck(row, false);
    }
    setBatchRunning(false);
    toast({ title: "Replay audit complete", description: `Checked ${Math.min(filtered.length, 25)} completed gigs.` });
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Gig Viewer Replay Audit</h1>
          <p className="text-xs text-muted-foreground">
            Replay availability and validation status for every completed gig.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} /> Reload
          </Button>
          <Button size="sm" onClick={runAll} disabled={batchRunning || !filtered.length}>
            {batchRunning ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
            Validate visible
          </Button>
        </div>
      </div>

      {data && !data.storageProvisioned && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
            <span>
              Canonical replay storage (<code>gig_viewer_replays</code>) is not provisioned on this database, so every gig
              renders an on-demand replay built from its stored outcome and setlist. Validation below checks that those
              on-demand replays are complete and schema-valid.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: "Completed gigs", value: summary.total },
          { label: "Stored replays", value: summary.stored },
          { label: "No song data", value: summary.missingSongs },
          { label: "Validated OK", value: summary.valid },
          { label: "Problems", value: summary.failing },
        ].map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tile.label}</p>
              <p className="text-lg font-semibold">{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Completed gigs</CardTitle>
          <CardDescription className="text-xs">
            Validate reads the stored replay when one exists; Regenerate always rebuilds from live gig data.
          </CardDescription>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search band, venue or gig id"
            className="mt-2 h-8 text-xs"
          />
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {isLoading ? (
            <p className="p-3 text-xs text-muted-foreground">Loading completed gigs…</p>
          ) : isError ? (
            <p className="p-3 text-xs text-destructive">Could not load the gig list.</p>
          ) : !filtered.length ? (
            <p className="p-3 text-xs text-muted-foreground">No completed gigs match this filter.</p>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-1.5">
                {filtered.map((row) => {
                  const result = results[row.gigId];
                  return (
                    <div key={row.gigId} className="rounded-md border bg-card/60 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium">{row.bandName}</span>
                            {storedBadge(row.storedState)}
                            {row.songPerformanceCount === 0 && (
                              <Badge variant="destructive" className="text-[10px]">No song data</Badge>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {row.venueName} · {row.gigDate ?? "no date"} ·{" "}
                            {row.attendance ?? "?"}/{row.capacity ?? "?"} in ·{" "}
                            {row.rating != null ? `${Number(row.rating).toFixed(1)}/25` : "no rating"} ·{" "}
                            {row.songPerformanceCount} songs
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            disabled={result?.state === "running"}
                            onClick={() => runCheck(row, false)}
                          >
                            {result?.state === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Validate"}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            disabled={result?.state === "running"}
                            onClick={() => runCheck(row, true)}
                          >
                            Regenerate
                          </Button>
                        </div>
                      </div>

                      {result && result.state !== "running" && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded bg-muted/40 p-1.5 text-[11px]">
                          {result.state === "valid" ? (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 text-destructive" />
                          )}
                          <div className="min-w-0">
                            <p>
                              {result.state === "valid" ? "Replay available and valid" : "Replay problem"}
                              {result.eventCount != null && ` · ${result.eventCount} events`}
                              {result.durationMs != null && ` · ${Math.round(result.durationMs / 1000)}s`}
                            </p>
                            {result.message && <p className="text-muted-foreground">{result.message}</p>}
                            {!!result.errors?.length && (
                              <ul className="list-inside list-disc text-destructive">
                                {result.errors.slice(0, 5).map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
