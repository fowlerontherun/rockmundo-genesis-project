import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ChevronRight } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useScheduledActivities } from "@/hooks/useScheduledActivities";
import { resolveCompanionPath } from "@/mobile/routeRegistry";

const routeFor = (type?: string | null) => {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized.includes("travel")) return "/travel";
  if (normalized.includes("practice") || normalized.includes("skill")) return "/stage-practice";
  if (normalized.includes("wellness") || normalized.includes("health") || normalized.includes("sleep") || normalized.includes("rest")) return "/wellness";
  if (normalized.includes("message") || normalized.includes("mail") || normalized.includes("social")) return "/inbox";
  return "/schedule/current";
};

const formatRemaining = (endsAt?: string | null) => {
  if (!endsAt) return "In progress";
  const diff = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "Wrapping up";
  const minutes = Math.ceil(diff / 60000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
  return `${minutes}m remaining`;
};

export const MobileActivityBar = () => {
  const navigate = useNavigate();
  const { activityStatus } = useGameData();
  const { userId } = useActiveProfile();
  const today = useScheduledActivities(new Date(), userId ?? undefined);
  const [clock, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((v) => v + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const active = useMemo(() => {
    const now = Date.now();

    // Prefer the canonical merged schedule. A "scheduled" row is only current when
    // its actual start/end window contains the current time.
    const scheduledNow = (today.data ?? []).find((activity) => {
      const starts = new Date(activity.scheduled_start).getTime();
      const ends = new Date(activity.scheduled_end).getTime();
      return Number.isFinite(starts)
        && Number.isFinite(ends)
        && starts <= now
        && ends > now
        && ["scheduled", "in_progress"].includes(activity.status);
    });

    if (scheduledNow) {
      return {
        activity_type: scheduledNow.activity_type,
        title: scheduledNow.title,
        started_at: scheduledNow.scheduled_start,
        ends_at: scheduledNow.scheduled_end,
      };
    }

    // Legacy status is a fallback only for genuinely active rows. Never display a
    // future/scheduled or already-ended status as the player's current activity.
    if (!activityStatus) return null;
    const status = String((activityStatus as any).status ?? "");
    if (!["active", "in_progress"].includes(status)) return null;

    const startedAt = (activityStatus as any).started_at as string | null | undefined;
    const endsAt = (activityStatus as any).ends_at as string | null | undefined;
    const startMs = startedAt ? new Date(startedAt).getTime() : NaN;
    const endMs = endsAt ? new Date(endsAt).getTime() : NaN;

    if (Number.isFinite(startMs) && startMs > now) return null;
    if (Number.isFinite(endMs) && endMs <= now) return null;

    return activityStatus as any;
  }, [activityStatus, today.data, clock]);

  if (!active) return null;

  const type = String(active.activity_type ?? "Activity");
  const title = String(active.title ?? active.metadata?.title ?? active.metadata?.job_title ?? type.replace(/_/g, " "));

  return (
    <button
      type="button"
      onClick={() => navigate(resolveCompanionPath(routeFor(type)))}
      className="fixed inset-x-3 z-30 flex min-h-12 items-center gap-3 rounded-2xl border border-primary/30 bg-background/95 px-3 py-2 text-left shadow-lg backdrop-blur active:scale-[0.99]"
      style={{ bottom: "calc(var(--m-nav-h) + var(--m-safe-b) + 10px)" }}
      aria-label={`Current activity: ${title}, ${formatRemaining(active.ends_at)}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Clock className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold capitalize">{title}</span><span className="block text-xs text-muted-foreground">{formatRemaining(active.ends_at)}</span></span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};
