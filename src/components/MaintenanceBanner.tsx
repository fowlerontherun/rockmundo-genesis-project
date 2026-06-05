import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useMaintenanceState } from "@/hooks/useWorldReset";

function formatCountdown(target: Date): string {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "imminent";
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export const MaintenanceBanner = () => {
  const { data } = useMaintenanceState();
  const [, force] = useState(0);

  useEffect(() => {
    if (!data?.is_active) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [data?.is_active]);

  if (!data?.is_active) return null;
  const target = data.scheduled_reset_at ? new Date(data.scheduled_reset_at) : null;

  return (
    <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-semibold">World Reset Scheduled</div>
        <div className="text-xs opacity-90">
          {data.message || "The game world will be reset shortly. All progress will be wiped."}
          {target && (
            <> — resets in <span className="font-mono">{formatCountdown(target)}</span></>
          )}
        </div>
      </div>
    </div>
  );
};
