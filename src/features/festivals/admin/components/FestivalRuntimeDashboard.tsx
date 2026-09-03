import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFestivalEditionOperations } from "@/features/festivals/admin/hooks";

const numberOrZero = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const textOrFallback = (value: unknown, fallback = "Unknown") =>
  typeof value === "string" && value.trim() ? value : fallback;

export function FestivalRuntimeDashboard({ editionId }: { editionId: string }) {
  const operations = useFestivalEditionOperations(editionId, "admin");

  if (operations.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">Loading festival runtime status…</CardContent>
      </Card>
    );
  }

  if (operations.error || !operations.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Festival runtime status unavailable</CardTitle>
          <CardDescription>
            The authoritative edition operations summary could not be loaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {operations.error && (
            <p className="text-sm text-destructive">{String(operations.error)}</p>
          )}
          <Button
            variant="outline"
            onClick={() => void operations.refetch()}
            disabled={operations.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = operations.data;
  const ticketing = data.ticket_summary ?? data.ticketing;
  const schedule = data.schedule_summary;
  const lifecycle = data.lifecycle;
  const ticketsSold = numberOrZero(ticketing?.tickets_sold ?? data.tickets_sold);
  const capacity = numberOrZero(ticketing?.capacity);
  const sellThrough = capacity > 0 ? Math.min(100, Math.round((ticketsSold / capacity) * 100)) : 0;
  const slots = data.slots ?? [];
  const liveSlots = slots.filter((slot) =>
    ["live", "in_progress", "running"].includes(textOrFallback(slot.status, "").toLowerCase()),
  ).length;
  const completedSlots = slots.filter((slot) =>
    ["completed", "finished", "settled"].includes(textOrFallback(slot.status, "").toLowerCase()),
  ).length;
  const blockedSlots = slots.filter((slot) =>
    ["cancelled", "blocked", "invalid"].includes(textOrFallback(slot.status, "").toLowerCase()),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Live operations dashboard</h2>
          <p className="text-sm text-muted-foreground">
            A read-only operational view sourced from the canonical edition summary.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void operations.refetch()}
          disabled={operations.isFetching}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {operations.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lifecycle</CardDescription>
            <CardTitle className="text-2xl">
              {textOrFallback(lifecycle?.status, "Not reported")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {textOrFallback(lifecycle?.start_at, "Start not reported")} → {textOrFallback(lifecycle?.end_at, "End not reported")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tickets sold</CardDescription>
            <CardTitle className="text-2xl">{ticketsSold.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {capacity > 0 ? `${sellThrough}% of ${capacity.toLocaleString()} capacity` : "Capacity not reported"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Schedule occupancy</CardDescription>
            <CardTitle className="text-2xl">
              {numberOrZero(schedule?.occupied_slots)}/{numberOrZero(schedule?.total_slots)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {numberOrZero(schedule?.open_slots)} open · {numberOrZero(schedule?.contracted_acts)} contracted
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Operations</CardDescription>
            <CardTitle className="text-2xl">{data.stages.length} stages</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.staff.length} staff · {data.permit_requirements.length} permit records
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Runtime schedule state</CardTitle>
            <CardDescription>
              Fast operational counts for the selected edition timetable.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border p-3">
              <p className="text-sm text-muted-foreground">Published acts</p>
              <p className="text-2xl font-semibold">{numberOrZero(schedule?.published_acts)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm text-muted-foreground">System acts</p>
              <p className="text-2xl font-semibold">{numberOrZero(schedule?.system_acts)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm text-muted-foreground">Live now</p>
              <p className="text-2xl font-semibold">{liveSlots}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-semibold">{completedSlots}</p>
            </div>
            {blockedSlots > 0 && (
              <div className="rounded border border-destructive/50 p-3 sm:col-span-2">
                <p className="text-sm text-destructive">Cancelled/blocked slots</p>
                <p className="text-2xl font-semibold text-destructive">{blockedSlots}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Management authority</CardTitle>
            <CardDescription>
              Confirms what the canonical operations endpoint allows this admin session to inspect.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>Edition management</span>
              <Badge variant={data.permissions?.can_manage ? "default" : "secondary"}>
                {data.permissions?.can_manage ? "Allowed" : "Limited"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Finance visibility</span>
              <Badge variant={data.finance_access === "granted" ? "default" : "secondary"}>
                {textOrFallback(data.finance_access, "Not reported")}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Data-health visibility</span>
              <Badge variant={data.data_health_access === "granted" ? "default" : "secondary"}>
                {textOrFallback(data.data_health_access, "Not reported")}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Ticket source</span>
              <Badge variant="outline">
                {textOrFallback(ticketing?.source ?? data.ticket_summary_source, "Not reported")}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
