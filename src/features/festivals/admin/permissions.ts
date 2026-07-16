import type { PermissionProjection, PermissionRole } from "./types";

export function projectFestivalPermissions(roles: PermissionRole[]): PermissionProjection {
  const has = (role: PermissionRole) => roles.includes(role);
  const admin = has("platform_admin");
  const owner = has("festival_owner");
  const delegated = has("delegated_manager");
  return {
    manageBrand: admin || owner,
    manageEdition: admin || owner || delegated,
    manageLifecycle: admin || owner || has("operations_manager"),
    manageLineup: admin || owner || has("talent_booker"),
    manageFinance: admin || owner || has("finance_manager"),
    manageOperations: admin || owner || delegated || has("operations_manager") || has("stage_manager") || has("safety_officer"),
    viewOutcomes: admin || owner || delegated || has("talent_booker") || has("finance_manager") || has("operations_manager") || has("stage_manager") || has("safety_officer"),
  };
}
