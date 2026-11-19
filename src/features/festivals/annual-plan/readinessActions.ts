import type { FestivalAnnualPlan } from "./model";

export type ReadinessAction =
  | { kind: "section"; section: "when" | "festival" | "promotion"; label: string }
  | { kind: "licence"; label: string }
  | { kind: "review"; label: string };

const blockerActions: Record<string, ReadinessAction> = {
  festival_dates_required: { kind: "section", section: "when", label: "Choose dates" },
  festival_city_required: { kind: "section", section: "when", label: "Choose city" },
  festival_site_style_required: { kind: "section", section: "festival", label: "Choose site" },
  festival_scale_required: { kind: "section", section: "festival", label: "Choose size" },
  festival_vibe_required: { kind: "section", section: "festival", label: "Choose vibe" },
  festival_marketing_required: { kind: "section", section: "promotion", label: "Choose promotion" },
  festival_licence_required: { kind: "licence", label: "View licence options" },
  festival_licence_capacity_exceeded: { kind: "licence", label: "Review capacity licence" },
  festival_licence_duration_exceeded: { kind: "licence", label: "Review duration licence" },
};

/** Never assume an unknown server blocker can be cleared by editing a specific field. */
export const getReadinessAction = (code: string): ReadinessAction =>
  Object.prototype.hasOwnProperty.call(blockerActions, code)
    ? blockerActions[code]
    : { kind: "review", label: "Review the plan" };

/** A score alone cannot establish readiness when the canonical server still reports blockers. */
export const getAnnualPlanReadinessLabel = (
  plan: Pick<FestivalAnnualPlan, "readinessScore" | "planningStatus" | "blockers">,
): string => {
  if (plan.blockers.length > 0) return "Action required";
  if (plan.planningStatus === "ready" && plan.readinessScore === 100) return "Plan ready";
  if (plan.readinessScore >= 50) return "Taking shape";
  return "Early planning";
};
