import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ChevronRight } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";

const routeFor = (type?: string | null) => {
  if (!type) return "/schedule/current";
  if (type.includes("travel")) return "/travel";
  if (type.includes("record")) return "/recording-studio";
  if (type.includes("rehears")) return "/rehearsals";
  if (type.includes("song")) return "/songwriting";
  if (type.includes("practice") || type.includes("skill")) return "/stage-practice";
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
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((v) => v + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const active = useMemo(() => {
    if (!activityStatus) return null;
    const status = String((activityStatus as any).status ?? "");
    const endsAt = (activityStatus as any).ends_at as string | null | undefined;
    if (!["active", "in_progress", "scheduled"].includes(status) && (!endsAt || new Date(endsAt).getTime() <= Date.now())) return null;
    return activityStatus as any;
  }, [activityStatus]);

  if (!active) return null;

  const type = String(active.activity_type ?? active.status ?? "Activity");
  const title = String(active.metadata?.title ?? active.metadata?.job_title ?? type.replace(/_/g, " "));

  return (
    <button
      type="button"
      onClick={() => navigate(routeFor(type))}
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
