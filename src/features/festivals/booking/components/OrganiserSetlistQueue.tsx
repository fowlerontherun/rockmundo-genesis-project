import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchFestivalArtistScheduleQueue } from "../../admin/lifecycleB5";

const duration = (seconds: number | null | undefined) => {
  const value = Math.abs(Math.round(seconds ?? 0));
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

export function OrganiserSetlistQueue({ editionId }: { editionId?: string }) {
  const queue = useQuery({
    queryKey: ["festivals", "artist-schedule-queue", editionId],
    queryFn: () => fetchFestivalArtistScheduleQueue(editionId ?? ""),
    enabled: Boolean(editionId),
  });

  if (!editionId) {
    return <p className="text-sm text-muted-foreground">Select a festival edition to view band setlist readiness.</p>;
  }

  if (queue.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading festival setlists…</p>;
  }

  if (queue.isError || !queue.data) {
    return (
      <section className="space-y-3">
        <h3 className="font-semibold">Festival setlists</h3>
        <p className="text-sm text-destructive">Setlist readiness could not be loaded.</p>
        <Button variant="outline" size="sm" onClick={() => queue.refetch()}>Retry</Button>
      </section>
    );
  }

  const acts = queue.data.lineup.filter((item) => !item.isNpcDj);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-semibold">Festival setlists</h3>
        <p className="text-sm text-muted-foreground">
          Track whether every scheduled band has chosen a set and whether its running time fits the allocated festival slot.
        </p>
      </div>

      {acts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bands have been allocated to stage slots yet.</p>
      ) : acts.map((act) => {
        const remaining = act.remainingSeconds;
        const fitText = !act.hasSetlist
          ? "Waiting for setlist"
          : remaining === null
            ? "Duration unavailable"
            : remaining === 0
              ? "Matches allocated time"
              : remaining > 0
                ? `${duration(remaining)} under allocated time`
                : `${duration(remaining)} over allocated time`;

        return (
          <div key={act.id} className="grid gap-3 rounded border p-3 md:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <b>{act.bandName ?? "Band"}</b>
                <Badge variant="outline">{act.stageName}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Day {act.dayNumber} · Slot {act.slotNumber} · {new Date(act.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {act.allocatedSetMinutes ?? 0} min set
              </p>
            </div>
            <Badge variant={act.setlistReady ? "secondary" : act.withinAllocation === false ? "destructive" : "outline"} className="w-fit capitalize">
              {act.setlistStatus === "not_set" ? "Not set" : act.setlistStatus.replace(/_/g, " ")}
            </Badge>
            <div className={act.withinAllocation === false ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              <div>{fitText}</div>
              {act.hasSetlist ? (
                <div>{duration(act.setlistTotalSeconds)} selected / {duration(act.setlistMaximumSeconds)} allocated</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}
