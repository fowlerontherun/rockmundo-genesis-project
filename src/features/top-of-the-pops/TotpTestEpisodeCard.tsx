import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Check, Clapperboard, FlaskConical, ListVideo, Minus, Plus, ShieldCheck } from "lucide-react";
import { TotpTestLifecycleSimulator } from "./TotpTestLifecycleSimulator";
import { TotpFullShowDemo } from "./TotpFullShowDemo";
import { adminPreviewTotpTestEpisode, type TotpTestPreviewPerformance } from "./testPreviewApi";
import { getTotpAdminTestChartRundown } from "./chartRundownApi";

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(`${value}T12:00:00Z`));
}

function performanceKey(performance: TotpTestPreviewPerformance) {
  return `${performance.band_id}:${performance.song_id}`;
}

export function TotpTestEpisodeCard() {
  const { toast } = useToast();
  const [selectedPerformance, setSelectedPerformance] = useState<TotpTestPreviewPerformance | null>(null);
  const [bookedKeys, setBookedKeys] = useState<string[]>([]);
  const [showFullDemo, setShowFullDemo] = useState(false);

  const preview = useMutation({
    mutationFn: () => adminPreviewTotpTestEpisode("admin-test", 10),
    onSuccess: (result) => {
      setSelectedPerformance(null);
      setShowFullDemo(false);
      setBookedKeys(result.performances.map(performanceKey));
      toast({
        title: "Top of the Pops demo generated",
        description: `${result.selected_count} act${result.selected_count === 1 ? "" : "s"} selected from ${result.eligible_count} eligible bands. All selected acts have been added to the mock booking.`,
      });
    },
    onError: (error: Error) => toast({ title: "Could not generate TOTP demo", description: error.message, variant: "destructive" }),
  });

  const result = preview.data;
  const rundown = useQuery({
    queryKey: ["totp", "chart-rundown", "admin-demo", result?.chart_snapshot_date ?? "none"],
    queryFn: () => getTotpAdminTestChartRundown(result!.chart_snapshot_date),
    enabled: !!result?.chart_snapshot_date,
    staleTime: 60_000,
  });
  const bookedPerformances = result?.performances.filter((performance) => bookedKeys.includes(performanceKey(performance))) ?? [];

  const toggleBooking = (performance: TotpTestPreviewPerformance) => {
    const key = performanceKey(performance);
    setBookedKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  return (
    <Card className="border-dashed border-primary/40">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Clapperboard className="h-5 w-5" /> Top of the Pops Demo</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Build a safe mock booking from the live UK charts, choose which acts are in the demo bill, then run the whole programme
              continuously through the real TOTP presentation flow. You can still open the detailed lifecycle simulator for an individual act.
              Demo mode never creates invitations, rewards, history or player progression.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit gap-1"><ShieldCheck className="h-3 w-3" /> Safe admin demo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => preview.mutate()} disabled={preview.isPending}>
          <FlaskConical className="mr-2 h-4 w-4" /> {preview.isPending ? "Building demo…" : result ? "Refresh demo lineup" : "Build demo booking"}
        </Button>

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">Chart snapshot {formatSnapshotDate(result.chart_snapshot_date)}</Badge>
              <Badge variant="secondary">{result.eligible_count} eligible</Badge>
              <Badge variant="secondary">{bookedPerformances.length}/{result.selected_count} booked</Badge>
              <Badge variant="outline">No writes / no rewards</Badge>
            </div>

            {showFullDemo && bookedPerformances.length > 0 ? (
              <TotpFullShowDemo
                performances={bookedPerformances}
                seed={result.seed}
                generatedAt={result.generated_at}
                chartRundown={rundown.data ?? null}
                onExit={() => setShowFullDemo(false)}
              />
            ) : selectedPerformance ? (
              <TotpTestLifecycleSimulator
                key={`${result.seed}:${selectedPerformance.band_id}:${selectedPerformance.song_id}`}
                performance={selectedPerformance}
                seed={result.seed}
                generatedAt={result.generated_at}
                chartRundown={rundown.data ?? null}
                onExit={() => setSelectedPerformance(null)}
              />
            ) : result.performances.length === 0 ? (
              <p className="text-sm text-muted-foreground">The current chart snapshot produced no eligible demo acts.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
                  <Button
                    size="sm"
                    onClick={() => setShowFullDemo(true)}
                    disabled={bookedPerformances.length === 0}
                  >
                    <ListVideo className="mr-2 h-4 w-4" /> Book & run full demo show
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBookedKeys(result.performances.map(performanceKey))}
                  >
                    <Check className="mr-2 h-4 w-4" /> Book all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setBookedKeys([])}>
                    <Minus className="mr-2 h-4 w-4" /> Clear booking
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Uses the generated running order. Remove any acts you do not want in this mock episode.
                  </span>
                </div>

                <div className="space-y-2">
                  {result.performances.map((performance) => {
                    const booked = bookedKeys.includes(performanceKey(performance));
                    return (
                      <div key={performanceKey(performance)} className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 font-medium">
                              <span>{performance.running_order}. {performance.band_name}</span>
                              <Badge variant={booked ? "secondary" : "outline"}>{booked ? "booked" : "not booked"}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {performance.song_title} · chart #{performance.qualifying_rank} · {performance.qualifying_chart.replaceAll("_", " ")}
                            </div>
                            <div className="mt-1 text-xs italic text-muted-foreground">“{performance.presenter_intro}”</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Song title is visual-only in presenter links; the spoken copy only needs the chart position and band name.
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{performance.selection_bucket.replaceAll("_", " ")}</Badge>
                            <Badge variant="secondary">{performance.stage_key.replaceAll("_", " ")}</Badge>
                            <Badge variant={performance.audio?.audio_url || performance.audio?.extended_audio_url ? "secondary" : "outline"}>
                              {performance.audio?.audio_url || performance.audio?.extended_audio_url ? "song audio ready" : "no song audio"}
                            </Badge>
                            <Button size="sm" variant={booked ? "outline" : "secondary"} onClick={() => toggleBooking(performance)}>
                              {booked ? <Minus className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                              {booked ? "Remove from show" : "Add to show"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setSelectedPerformance(performance)}>
                              <Clapperboard className="mr-2 h-4 w-4" /> Run act lifecycle
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
