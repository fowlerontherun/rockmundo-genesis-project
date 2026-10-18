import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Music2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SavedSet = { id: string; name: string; items: unknown[] };
type BookedSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  setlist_id: string;
};

type Props = { profileId: string; clubId: string; venueTimezone?: string };
const active = new Set(["booked", "ready", "live", "resolving"]);
const isEnabled = import.meta.env.VITE_DJ_SCHEDULED_BOOKINGS_ENABLED === "true";

// The local-time field always uses the *player's* device timezone, while
// the backend validates the resulting UTC instant against venue-local hours.
function localDefault() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 16);
}

async function actionRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("dj-booking-action", { body });
  if (error) {
    let message = error.message;
    const response = (error as { context?: Response }).context;
    if (response?.json) {
      try {
        const payload = await response.json() as { error?: string };
        message = payload.error || message;
      } catch {
        // Keep the SDK error.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error as string);
  if (typeof data?.id !== "string") throw new Error("DJ booking did not return a valid ID");
  return data.id as string;
}

/** Deliberately hidden behind BOTH server and client release switches. */
export function DjBookingPanel({ profileId, clubId, venueTimezone }: Props) {
  const queryClient = useQueryClient();
  const [setlistId, setSetlistId] = useState("");
  const [localStart, setLocalStart] = useState(localDefault);
  const [pending, setPending] = useState<string | null>(null);

  const { data: sets = [], isLoading: setsLoading } = useQuery<SavedSet[]>({
    queryKey: ["dj-saved-setlists", profileId],
    enabled: isEnabled && Boolean(profileId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("dj_setlists")
        .select("id,name,items")
        .eq("profile_id", profileId)
        .order("updated_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data || []) as SavedSet[];
    },
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<BookedSlot[]>({
    queryKey: ["dj-bookings", profileId, clubId],
    enabled: isEnabled && Boolean(profileId) && Boolean(clubId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("dj_bookings")
        .select("id,starts_at,ends_at,status,setlist_id")
        .eq("profile_id", profileId)
        .eq("club_id", clubId)
        .order("starts_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data || []) as BookedSlot[];
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dj-bookings", profileId, clubId] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
      queryClient.invalidateQueries({ queryKey: ["player-schedule"] }),
    ]);
  };

  const reserve = async () => {
    if (pending || !setlistId || !localStart) return;
    const date = new Date(localStart);
    if (!Number.isFinite(date.valueOf())) return toast.error("Choose a valid date and time");
    const saved = sets.find((entry) => entry.id === setlistId);
    if (!saved || !Array.isArray(saved.items) || saved.items.length === 0) {
      return toast.error("Choose a saved set containing at least one playable track");
    }
    setPending("reserve");
    try {
      const id = await actionRequest({
        action: "reserve", profileId, clubId, setlistId,
        startsAt: date.toISOString(), requestId: crypto.randomUUID(),
      });
      await refresh();
      toast.success(`DJ booking requested — ${id.slice(0, 8)}. Check your Schedule.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to book DJ set");
    } finally {
      setPending(null);
    }
  };

  const cancel = async (bookingId: string) => {
    if (pending || !window.confirm("Cancel this scheduled DJ set?")) return;
    setPending(bookingId);
    try {
      await actionRequest({ action: "cancel", bookingId });
      await refresh();
      toast.success("DJ booking cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel DJ set");
    } finally {
      setPending(null);
    }
  };

  if (!isEnabled) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-5 w-5 text-primary" /> Scheduled DJ bookings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Save your set in the mixing studio first. Choose a time in your device's timezone;
          RockMundo checks the nightclub's local hours, travel, classes, rehearsals and gigs
          before accepting the reservation.
          {venueTimezone ? ` Venue timezone: ${venueTimezone}.` : ""}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dj-book-set">Saved DJ set</Label>
            <Select value={setlistId} onValueChange={setSetlistId} disabled={setsLoading}>
              <SelectTrigger id="dj-book-set">
                <SelectValue placeholder={setsLoading ? "Loading sets…" : "Choose saved set"} />
              </SelectTrigger>
              <SelectContent>
                {sets.map((set) => (
                  <SelectItem key={set.id} value={set.id}>
                    {set.name} ({set.items?.length ?? 0} tracks)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dj-book-time">Start time (your local time)</Label>
            <Input id="dj-book-time" type="datetime-local"
              value={localStart} onChange={(event) => setLocalStart(event.target.value)} />
          </div>
        </div>
        <Button disabled={pending !== null || !setlistId} onClick={reserve}>
          {pending === "reserve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
            <CalendarClock className="mr-2 h-4 w-4" />}
          Reserve nightclub DJ slot
        </Button>
        {sets.length === 0 && !setsLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Music2 className="h-4 w-4" /> Create a setlist in the DJ Mixing Studio to book.
          </p>
        )}
        <div className="space-y-2 border-t pt-3">
          <p className="font-medium text-sm">My nightclub bookings</p>
          {bookingsLoading && <p className="text-sm text-muted-foreground">Loading bookings…</p>}
          {!bookingsLoading && bookings.length === 0 && (
            <p className="text-sm text-muted-foreground">No DJ sets booked at this club yet.</p>
          )}
          {bookings.map((booking) => (
            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{new Date(booking.starts_at).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Status: {booking.status}</p>
              </div>
              {active.has(booking.status) && new Date(booking.starts_at).getTime() > Date.now() && (
                <Button size="sm" variant="outline"
                  disabled={pending !== null}
                  onClick={() => cancel(booking.id)}>
                  {pending === booking.id ? "Cancelling…" : "Cancel booking"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
