/** Display-only progress. Elapsed booking time never marks a recording complete. */
export function recordingProgress(status: string, start: string | null, end: string | null, now: number) {
  if (status === 'completed') return { label: 'Recording complete', step: 3, percent: 100 };
  if (status === 'failed' || status === 'cancelled') return { label: status === 'failed' ? 'Session failed' : 'Session cancelled', step: -1, percent: null };
  if (status !== 'in_progress') return { label: status === 'scheduled' ? 'Awaiting session start' : 'Session status unavailable', step: status === 'scheduled' ? 0 : -1, percent: null };
  const from = start ? Date.parse(start) : NaN;
  const to = end ? Date.parse(end) : NaN;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return { label: 'Recording in progress', step: 1, percent: null };
  const percent = Math.max(0, Math.min(100, Math.floor(100 * (now - from) / (to - from))));
  return { label: now >= to ? 'Ready to finalise' : 'Recording in progress', step: now >= to ? 2 : 1, percent };
}

export function capacityProgress(sold: number, capacity: number) {
  return Number.isFinite(capacity) && capacity > 0 && Number.isFinite(sold) && sold >= 0
    ? Math.min(100, Math.round(sold / capacity * 100)) : null;
}
