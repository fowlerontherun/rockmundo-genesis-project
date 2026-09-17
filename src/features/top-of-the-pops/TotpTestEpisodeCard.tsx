import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Clapperboard, FlaskConical, ShieldCheck } from "lucide-react";
import { TotpTestLifecycleSimulator } from "./TotpTestLifecycleSimulator";
import { adminPreviewTotpTestEpisode, type TotpTestPreviewPerformance } from "./testPreviewApi";
import { getTotpChartRundown } from "./chartRundownApi";
import { getTotpEpisode } from "./api";

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(`${value}T12:00:00Z`));
}

export function TotpTestEpisodeCard() {
  const { toast } = useToast();
  const [selectedPerformance, setSelectedPerformance] = useState<TotpTestPreviewPerformance | null>(null);
  const currentEpisode = useQuery({
    queryKey: ["totp", "episode", "admin-demo-rundown"],
    queryFn: () => getTotpEpisode(),
    staleTime: 30_000,
  });
  const currentEpisodeId = currentEpisode.data?.id ?? null;
  const rundown = useQuery({
    queryKey: ["totp", "chart-rundown", "admin-demo", currentEpisodeId],
    queryFn: () => getTotpChartRundown(currentEpisodeId),
    enabled: !!currentEpisodeId,
    staleTime: 60_000,
  });
  const preview = useMutation({
    mutationFn: () => adminPreviewTotpTestEpisode("admin-test", 10),
    onSuccess: (result) => {
      setSelectedPerformance(null);
      toast({
        title: "Top of the Pops demo generated",
        description: `${result.selected_count} act${result.selected_count === 1 ? "" : "s"} selected from ${result.eligible_count} eligible bands. No gameplay data was changed.`,
      });
    },
    onError: (error: Error) => toast({ title: "Could not generate TOTP demo", description: error.message, variant: "destructive" }),
  });

  const result = preview.data;

  return (
    <Card className="border-dashed border-primary/40">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Clapperboard className="h-5 w-5" /> Top of the Pops Demo</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Preview the complete Top of the Pops experience without waiting for a real Thursday broadcast. The demo uses the live UK chart eligibility, editorial selection, running-order and stage-assignment rules, then lets you take a selected act through an accelerated invitation-to-archive simulation using the real TOTP 3D broadcast viewer. Demo mode never writes player progression or rewards.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit gap-1"><ShieldCheck className="h-3 w-3" /> Safe admin demo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => preview.mutate()} disabled={preview.isPending}>
          <FlaskConical className="mr-2 h-4 w-4" /> {preview.isPending ? "Building demo…" : result ? "Refresh demo lineup" : "Launch Top of the Pops demo"}
        </Button>

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">Chart snapshot {formatSnapshotDate(result.chart_snapshot_date)}</Badge>
              <Badge variant="secondary">{result.eligible_count} eligible</Badge>
              <Badge variant="secondary">{result.selected_count} selected</Badge>
              <Badge variant="outline">No writes / no rewards</Badge>
            </div>

            {selectedPerformance ? (
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
              <div className="space-y-2">
                {result.performances.map((performance) => (
                  <div key={`${performance.band_id}:${performance.song_id}`} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium">{performance.running_order}. {performance.band_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {performance.song_title} · chart #{performance.qualifying_rank} · {performance.qualifying_chart.replaceAll("_", " ")}
                        </div>
                        <div className="mt-1 text-xs italic text-muted-foreground">“{performance.presenter_intro}”</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{performance.selection_bucket.replaceAll("_", " ")}</Badge>
                        <Badge variant="secondary">{performance.stage_key.replaceAll("_", " ")}</Badge>
                        <Badge variant={performance.audio?.audio_url || performance.audio?.extended_audio_url ? "secondary" : "outline"}>
                          {performance.audio?.audio_url || performance.audio?.extended_audio_url ? "song audio ready" : "no song audio"}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => setSelectedPerformance(performance)}>
                          <Clapperboard className="mr-2 h-4 w-4" /> Run full demo lifecycle
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
