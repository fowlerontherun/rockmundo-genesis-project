import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFestivalEditionOperations } from "../hooks";
import { FestivalCommerceAnalytics } from "./FestivalCommerceAnalytics";
import { FestivalRuntimeVendorAssignments } from "./FestivalRuntimeVendorAssignments";
import { asArray, asObject, text, WorkflowState } from "./workflowUtils";

export function FestivalOutcomesManagement({
  editionId,
  scope = "owner",
}: {
  editionId: string;
  scope?: "owner" | "admin";
}) {
  const { data, isLoading, error } = useFestivalEditionOperations(editionId, scope);

  if (isLoading)
    return <WorkflowState title="Loading outcomes" message="Loading performance outcomes…" />;
  if (error)
    return <WorkflowState title="Outcomes unavailable" message={String(error)} variant="destructive" />;

  const outcomes = asArray(asObject(data).outcomes);

  return (
    <div className="space-y-4">
      <FestivalCommerceAnalytics editionId={editionId} />
      <FestivalRuntimeVendorAssignments editionId={editionId} />
      <Card>
        <CardHeader>
          <CardTitle>Edition outcomes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Outcomes pending until canonical performance results exist.
            </p>
          ) : (
            outcomes.map((outcome: any) => (
              <div key={outcome.id} className="rounded border p-2 text-sm">
                <p className="font-medium">
                  Overall score {text(outcome.overall_score)} <Badge>{text(outcome.status)}</Badge>
                </p>
                <p>
                  Audience {text(outcome.audience)} · crowd retention {text(outcome.crowd_retention)} · media{" "}
                  {text(outcome.media_sentiment)} · sponsor {text(outcome.sponsor_sentiment)}
                </p>
                <p className="text-muted-foreground">
                  Highlights {text(outcome.highlights)} · incidents {text(outcome.incidents, "none")} · pending/applied
                  effects {text(outcome.effects)}
                </p>
                <p>Song outcomes: {asArray(outcome.song_outcomes).length}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
