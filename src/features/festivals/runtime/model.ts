import { z } from "zod";

export const runtimeStates = ["preparing", "ready", "gates_open", "live", "paused", "closing", "completed", "aborted", "recovery_required"] as const;
export type FestivalRuntimeState = (typeof runtimeStates)[number];

export const runtimeTransitionTargets: Record<FestivalRuntimeState, readonly FestivalRuntimeState[]> = {
  preparing: ["ready", "aborted"], ready: ["gates_open", "aborted"],
  gates_open: ["live", "recovery_required", "aborted"], live: ["paused", "closing", "recovery_required", "aborted"],
  paused: ["live", "closing", "aborted"], closing: ["completed", "recovery_required"],
  completed: [], aborted: [], recovery_required: ["paused", "live", "aborted"],
};

const readiness = z.object({ ready: z.number().int().nonnegative(), total: z.number().int().nonnegative() });
export const runtimeProjectionSchema = z.object({
  runtimeId: z.string().uuid(), festivalCompanyId: z.string().uuid(), editionId: z.string().uuid(),
  state: z.enum(runtimeStates), version: z.number().int().positive(), simulatedTime: z.string(),
  gates: z.object({ status: z.enum(["closed", "open", "paused"]), queueSize: z.number().int().nonnegative(), waitMinutes: z.number().nonnegative() }),
  attendance: z.object({ expected: z.number().int().nonnegative(), admitted: z.number().int().nonnegative(), onsite: z.number().int().nonnegative(), departed: z.number().int().nonnegative(), capacity: z.number().int().nonnegative() }),
  weather: z.object({ condition: z.string(), temperatureC: z.number(), warning: z.string().nullable() }),
  readiness: z.object({ staff: readiness, suppliers: readiness, sponsors: readiness }),
  stages: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), currentArtist: z.string().nullable(), nextArtist: z.string().nullable(), delayMinutes: z.number().int().nonnegative(), artistReady: z.boolean() })),
  incidents: z.array(z.object({ id: z.string(), category: z.string(), severity: z.string(), status: z.string(), location: z.string(), summary: z.string() })),
  sales: z.object({ foodAndDrinkMinor: z.number().int(), merchandiseMinor: z.number().int() }),
  satisfaction: z.object({ audience: z.number().min(0).max(100), artist: z.number().min(0).max(100) }),
  blockers: z.array(z.object({ code: z.string(), message: z.string() })),
  recentEvents: z.array(z.object({ id: z.string(), occurredAt: z.string(), message: z.string() })),
  permissions: z.object({ role: z.string(), actions: z.array(z.string()) }),
});
export type FestivalRuntimeProjection = z.infer<typeof runtimeProjectionSchema>;

export function assertAudienceConservation(value: FestivalRuntimeProjection): boolean {
  const a = value.attendance;
  return a.onsite + a.departed === a.admitted && a.onsite <= a.capacity && a.admitted <= a.expected;
}
