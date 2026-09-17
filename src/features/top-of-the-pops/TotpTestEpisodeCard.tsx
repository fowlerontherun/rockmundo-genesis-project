import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { adminPreviewTotpTestEpisode } from "./testPreviewApi";

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(`${value}T12:00:00Z`));
}

export function TotpTestEpisodeCard() {
  const { toast } = useToast();
  const preview = useMutation({
    mutationFn: () => adminPreviewTotpTestEpisode("admin-test", 10),
    onSuccess: (result) => {
      toast({
        title: "Safe test preview generated",
        description: `${result.selected_count} act${result.selected_count === 1 ? "" : "s"} selected from ${result.eligible_count} eligible bands. No gameplay data was changed.`,
      });
    },
    onError: (error: Error) => toast({ title: "Could not generate test preview", description: error.message, variant: "destructive" }),
  });

  const result = preview.data;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" /> Test episode</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Run the live UK chart eligibility, editorial selection, running-order and stage-assignment rules without creating a real episode. This dry run cannot send invitations or notifications, award rewards, write appearance history or alter charts.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit gap-1"><ShieldCheck className="h-3 w-3" /> Safe dry run</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => preview.mutate()} disabled={preview.isPending} variant="secondary">
          <FlaskConical className="mr-2 h-4 w-4" /> {preview.isPending ? "Building preview…" : result ? "Refresh test preview" : "Run test preview"}
        </Button>

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">Chart snapshot {formatSnapshotDate(result.chart_snapshot_date)}</Badge>
              <Badge variant="secondary">{result.eligible_count} eligible</Badge>
              <Badge variant="secondary">{result.selected_count} selected</Badge>
              <Badge variant="outline">No writes / no rewards</Badge>
            </div>

            {result.performances.length === 0 ? (
              <p className="text-sm text-muted-foreground">The current chart snapshot produced no eligible test acts.</p>
            ) : (
              <div className="space-y-2">
                {result.performances.map((performance) => (
                  <div key={`${performance.band_id}:${performance.song_id}`} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium">{performance.running_order}. {performance.band_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {performance.song_title} · chart #{performance.qualifying_rank} · {performance.qualifying_chart.replaceAll("_", " ")}
                        </div>
                        <div className="mt-1 text-xs italic text-muted-foreground">“{performance.presenter_intro}”</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{performance.selection_bucket.replaceAll("_", " ")}</Badge>
                        <Badge variant="secondary">{performance.stage_key.replaceAll("_", " ")}</Badge>
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
