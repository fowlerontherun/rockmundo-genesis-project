import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useDecideFestivalCityPermit, useMayorFestivalPermitQueue } from "@/hooks/useCityFestivalPermits";

export function MayorFestivalPermitQueue({ cityId }: { cityId: string }) {
  const queue = useMayorFestivalPermitQueue(cityId);
  const decide = useDecideFestivalCityPermit(cityId);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const permits = queue.data ?? [];
  const pending = permits.filter((permit) => permit.status === "pending");

  const act = (permitId: string, decision: "approved" | "rejected") => {
    const reason = reasons[permitId]?.trim() ?? "";
    if (decision === "rejected" && reason.length < 3) {
      toast.error("Add a short reason before rejecting a Festival permit.");
      return;
    }
    decide.mutate(
      { permitId, decision, reason },
      {
        onSuccess: () => toast.success(decision === "approved" ? "Festival permit approved." : "Festival permit rejected."),
        onError: () => toast.error("The Festival permit decision could not be saved."),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Festival permit applications</CardTitle>
            <CardDescription>Applications for annual Festivals hosted in this city. Approval is required only when the law says so.</CardDescription>
          </div>
          <Badge variant={pending.length ? "default" : "outline"}>{pending.length} pending</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {queue.isLoading ? <p className="text-sm text-muted-foreground">Loading permit applications…</p> : null}
        {queue.isError ? <p className="text-sm text-muted-foreground">Festival permit applications could not be loaded.</p> : null}
        {!queue.isLoading && !queue.isError && pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no Festival permit applications awaiting a decision.</p>
        ) : null}
        {pending.map((permit) => (
          <div key={permit.permitId} className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">{permit.festivalName}</div>
                <div className="text-xs text-muted-foreground">
                  {permit.startsOn ?? "Date not set"}{permit.endsOn && permit.endsOn !== permit.startsOn ? ` – ${permit.endsOn}` : ""}
                </div>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
            {permit.applicationNote ? <p className="text-sm">{permit.applicationNote}</p> : null}
            <Textarea
              value={reasons[permit.permitId] ?? ""}
              onChange={(event) => setReasons((current) => ({ ...current, [permit.permitId]: event.target.value }))}
              maxLength={2000}
              placeholder="Optional approval note, or required rejection reason"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={decide.isPending} onClick={() => act(permit.permitId, "approved")}>Approve permit</Button>
              <Button size="sm" variant="destructive" disabled={decide.isPending} onClick={() => act(permit.permitId, "rejected")}>Reject</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
