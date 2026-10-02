import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, HeartPulse, Zap } from "lucide-react";
import { toast } from "sonner";
import { createScheduledActivity } from "@/hooks/useActivityBooking";
import { useGameData } from "@/hooks/useGameData";
import { usePracticeSkill, useSkillPracticeRestrictions } from "@/hooks/useSkillPractice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileEntityCard, MobileErrorState, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "./MobilePrimitives";

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

const humanise = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function MobileBook({ profileId, onBack }: { profileId?: string | null; onBack: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { skillProgress } = useGameData();
  const practice = usePracticeSkill();
  const [when, setWhen] = useState(toLocalInputValue(nextWholeHour()));
  const [durationHours, setDurationHours] = useState("1");
  const [bookingRecovery, setBookingRecovery] = useState(false);
  const [skillSlug, setSkillSlug] = useState("");

  const selectedDate = useMemo(() => {
    const parsed = new Date(when);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [when]);
  const restrictions = useSkillPracticeRestrictions(profileId ?? undefined, selectedDate);

  const skillOptions = useMemo(() => (skillProgress ?? [])
    .map((row: any) => ({ slug: String(row?.skill_slug ?? "").trim(), level: Number(row?.current_level ?? 0) }))
    .filter((row) => row.slug && Number.isFinite(row.level) && row.level >= 1)
    .sort((a, b) => b.level - a.level)
    .slice(0, 30), [skillProgress]);

  useEffect(() => {
    if (!skillSlug && skillOptions[0]?.slug) setSkillSlug(skillOptions[0].slug);
  }, [skillOptions, skillSlug]);

  const recoveryWindow = useMemo(() => {
    const start = new Date(when);
    if (Number.isNaN(start.getTime())) return null;
    const hours = Number(durationHours);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return { start, end: new Date(start.getTime() + hours * 60 * 60 * 1000) };
  }, [durationHours, when]);

  const refreshSchedules = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["mobile-day-schedule"] }),
    queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
    queryClient.invalidateQueries({ queryKey: ["week-scheduled-activities"] }),
  ]);

  const bookPractice = () => {
    if (!skillSlug || !when || restrictions.data?.canPractice === false || practice.isPending) return;
    const scheduledStart = new Date(when);
    if (Number.isNaN(scheduledStart.getTime())) return;
    practice.mutate(
      { skillSlug, skillName: humanise(skillSlug), scheduledStart },
      {
        onSuccess: async () => {
          await refreshSchedules();
          toast.success("Practice booked");
          navigate("/mobile");
        },
      },
    );
  };

  const bookRecovery = async () => {
    if (!profileId || !recoveryWindow || bookingRecovery) return;
    setBookingRecovery(true);
    try {
      await createScheduledActivity({
        activityType: "health",
        scheduledStart: recoveryWindow.start,
        scheduledEnd: recoveryWindow.end,
        title: "Recovery time",
        description: "Scheduled personal recovery time",
        metadata: { mobile_booking: true, source: "mobile_companion" },
      });
      await refreshSchedules();
      toast.success("Recovery time booked");
      navigate("/mobile");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recovery time could not be booked");
    } finally {
      setBookingRecovery(false);
    }
  };

  return (
    <MobilePageShell>
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Back to schedule" className="rm-tap flex h-10 w-10 items-center justify-center rounded-full border">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <MobileSectionHeader eyebrow="Companion" title="Book activity" description="Schedule supported daily activities from mobile." />
      </div>

      <MobileSectionCard title="Practice" subtitle="Book a one-hour practice session using a skill already unlocked by this character." action={<MobileStatusBadge tone={restrictions.data?.canPractice === false ? "warning" : "success"}>{restrictions.data?.sessionsRemaining ?? "—"} left</MobileStatusBadge>}>
        {restrictions.isLoading ? <p className="text-sm text-muted-foreground">Checking availability…</p> : restrictions.isError ? <MobileErrorState message="Practice availability could not be checked." onRetry={() => restrictions.refetch()} /> : skillOptions.length === 0 ? <p className="text-sm text-muted-foreground">No unlocked skills are currently available for practice.</p> : <div className="space-y-3">
          {restrictions.data?.canPractice === false && <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{restrictions.data.reason}</p>}
          <label className="block text-sm font-medium">Skill
            <select value={skillSlug} onChange={(event) => setSkillSlug(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3">
              {skillOptions.map((skill) => <option key={skill.slug} value={skill.slug}>{humanise(skill.slug)} · level {skill.level}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Start time
            <Input type="datetime-local" value={when} min={toLocalInputValue(new Date())} onChange={(event) => setWhen(event.target.value)} className="mt-1 min-h-11" />
          </label>
          <Button className="min-h-11 w-full" disabled={!skillSlug || restrictions.data?.canPractice === false || practice.isPending} onClick={bookPractice}>
            <Zap className="mr-2 h-4 w-4" />{practice.isPending ? "Booking…" : "Book practice"}
          </Button>
        </div>}
      </MobileSectionCard>

      <MobileSectionCard title="Recovery time" subtitle="Block recovery time in the same schedule used by desktop.">
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
          <Button variant="outline" className="min-h-11 w-full" disabled={!profileId || !recoveryWindow || bookingRecovery} onClick={bookRecovery}>
            <HeartPulse className="mr-2 h-4 w-4" />{bookingRecovery ? "Booking…" : "Book recovery time"}
          </Button>
        </div>
      </MobileSectionCard>

      <MobileSectionCard title="Schedule" subtitle="Successful bookings immediately appear on the mobile schedule.">
        <MobileEntityCard title="View My Schedule" subtitle="Return to today's booked activities." icon={<CalendarDays className="h-5 w-5" />} onPress={() => navigate("/mobile")} />
      </MobileSectionCard>
    </MobilePageShell>
  );
}

export default MobileBook;
