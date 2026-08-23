import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useApplyForFestivalCityPermit, useFestivalCityPermit } from "@/hooks/useCityFestivalPermits";

const labels: Record<string, string> = {
  not_ready: "Not ready",
  not_required: "Not required",
  not_applied: "Application needed",
  pending: "Awaiting mayor decision",
  approved: "Approved",
  rejected: "Rejected",
  revoked: "Revoked",
};

export function FestivalCityPermitCard({ editionId }: { editionId: string }) {
  const permit = useFestivalCityPermit(editionId);
  const apply = useApplyForFestivalCityPermit();
  const [note, setNote] = useState("");
  const data = permit.data;

  if (permit.isLoading) {
    return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Checking City Hall permit requirements…</CardContent></Card>;
  }

  if (permit.isError || !data) {
    return <Card><CardContent className="pt-6 text-sm text-muted-foreground">City Hall permit status could not be loaded.</CardContent></Card>;
  }

  const canApply = data.permitRequired && ["not_applied", "rejected", "revoked"].includes(data.status);
  const approved = data.status === "approved";

  return (
    <Card className={approved ? "border-emerald-500/30" : data.permitRequired ? "border-amber-500/30" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>City Festival permit</CardTitle>
            <CardDescription>
              City Hall rules are checked for this Festival's host city and event date before launch.
            </CardDescription>
          </div>
          <Badge variant={approved ? "default" : "outline"}>{labels[data.status] ?? data.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data.permitRequired ? (
          <p className="text-sm text-muted-foreground">The city law effective for this Festival date does not require a permit.</p>
        ) : data.status === "pending" ? (
          <p className="text-sm text-muted-foreground">Your application is with the city's mayor. The Festival cannot launch until it is approved.</p>
        ) : approved ? (
          <p className="text-sm text-muted-foreground">This annual Festival has City Hall approval and can satisfy the permit launch check.</p>
        ) : (
          <p className="text-sm text-muted-foreground">A City Hall permit is required before this annual Festival can launch.</p>
        )}

        {data.decisionReason ? (
          <div className="rounded-md border p-3 text-sm">
            <span className="font-medium">Mayor decision:</span> {data.decisionReason}
          </div>
        ) : null}

        {canApply ? (
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              placeholder="Optional note to City Hall about the Festival, site or safety planning"
            />
            <Button
              disabled={apply.isPending}
              onClick={() => apply.mutate(
                { editionId, applicationNote: note },
                {
                  onSuccess: () => {
                    setNote("");
                    toast.success("Festival permit application sent to City Hall.");
                  },
                  onError: () => toast.error("The Festival permit application could not be submitted."),
                },
              )}
            >
              {apply.isPending ? "Submitting…" : "Apply for City Hall permit"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
