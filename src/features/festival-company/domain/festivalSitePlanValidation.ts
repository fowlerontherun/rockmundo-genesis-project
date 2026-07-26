import type {
  FestivalSitePlanDraft,
  FestivalScalePlanningLimits,
  FestivalPlanningIssue,
} from "./festivalSitePlan";
export const slugifyStage = (name: string) =>
  name
    .trim()
    .toLocaleLowerCase("en-GB")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
export function validateSitePlanDraft(
  draft: FestivalSitePlanDraft,
  limits: FestivalScalePlanningLimits,
): FestivalPlanningIssue[] {
  const out: FestivalPlanningIssue[] = [];
  const add = (
    code: string,
    section: "site" | "stages",
    field: string | null,
    message: string,
  ) =>
    out.push({
      code,
      severity: "error",
      section,
      field,
      message,
      blocking: true,
    });
  if (!draft.sitePlan.siteName.trim())
    add("site_required", "site", "siteName", "Enter a site name.");
  if (draft.sitePlan.usableCapacity < limits.minimumSiteCapacity)
    add(
      "site_capacity_below_scale_minimum",
      "site",
      "usableCapacity",
      "Capacity is below the scale minimum.",
    );
  if (draft.sitePlan.usableCapacity > limits.maximumSiteCapacity)
    add(
      "site_capacity_above_scale_maximum",
      "site",
      "usableCapacity",
      "Capacity exceeds the scale maximum.",
    );
  if (draft.stages.length < limits.minimumStages)
    add(
      "stage_count_below_minimum",
      "stages",
      null,
      "Add the minimum number of stages.",
    );
  if (draft.stages.length > limits.maximumStages)
    add(
      "stage_count_above_maximum",
      "stages",
      null,
      "Remove stages to meet the scale limit.",
    );
  if (draft.stages.filter((s) => s.stageType === "main").length !== 1)
    add(
      draft.stages.some((s) => s.stageType === "main")
        ? "multiple_main_stages"
        : "main_stage_required",
      "stages",
      null,
      "Exactly one Main Stage is required.",
    );
  draft.stages.forEach((s, i) => {
    if (s.capacity < 1 || s.capacity > draft.sitePlan.usableCapacity)
      add(
        "stage_capacity_invalid",
        "stages",
        `stages.${i}.capacity`,
        "Stage capacity must fit within the site.",
      );
    if (s.accessibleViewingCapacity > s.capacity)
      add(
        "accessible_capacity_invalid",
        "stages",
        `stages.${i}.accessibleViewingCapacity`,
        "Accessible viewing cannot exceed stage capacity.",
      );
    if (s.opensAt >= s.closesAt)
      add(
        "stage_hours_invalid",
        "stages",
        `stages.${i}.opensAt`,
        "Stage closing time must follow opening time.",
      );
    if (
      s.opensAt < draft.sitePlan.dailyOpenTime ||
      s.closesAt > draft.sitePlan.dailyCloseTime
    )
      add(
        "stage_outside_site_hours",
        "stages",
        `stages.${i}.opensAt`,
        "Stage hours must be inside site hours.",
      );
  });
  return out;
}
