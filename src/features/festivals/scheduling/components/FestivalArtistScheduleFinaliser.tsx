import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchFestivalArtistScheduleQueue,
  finaliseFestivalArtistBookingSlot,
} from "../../admin/lifecycleB5";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(amount / 100);

const slotLabel = (slot: {
  stageName: string;
  slotType: string;
  startAt: string;
}) => `${slot.stageName} · ${slot.slotType} · ${new Date(slot.startAt).toLocaleString()}`;

export function FestivalArtistScheduleFinaliser({ editionId }: { editionId: string }) {
  const qc = useQueryClient();
  const [slotByBooking, setSlotByBooking] = useState<Record<string, string>>({});
  const queryKey = ["festivals", "artist-schedule-queue", editionId] as const;
  const queue = useQuery({
    queryKey,
    queryFn: () => fetchFestivalArtistScheduleQueue(editionId),
  });
  const finalise = useMutation({
    mutationFn: ({ bookingId, stageSlotId }: { bookingId: string; stageSlotId: string }) =>
      finaliseFestivalArtistBookingSlot({
        bookingId,
        stageSlotId,
        idempotencyKey: `artist-schedule:${bookingId}:${stageSlotId}`,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ["festival-schedule", editionId] });
      await qc.invalidateQueries({ queryKey: ["festivals", "admin", "catalogue"] });
    },
  });

  if (queue.isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading accepted artist bookings…</CardContent></Card>;
  }
  if (queue.error || !queue.data) {
    return (
      <Card>
        <CardHeader><CardTitle>Accepted artist bookings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">The accepted-booking scheduling queue could not be loaded.</p>
          <Button variant="outline" onClick={() => queue.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const { bookings, slots } = queue.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accepted artist bookings</CardTitle>
        <CardDescription>
          Finalise an accepted band booking into one canonical signed festival contract and stage slot. The operation is replay-safe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accepted bookings are waiting for a stage slot.</p>
        ) : bookings.map((booking) => {
          const chosen = slotByBooking[booking.id] ?? "";
          return (
            <div key={booking.id} className="grid gap-3 rounded border p-3 lg:grid-cols-[1fr_1.5fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b>{booking.bandName ?? "Accepted artist"}</b>
                  <Badge variant={booking.supported ? "secondary" : "outline"}>{booking.billingPosition}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {booking.setMinutes} min · {money(booking.agreedFeeMinor, booking.currencyCode)}
                </p>
                {!booking.supported && <p className="mt-1 text-xs text-amber-600">{booking.unsupportedReason}</p>}
              </div>
              <Select
                value={chosen}
                disabled={!booking.supported || slots.length === 0 || finalise.isPending}
                onValueChange={(value) => setSlotByBooking((current) => ({ ...current, [booking.id]: value }))}
              >
                <SelectTrigger><SelectValue placeholder={slots.length ? "Choose an open canonical stage slot" : "No open canonical stage slots"} /></SelectTrigger>
                <SelectContent>
                  {slots.map((slot) => <SelectItem key={slot.id} value={slot.id}>{slotLabel(slot)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                disabled={!booking.supported || !chosen || finalise.isPending}
                onClick={() => finalise.mutate({ bookingId: booking.id, stageSlotId: chosen })}
              >
                {finalise.isPending ? "Finalising…" : "Confirm slot"}
              </Button>
            </div>
          );
        })}
        {finalise.error && (
          <p className="text-sm text-destructive">The booking was not changed. Refresh the queue and choose another available slot before retrying.</p>
        )}
      </CardContent>
    </Card>
  );
}
