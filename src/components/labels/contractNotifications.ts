import type { ArtistEntity, ContractWithRelations } from "./types";

export type ContractNotificationCategory =
  | "offer"
  | "expiry"
  | "termination"
  | "bonus"
  | "penalty";

export type ContractNotificationAudience = "player" | "admin";

export type ContractNotificationSeverity = "default" | "warning" | "danger" | "success";

export interface ContractNotification {
  id: string;
  audience: ContractNotificationAudience;
  category: ContractNotificationCategory;
  severity: ContractNotificationSeverity;
  title: string;
  description: string;
  entityName?: string;
  labelName?: string;
  cta?: string;
}

const daysUntil = (dateString?: string | null): number | null => {
  if (!dateString) return null;
  const target = new Date(dateString);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const formatEntityName = (
  contract: ContractWithRelations,
  entityLookup: Map<string, ArtistEntity>,
): string => {
  if (contract.band_id) {
    const bandEntity = entityLookup.get(contract.band_id);
    if (bandEntity) return bandEntity.name;
  }

  if (contract.artist_profile_id) {
    const soloEntity = entityLookup.get(contract.artist_profile_id);
    if (soloEntity) return soloEntity.name;
  }

  return "your roster";
};

const computeRecoupProgress = (contract: ContractWithRelations) => {
  const advanceAmount = contract.advance_amount ?? 0;
  const recouped = contract.recouped_amount ?? 0;
  return advanceAmount > 0 ? Math.min((recouped / advanceAmount) * 100, 150) : 100;
};

export const buildContractNotifications = (
  contracts: ContractWithRelations[],
  entityLookup: Map<string, ArtistEntity>,
) => {
  const playerMessages: ContractNotification[] = [];
  const adminAlerts: ContractNotification[] = [];

  contracts.forEach((contract) => {
    const entityName = formatEntityName(contract, entityLookup);
    const labelName = contract.labels?.name ?? "Unknown label";
    const daysToEnd = daysUntil(contract.end_date);
    const recoupProgress = computeRecoupProgress(contract);
    const releasesRemaining = (contract.release_quota ?? 0) - (contract.releases_completed ?? 0);
    const nearingCloseout = daysToEnd !== null && daysToEnd <= 45;

    if (contract.status === "pending" || contract.status === "offered") {
      const message: ContractNotification = {
        id: `${contract.id}-offer-player`,
        audience: "player",
        category: "offer",
        severity: "warning",
        title: "New label offer available",
        description: `${labelName} sent ${entityName} a contract offer. Review splits and territory before it auto-expires.`,
        entityName,
        labelName,
        cta: "Open contract to review",
      };

      const adminMessage: ContractNotification = {
        id: `${contract.id}-offer-admin`,
        audience: "admin",
        category: "offer",
        severity: "warning",
        title: "Offer awaiting approval",
        description: `${entityName} has a pending deal from ${labelName}. Confirm terms or request revisions before releasing the paperwork.`,
        entityName,
        labelName,
        cta: "Approve or counter",
      };

      playerMessages.push(message);
      adminAlerts.push(adminMessage);
    }

    if (contract.status === "active" && daysToEnd !== null && daysToEnd <= 30) {
      playerMessages.push({
        id: `${contract.id}-expiry-player`,
        audience: "player",
        category: "expiry",
        severity: "warning",
        title: "Contract expiring soon",
        description: `${entityName}'s agreement with ${labelName} ends in ${daysToEnd} days. Decide on renewal or shop new deals.`,
        entityName,
        labelName,
        cta: "Plan renewal path",
      });

      adminAlerts.push({
        id: `${contract.id}-expiry-admin`,
        audience: "admin",
        category: "expiry",
        severity: "warning",
        title: "Renewal decision required",
        description: `${labelName} contract for ${entityName} expires in ${daysToEnd} days. Prep extension paperwork or release letter.`,
        entityName,
        labelName,
        cta: "Lock renewal decision",
      });
    }

    if (contract.status === "terminated") {
      playerMessages.push({
        id: `${contract.id}-terminated-player`,
        audience: "player",
        category: "termination",
        severity: "danger",
        title: "Contract terminated",
        description: `${labelName} marked ${entityName}'s contract as terminated. Clear outstanding balances and secure a new home.`,
        entityName,
        labelName,
        cta: "Review termination terms",
      });

      adminAlerts.push({
        id: `${contract.id}-terminated-admin`,
        audience: "admin",
        category: "termination",
        severity: "danger",
        title: "Termination executed",
        description: `Finalize audits for ${entityName} after ${labelName} termination. Approve severance or clawbacks if required.`,
        entityName,
        labelName,
        cta: "Finalize closeout",
      });
    }

    if (recoupProgress >= 100) {
      playerMessages.push({
        id: `${contract.id}-bonus-player`,
        audience: "player",
        category: "bonus",
        severity: "success",
        title: "Recoupment bonus unlocked",
        description: `${entityName} fully recouped the advance with ${labelName}. Bonus and upside clauses are ready to trigger.`,
        entityName,
        labelName,
        cta: "Claim bonus terms",
      });

      adminAlerts.push({
        id: `${contract.id}-bonus-admin`,
        audience: "admin",
        category: "bonus",
        severity: "success",
        title: "Bonus payout pending approval",
        description: `Approve recoupment bonus for ${entityName}. Validate revenue statements before releasing additional funds.`,
        entityName,
        labelName,
        cta: "Release bonus",
      });
    }

    if (nearingCloseout && releasesRemaining > 0) {
      playerMessages.push({
        id: `${contract.id}-penalty-player`,
        audience: "player",
        category: "penalty",
        severity: "danger",
        title: "Penalty risk: unmet releases",
        description: `${releasesRemaining} release obligation(s) remain for ${entityName} before ${labelName} can close the contract.`,
        entityName,
        labelName,
        cta: "Schedule delivery",
      });

      adminAlerts.push({
        id: `${contract.id}-penalty-admin`,
        audience: "admin",
        category: "penalty",
        severity: "danger",
        title: "Penalty review needed",
        description: `${entityName} is short ${releasesRemaining} release(s) with ${labelName}. Determine penalties or grant an extension.`,
        entityName,
        labelName,
        cta: "Decide on penalties",
      });
    }
  });

  return { playerMessages, adminAlerts };
};
