export const LIVE_SETUP_WEIGHTS = {
  equipment: 0.6,
  crew: 0.4,
} as const;

export const PERFORMANCE_CREW_ROLES = [
  "Front of House Engineer",
  "Lighting Director",
  "Road Crew Chief",
  "Backline Technician",
] as const;

export const CREW_DEPARTMENTS = {
  show: {
    label: "Show Crew",
    description: "Directly improves your live sound and stage setup.",
    roles: PERFORMANCE_CREW_ROLES,
  },
  touring: {
    label: "Touring Operations",
    description: "Helps the band travel, organise shows and avoid operational problems.",
    roles: ["Tour Manager", "Security Lead"],
  },
  commercial: {
    label: "Commercial & Image",
    description: "Supports merchandise, presentation and other non-performance outcomes.",
    roles: ["Merch Director", "Wardrobe Stylist"],
  },
} as const;

export type CrewDepartmentKey = keyof typeof CREW_DEPARTMENTS;

export interface CrewRoleInfo {
  role: string;
  department: CrewDepartmentKey | "support";
  departmentLabel: string;
  departmentDescription: string;
  affectsLiveSetup: boolean;
  impactLabel: string;
}

const CREW_ROLE_IMPACT: Record<string, string> = {
  "Front of House Engineer": "Live sound",
  "Lighting Director": "Lighting & presentation",
  "Road Crew Chief": "Stage operations",
  "Backline Technician": "Instrument & backline reliability",
  "Tour Manager": "Tour planning & logistics",
  "Security Lead": "Safety & incidents",
  "Merch Director": "Merchandising",
  "Wardrobe Stylist": "Image & presentation",
};

export interface VenueSetupTarget {
  target: number;
  label: "Basic" | "Touring" | "Professional" | "Elite" | "World Class";
}

export interface LiveSetupInput {
  equipmentQuality: number;
  crewSkill: number;
  venueCapacity?: number | null;
}

export interface LiveSetupResult {
  score: number;
  rating: string;
  equipmentScore: number;
  crewScore: number;
  venueTarget: VenueSetupTarget;
  gap: number;
  status: "ready" | "warning" | "critical";
  recommendation: string;
}

export type BandEquipmentSelectionMode = "selected" | "automatic" | "baseline";

export interface BandEquipmentLiveSetupItem {
  id?: string | null;
  equipment_type?: string | null;
  quality_rating?: number | null;
  condition_rating?: number | null;
  is_active?: boolean | null;
}

export interface BandEquipmentLiveSetupSummary {
  score: number;
  selectionMode: BandEquipmentSelectionMode;
  selectedCount: number;
  ownedCount: number;
  selectedIds: string[];
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

export function isPerformanceCrewRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return PERFORMANCE_CREW_ROLES.includes(
    role as (typeof PERFORMANCE_CREW_ROLES)[number],
  );
}

export function getCrewRoleInfo(role: string | null | undefined): CrewRoleInfo {
  const safeRole = role || "Unknown Crew Role";

  for (const [department, config] of Object.entries(CREW_DEPARTMENTS) as Array<
    [CrewDepartmentKey, (typeof CREW_DEPARTMENTS)[CrewDepartmentKey]]
  >) {
    if ((config.roles as readonly string[]).includes(safeRole)) {
      return {
        role: safeRole,
        department,
        departmentLabel: config.label,
        departmentDescription: config.description,
        affectsLiveSetup: department === "show",
        impactLabel: CREW_ROLE_IMPACT[safeRole] || config.label,
      };
    }
  }

  return {
    role: safeRole,
    department: "support",
    departmentLabel: "Band Support",
    departmentDescription: "Supports the band without directly changing the Live Setup score.",
    affectsLiveSetup: false,
    impactLabel: CREW_ROLE_IMPACT[safeRole] || "Band support",
  };
}

export function getBandEquipmentEffectiveScore(item: BandEquipmentLiveSetupItem): number {
  const quality = clamp(Number(item.quality_rating ?? 40));
  const condition = clamp(Number(item.condition_rating ?? 70));
  return Math.round(quality * 0.75 + condition * 0.25);
}

/**
 * Mirrors the authoritative server rule for shared Band Equipment.
 * Explicit Live Setup selections win. If nothing is selected, the best owned
 * item of each equipment type is used automatically so existing bands keep working.
 */
export function resolveBandEquipmentLiveSetup(
  rows: BandEquipmentLiveSetupItem[] | null | undefined,
): BandEquipmentLiveSetupSummary {
  const equipment = rows ?? [];
  if (equipment.length === 0) {
    return {
      score: 40,
      selectionMode: "baseline",
      selectedCount: 0,
      ownedCount: 0,
      selectedIds: [],
    };
  }

  const explicitlySelected = equipment.filter((item) => Boolean(item.is_active));
  let chosen: BandEquipmentLiveSetupItem[];
  let selectionMode: BandEquipmentSelectionMode;

  if (explicitlySelected.length > 0) {
    chosen = explicitlySelected;
    selectionMode = "selected";
  } else {
    const bestByType = new Map<string, BandEquipmentLiveSetupItem>();
    equipment.forEach((item, index) => {
      const type = String(item.equipment_type || `equipment-${index}`).toLowerCase();
      const current = bestByType.get(type);
      if (!current || getBandEquipmentEffectiveScore(item) > getBandEquipmentEffectiveScore(current)) {
        bestByType.set(type, item);
      }
    });
    chosen = [...bestByType.values()];
    selectionMode = "automatic";
  }

  const score = chosen.length > 0
    ? Math.round(chosen.reduce((sum, item) => sum + getBandEquipmentEffectiveScore(item), 0) / chosen.length)
    : 40;

  return {
    score,
    selectionMode,
    selectedCount: chosen.length,
    ownedCount: equipment.length,
    selectedIds: chosen.map((item) => item.id).filter((id): id is string => Boolean(id)),
  };
}

export function getLiveSetupRating(score: number): string {
  const safeScore = clamp(score);
  if (safeScore >= 90) return "World Class";
  if (safeScore >= 80) return "Excellent";
  if (safeScore >= 65) return "Good";
  if (safeScore >= 50) return "Developing";
  return "Needs Work";
}

export function getVenueSetupTarget(capacity = 0): VenueSetupTarget {
  if (capacity <= 150) return { target: 45, label: "Basic" };
  if (capacity <= 500) return { target: 60, label: "Touring" };
  if (capacity <= 1500) return { target: 70, label: "Professional" };
  if (capacity <= 5000) return { target: 82, label: "Elite" };
  return { target: 90, label: "World Class" };
}

export function calculateLiveSetup(input: LiveSetupInput): LiveSetupResult {
  const equipmentScore = Math.round(clamp(input.equipmentQuality));
  const crewScore = Math.round(clamp(input.crewSkill));
  const score = Math.round(
    equipmentScore * LIVE_SETUP_WEIGHTS.equipment +
      crewScore * LIVE_SETUP_WEIGHTS.crew,
  );
  const venueTarget = getVenueSetupTarget(input.venueCapacity ?? 0);
  const gap = score - venueTarget.target;

  let status: LiveSetupResult["status"] = "ready";
  if (gap < -15) status = "critical";
  else if (gap < 0) status = "warning";

  let recommendation = "Your live setup is suitable for this size of show.";
  if (status !== "ready") {
    if (equipmentScore + 5 < crewScore) {
      recommendation = "Upgrade or repair your shared stage equipment first.";
    } else if (crewScore + 5 < equipmentScore) {
      recommendation = "Improve your Show Crew first, especially sound and stage roles.";
    } else {
      recommendation = "Improve both shared equipment and Show Crew before larger shows.";
    }
  }

  return {
    score,
    rating: getLiveSetupRating(score),
    equipmentScore,
    crewScore,
    venueTarget,
    gap,
    status,
    recommendation,
  };
}
