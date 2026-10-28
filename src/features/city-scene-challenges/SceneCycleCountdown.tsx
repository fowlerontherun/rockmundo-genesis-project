import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Countdown is advisory only. Database cycle boundaries and statuses own truth. */
export function formatSceneTimeRemaining(endsAt: string, nowMs: number): string {
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(endMs) || !Number.isFinite(nowMs)) return 'Deadline unavailable';

  const remaining = Math.max(0, endMs - nowMs);
  if (remaining === 0) return 'Cycle ended';

  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `${minutes}m remaining`;

  const hours = Math.floor(minutes / 60);
  const extraMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${String(extraMinutes).padStart(2, '0')}m remaining`;

  const days = Math.floor(hours / 24);
  const extraHours = hours % 24;
  return `${days}d ${extraHours}h remaining`;
}

/**
 * Find the earliest still-unhandled server cycle deadline. Consumers must
 * remember handled IDs to avoid a re-fetch loop while cron rotates cycles.
 */
export function findNextSceneCycleExpiry(
  cycles: readonly { id: string; ends_at: string }[],
  handled: ReadonlySet<string>,
): { id: string; endsAtMs: number } | null {
  const pending = cycles
    .filter((cycle) => !handled.has(cycle.id))
    .map((cycle) => ({ id: cycle.id, endsAtMs: Date.parse(cycle.ends_at) }))
    .filter((cycle) => Number.isFinite(cycle.endsAtMs))
    .sort((a, b) => a.endsAtMs - b.endsAtMs || a.id.localeCompare(b.id));
  return pending[0] ?? null;
}

/**
 * Low-frequency visual countdown. Always pair with the server-authored UTC
 * deadline: client clocks can be inaccurate and never establish eligibility.
 */
export function SceneCycleCountdown({ endsAt }: { endsAt: string }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  return (
    <Badge variant="secondary" className="gap-1 tabular-nums" aria-live="off">
      <Clock3 className="h-3 w-3" aria-hidden="true" />
      {formatSceneTimeRemaining(endsAt, nowMs)}
    </Badge>
  );
}
