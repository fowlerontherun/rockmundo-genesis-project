import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, HeartPulse, Plane, Zap } from "lucide-react";
import { toast } from "sonner";
import { createScheduledActivity } from "@/hooks/useActivityBooking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileEntityCard, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "./MobilePrimitives";

function nextWholeHour() {
  const value = new Date();
  value.setMinutes(0, 0, 0);
  value.setHours(value.getHours() + 1);
  return value;
}

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MobileBook({ profileId, onBack }: { profileId?: string | null; onBack: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [when, setWhen] = useState(toLocalInputValue(nextWholeHour()));
  const [durationHours, setDurationHours] = useState("1");
  const [booking, setBooking] = useState(false);

  const recoveryWindow = useMemo(() => {
    const start = new Date(when);
    if (Number.isNaN(start.getTime())) return null;
    const hours = Number(durationHours);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return { start, end: new Date(start.getTime() + hours * 60 * 60 * 1000) };
  }, [durationHours, when]);

  const bookRecovery = async () => {
    if (!profileId || !recoveryWindow || booking) return;
    setBooking(true);
    try {
      await createScheduledActivity({
        activityType: "health",
        scheduledStart: recoveryWindow.start,
        scheduledEnd: recoveryWindow.end,
        title: "Recovery time",
        description: "Scheduled personal recovery time",
        metadata: { mobile_booking: true, source: "mobile_companion" },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-day-schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["week-scheduled-activities"] }),
      ]);
      toast.success("Recovery time booked");
      navigate("/mobile?view=day");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recovery time could not be booked");
    } finally {
      setBooking(false);
    }
  };

  return (
    <MobilePageShell>
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Back to mobile home" className="rm-tap flex h-10 w-10 items-center justify-center rounded-full border">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <MobileSectionHeader eyebrow="Companion" title="Book activity" description="Schedule lightweight daily activities without opening the full desktop game." />
      </div>

      <MobileSectionCard title="Quick bookings" subtitle="These use the same authoritative booking rules and schedule as desktop.">
        <div className="space-y-2">
          <MobileEntityCard title="Practice" subtitle="Book a one-hour skill practice session." icon={<Zap className="h-5 w-5" />} meta={<MobileStatusBadge tone="info">Book</MobileStatusBadge>} onPress={() => navigate("/mobile?view=day#practice")} />
          <MobileEntityCard title="Travel" subtitle="Choose a destination, transport and departure." icon={<Plane className="h-5 w-5" />} meta={<MobileStatusBadge tone="info">Book</MobileStatusBadge>} onPress={() => navigate("/mobile/world/travel")} />
          <MobileEntityCard title="Wellness" subtitle="Choose a recovery or wellness action." icon={<HeartPulse className="h-5 w-5" />} meta={<MobileStatusBadge tone="info">Choose</MobileStatusBadge>} onPress={() => navigate("/mobile/me/wellness")} />
        </div>
      </MobileSectionCard>

      <MobileSectionCard title="Schedule recovery" subtitle="Block recovery time in My Day. Completed recovery uses the existing scheduled health completion rules.">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Start time
            <Input type="datetime-local" value={when} min={toLocalInputValue(new Date())} onChange={(event) => setWhen(event.target.value)} className="mt-1 min-h-11" />
          </label>
          <label className="block text-sm font-medium">Duration
            <select value={durationHours} onChange={(event) => setDurationHours(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3">
              <option value="1">1 hour</option>
              <option value="2">2 hours</option>
              <option value="4">4 hours</option>
            </select>
          </label>
          <Button className="min-h-11 w-full" disabled={!profileId || !recoveryWindow || booking} onClick={bookRecovery}>
            {booking ? "Booking…" : "Book recovery time"}
          </Button>
        </div>
      </MobileSectionCard>

      <MobileSectionCard title="Schedule" subtitle="Bookings immediately appear in the same My Day schedule.">
        <Button variant="outline" className="min-h-11 w-full" onClick={() => navigate("/mobile?view=day")}>
          <CalendarDays className="mr-2 h-4 w-4" /> View My Day
        </Button>
      </MobileSectionCard>

      <p className="px-1 text-xs text-muted-foreground">Detailed gig, recording, rehearsal, release and band-management configuration remains desktop-only. Mobile is for the quick daily loop.</p>
    </MobilePageShell>
  );
}

export default MobileBook;
