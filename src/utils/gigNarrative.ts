import { EMPTY_GEAR_EFFECTS, type GearModifierEffects } from "@/utils/gearModifiers";

export interface GearOutcomeNarrative {
  attendanceLine?: string;
  revenueLine?: string;
  reliabilityLine?: string;
  fameLine?: string;
}

interface OutcomeLike {
  actual_attendance?: number | null;
  ticket_revenue?: number | null;
  merch_sales?: number | null;
  merch_revenue?: number | null;
  total_revenue?: number | null;
  fame_gained?: number | null;
}

interface BuildNarrativeArgs {
  outcome: OutcomeLike | null | undefined;
  gearEffects?: GearModifierEffects | null | undefined;
  setlistLength?: number;
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const formatCurrency = (value: number): string => {
  return Math.round(value).toLocaleString();
};

const formatPercentBonus = (value: number): string => `+${value.toFixed(1)}%`;
const formatPercentReduction = (value: number): string => `-${Math.abs(value).toFixed(1)}%`;

export const buildGearOutcomeNarrative = ({
  outcome,
  gearEffects,
  setlistLength = 0,
}: BuildNarrativeArgs): GearOutcomeNarrative => {
  const safeEffects = gearEffects ?? EMPTY_GEAR_EFFECTS;
  const attendanceBonus = safeEffects.attendanceBonusPercent ?? 0;
  const revenueBonus = safeEffects.revenueBonusPercent ?? 0;
  const reliabilityReduction = safeEffects.reliabilitySwingReductionPercent ?? 0;
  const fameBonus = safeEffects.fameBonusPercent ?? 0;

  const actualAttendance = toNumber(outcome?.actual_attendance);
  const ticketRevenue = toNumber(outcome?.ticket_revenue);
  const merchRevenue = toNumber(outcome?.merch_sales) || toNumber(outcome?.merch_revenue);
  const totalRevenue = ticketRevenue + merchRevenue || toNumber(outcome?.total_revenue);
  const fameEarned = toNumber(outcome?.fame_gained);

  let attendanceLine: string | undefined;
  if (attendanceBonus > 0) {
    if (actualAttendance > 0) {
      const attendanceMultiplier = 1 + attendanceBonus / 100;
      const baselineAttendance = attendanceMultiplier > 0 ? actualAttendance / attendanceMultiplier : actualAttendance;
      const extraFans = Math.max(0, Math.round(actualAttendance - baselineAttendance));
      attendanceLine = `${formatPercentBonus(attendanceBonus)} crowd energy ≈ ${extraFans} extra fans (actual ${actualAttendance.toLocaleString()}).`;
    } else {
      attendanceLine = `${formatPercentBonus(attendanceBonus)} crowd energy primed the room for a bigger turnout.`;
    }
  }

  let revenueLine: string | undefined;
  if (revenueBonus !== 0) {
    const effectiveTotalRevenue = totalRevenue > 0 ? totalRevenue : ticketRevenue + merchRevenue;
    if (effectiveTotalRevenue > 0) {
      const revenueMultiplier = 1 + revenueBonus / 100;
      const baselineRevenue = revenueMultiplier > 0 ? effectiveTotalRevenue / revenueMultiplier : effectiveTotalRevenue;
      const revenueLift = Math.max(0, effectiveTotalRevenue - baselineRevenue);
      const ticketShare = effectiveTotalRevenue > 0 ? ticketRevenue / effectiveTotalRevenue : 0;
      const merchShare = effectiveTotalRevenue > 0 ? merchRevenue / effectiveTotalRevenue : 0;
      const ticketLift = Math.round(revenueLift * ticketShare);
      const merchLift = Math.round(revenueLift * merchShare);
      const parts: string[] = [];

      if (ticketLift > 0) {
        parts.push(`$${formatCurrency(ticketLift)} tickets`);
      }

      if (merchLift > 0) {
        parts.push(`$${formatCurrency(merchLift)} merch`);
      }

      const breakdown = parts.length ? ` (${parts.join(" + ")})` : "";
      revenueLine = `${formatPercentBonus(revenueBonus)} payout ≈ $${formatCurrency(revenueLift)}${breakdown} this show.`;
    } else {
      revenueLine = `${formatPercentBonus(revenueBonus)} payout potential ready to capitalize on bigger crowds.`;
    }
  }

  let reliabilityLine: string | undefined;
  if (reliabilityReduction > 0) {
    const songContext = setlistLength > 0 ? `across ${setlistLength} songs` : "throughout the set";
    reliabilityLine = `${formatPercentReduction(reliabilityReduction)} swing kept things tight ${songContext}.`;
  }

  let fameLine: string | undefined;
  if (fameBonus > 0) {
    if (fameEarned > 0) {
      const fameMultiplier = 1 + fameBonus / 100;
      const baselineFame = fameMultiplier > 0 ? fameEarned / fameMultiplier : fameEarned;
      const extraFame = Math.max(0, Math.round(fameEarned - baselineFame));
      fameLine = `${formatPercentBonus(fameBonus)} reputation ≈ +${extraFame} extra fame (total +${fameEarned}).`;
    } else {
      fameLine = `${formatPercentBonus(fameBonus)} reputation boost keeps promoters talking even after the show.`;
    }
  }

  return {
    attendanceLine,
    revenueLine,
    reliabilityLine,
    fameLine,
  };
};

export const GEAR_TARGETS = {
  attendanceBonusPercent: 10,
  reliabilitySwingReductionPercent: 5,
  revenueBonusPercent: 8,
  fameBonusPercent: 6,
};
