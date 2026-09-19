import type { TotpRenderItem, TotpRenderPlan } from "./renderSpec";

export interface TotpRenderFrameSelection {
  item: TotpRenderItem;
  programmeMs: number;
  localMs: number;
  progress: number;
}

export function resolveTotpRenderFrame(plan: TotpRenderPlan, programmeMs: number): TotpRenderFrameSelection {
  if (!plan.items.length) throw new Error("The render plan has no programme items.");
  const maximum = Math.max(0, plan.total_duration_ms - 1);
  const time = Math.max(0, Math.min(maximum, Math.floor(programmeMs)));
  const item = plan.items.find((candidate) => time >= candidate.start_ms && time < candidate.start_ms + candidate.duration_ms) ?? plan.items.at(-1)!;
  const localMs = Math.max(0, Math.min(Math.max(0, item.duration_ms - 1), time - item.start_ms));
  return { item, programmeMs: time, localMs, progress: item.duration_ms > 0 ? localMs / item.duration_ms : 0 };
}
