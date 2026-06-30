import { cn } from "@/lib/utils";
import type { HubStat } from "./types";

/**
 * Sidebar that surfaces page-specific KPIs next to the hero tile.
 * Only rendered when a hub explicitly passes real `stats` — never
 * auto-generated, so an empty sidebar never appears.
 */
export const StatsSidebar = ({ stats }: { stats: HubStat[] }) => {
  if (!stats || stats.length === 0) return null;
  return (
    <aside className="hidden lg:flex flex-col border border-fm-border bg-fm-panel-2 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-3 bg-fm-accent rounded-[1px]" />
        <span className="text-fm-accent text-[10px] font-medium tracking-tight">
          At a glance
        </span>
      </div>
      <div className="flex-1 flex flex-col divide-y divide-fm-border">
        {stats.map((s, i) => (
          <div key={i} className={cn("py-2.5", i === 0 && "pt-0")}>
            <div className="text-xl font-medium tabular-nums text-fm-fg leading-none tracking-tight">
              {s.value}
            </div>
            <div className="mt-1 text-[10px] text-fm-fg-muted tracking-tight font-medium">
              {s.label}
            </div>
            {s.hint && (
              <div className="mt-0.5 text-[10px] text-fm-fg-muted/70">{s.hint}</div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};
