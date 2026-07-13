import { cn } from "@/lib/utils";
import { PRESENCE_LABELS, type PlayerPresenceState } from "@/services/presenceService";

const COLORS: Record<PlayerPresenceState, string> = {
  online: "bg-emerald-500", idle: "bg-amber-400", busy: "bg-rose-500", travelling: "bg-sky-500", recording: "bg-purple-500", rehearsing: "bg-indigo-500", performing: "bg-pink-500", working: "bg-blue-500", offline: "bg-muted-foreground/40", recently_online: "bg-lime-500",
};

export function PresenceIndicator({ state, className, showLabel = true }: { state: PlayerPresenceState; className?: string; showLabel?: boolean }) {
  return <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)} aria-label={`Presence: ${PRESENCE_LABELS[state]}`}><span className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-background", COLORS[state])} aria-hidden="true" />{showLabel ? PRESENCE_LABELS[state] : <span className="sr-only">{PRESENCE_LABELS[state]}</span>}</span>;
}
