import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchFestivalArtistScheduleQueue,
  finaliseFestivalArtistBookingSlot,
  setFestivalStageSlotNpcDj,
  type FestivalLineupSlot,
} from "../../admin/lifecycleB5";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(amount / 100);

const slotMinutes = (slot: { startAt: string; endAt: string }) =>
  Math.max(0, Math.round((new Date(slot.endAt).getTime() - new Date(slot.startAt).getTime()) / 60000));

const slotLabel = (slot: {
  stageName: string;
  slotType: string;
  startAt: string;
  endAt: string;
}) => `${slot.stageName} · ${slot.slotType} · ${new Date(slot.startAt).toLocaleString()} · ${slotMinutes(slot)} min`;

const duration = (seconds: number | null | undefined) => {
  const value = Math.abs(Math.round(seconds ?? 0));
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const setlistFitLabel = (slot: FestivalLineupSlot) => {
  if (!slot.hasSetlist) return "No setlist";
  if (slot.remainingSeconds === null) return slot.setlistStatus;
  if (slot.remainingSeconds === 0) return "Matches allocation";
  return slot.remainingSeconds > 0
    ? `${duration(slot.remainingSeconds)} under`
    : `${duration(slot.remainingSeconds)} over`;
};

export function FestivalArtistScheduleFinaliser({ editionId }: { editionId: string }) {
  const qc = useQueryClient();
  const [slotByBooking, setSlotByBooking] = useState<Record<string, string>>({});
  const [djSlotId, setDjSlotId] = useState("");
  const [djName, setDjName] = useState("");
  const [djGenre, setDjGenre] = useState("");
  const [djQuality, setDjQuality] = useState("50");
  const queryKey = ["festivals", "artist-schedule-queue", editionId] as const;
  const queue = useQuery({
    queryKey,
    queryFn: () => fetchFestivalArtistScheduleQueue(editionId),
  });

  const refreshSchedule = async () => {
    await qc.invalidateQueries({ queryKey });
    await qc.invalidateQueries({ queryKey: ["festival-schedule", editionId] });
    await qc.invalidateQueries({ queryKey: ["festivals", "admin", "catalogue"] });
  };

  const finalise = useMutation({
    mutationFn: ({ bookingId, stageSlotId }: { bookingId: string; stageSlotId: string }) =>
      finaliseFestivalArtistBookingSlot({
        bookingId,
        stageSlotId,
        idempotencyKey: `artist-schedule:${bookingId}:${stageSlotId}`,
      }),
    onSuccess: async (_, variables) => {
      setSlotByBooking((current) => ({ ...current, [variables.bookingId]: "" }));
      await refreshSchedule();
      toast.success("Band added to the festival lineup");
    },
  });

  const npcDj = useMutation({
    mutationFn: setFestivalStageSlotNpcDj,
    onSuccess: async (result) => {
      if (result.isNpcDj) {
        setDjSlotId("");
        setDjName("");
        setDjGenre("");
        setDjQuality("50");
        toast.success("NPC DJ added to the lineup");
      } else {
        toast.success("NPC DJ removed from the lineup");
      }
      await refreshSchedule();
    },
    onError: () => toast.error("The NPC DJ slot could not be changed."),
  });

  if (queue.isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading festival lineup…</CardContent></Card>;
  }
  if (queue.error || !queue.data) {
    return (
      <Card>
        <CardHeader><CardTitle>Festival lineup</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">The festival scheduling workspace could not be loaded.</p>
          <Button variant="outline" onClick={() => queue.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const { bookings, slots, lineup } = queue.data;
  const bandLineup = lineup.filter((item) => !item.isNpcDj);
  const djLineup = lineup.filter((item) => item.isNpcDj);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Allocate bands to the lineup</CardTitle>
          <CardDescription>
            Choose a stage slot for each accepted band. The slot determines the stage, performance time and running order. Bands are notified of their agreed set length when confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accepted bookings are waiting for a stage slot.</p>
          ) : bookings.map((booking) => {
            const chosen = slotByBooking[booking.id] ?? "";
            const compatibleSlots = slots.filter((slot) => slotMinutes(slot) >= booking.setMinutes);
            return (
              <div key={booking.id} className="grid gap-3 rounded border p-3 lg:grid-cols-[1fr_1.5fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{booking.bandName ?? "Accepted artist"}</b>
                    <Badge variant={booking.supported ? "secondary" : "outline"}>{booking.billingPosition}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {booking.setMinutes} min set · {money(booking.agreedFeeMinor, booking.currencyCode)}
                  </p>
                  {!booking.supported && <p className="mt-1 text-xs text-amber-600">{booking.unsupportedReason}</p>}
                  {booking.supported && compatibleSlots.length === 0 && slots.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-600">No empty slot is long enough for this agreed set.</p>
                  ) : null}
                </div>
                <Select
                  value={chosen}
                  disabled={!booking.supported || compatibleSlots.length === 0 || finalise.isPending}
                  onValueChange={(value) => setSlotByBooking((current) => ({ ...current, [booking.id]: value }))}
                >
                  <SelectTrigger><SelectValue placeholder={compatibleSlots.length ? "Choose stage and running-order slot" : "No compatible stage slots"} /></SelectTrigger>
                  <SelectContent>
                    {compatibleSlots.map((slot) => <SelectItem key={slot.id} value={slot.id}>{slotLabel(slot)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!booking.supported || !chosen || finalise.isPending}
                  onClick={() => finalise.mutate({ bookingId: booking.id, stageSlotId: chosen })}
                >
                  {finalise.isPending ? "Confirming…" : "Add to lineup"}
                </Button>
              </div>
            );
          })}
          {finalise.error && (
            <p className="text-sm text-destructive">The booking was not changed. Refresh the lineup and choose another available slot before retrying.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confirmed running order</CardTitle>
          <CardDescription>
            Bands are ordered by their stage slot. Setlist readiness shows whether a set has been chosen and how its duration compares with the allocated performance time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lineup.length === 0 ? (
            <p className="text-sm text-muted-foreground">The festival lineup is still empty.</p>
          ) : lineup.map((item) => (
            <div key={item.id} className="grid gap-3 rounded border p-3 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
              <div className="text-sm">
                <div className="font-medium">Day {item.dayNumber} · Slot {item.slotNumber}</div>
                <div className="text-muted-foreground">
                  {new Date(item.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{new Date(item.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b>{item.isNpcDj ? item.npcDjName ?? "Festival DJ" : item.bandName ?? "Band"}</b>
                  <Badge variant="outline">{item.stageName}</Badge>
                  {item.isNpcDj ? <Badge variant="secondary">NPC DJ</Badge> : null}
                </div>
                {item.isNpcDj ? (
                  <p className="text-sm text-muted-foreground">{item.npcDjGenre ?? "Open format"} · quality {item.npcDjQuality ?? 50}/100</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Allocated set: {item.allocatedSetMinutes ?? 0} min</p>
                )}
              </div>
              {item.isNpcDj ? (
                <p className="text-sm text-muted-foreground">Fills this otherwise empty festival slot.</p>
              ) : (
                <div className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.setlistReady ? "secondary" : item.withinAllocation === false ? "destructive" : "outline"}>
                      {item.setlistStatus === "not_set" ? "Not set" : item.setlistStatus.replaceAll("_", " ")}
                    </Badge>
                    <span className={item.withinAllocation === false ? "text-destructive" : "text-muted-foreground"}>{setlistFitLabel(item)}</span>
                  </div>
                  {item.hasSetlist ? (
                    <div className="mt-1 text-muted-foreground">
                      {duration(item.setlistTotalSeconds)} selected / {duration(item.setlistMaximumSeconds)} allocated
                    </div>
                  ) : null}
                </div>
              )}
              {item.isNpcDj ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={npcDj.isPending}
                  onClick={() => npcDj.mutate({ stageSlotId: item.id, enabled: false })}
                >
                  Remove DJ
                </Button>
              ) : <span />}
            </div>
          ))}
          {bandLineup.length > 0 ? (
            <p className="pt-1 text-xs text-muted-foreground">
              A submitted/approved/locked setlist is treated as ready. Draft and missing setlists remain visible so they can be chased before festival day.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fill an empty slot with an NPC DJ</CardTitle>
          <CardDescription>
            Use NPC DJs between live acts or to fill spare stage time. The slot remains available to bands again if the DJ is removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">There are no empty stage slots available.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_8rem_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-sm font-medium">Empty slot</label>
                <Select value={djSlotId} onValueChange={setDjSlotId} disabled={npcDj.isPending}>
                  <SelectTrigger><SelectValue placeholder="Choose an empty stage slot" /></SelectTrigger>
                  <SelectContent>
                    {slots.map((slot) => <SelectItem key={slot.id} value={slot.id}>{slotLabel(slot)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">DJ name</label>
                <Input value={djName} onChange={(event) => setDjName(event.target.value)} placeholder="Festival DJ" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Genre</label>
                <Input value={djGenre} onChange={(event) => setDjGenre(event.target.value)} placeholder="Open format" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Quality</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={djQuality}
                  onChange={(event) => setDjQuality(event.target.value)}
                />
              </div>
              <Button
                disabled={!djSlotId || npcDj.isPending}
                onClick={() => npcDj.mutate({
                  stageSlotId: djSlotId,
                  enabled: true,
                  name: djName,
                  genre: djGenre,
                  quality: Math.max(0, Math.min(100, Number(djQuality) || 50)),
                })}
              >
                {npcDj.isPending ? "Saving…" : "Add DJ"}
              </Button>
            </div>
          )}
          {djLineup.length > 0 ? <p className="text-xs text-muted-foreground">{djLineup.length} NPC DJ slot{djLineup.length === 1 ? "" : "s"} currently scheduled.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
