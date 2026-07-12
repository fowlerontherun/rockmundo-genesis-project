export type LifestyleState = "Highly balanced" | "Balanced" | "Busy" | "Unstable" | "Exhausting" | "Unsustainable";
export type BurnoutStage = "Low pressure" | "Building pressure" | "High pressure" | "Burnout warning" | "Mild burnout" | "Severe burnout";
export type RoutineMode = "manual" | "guided" | "assisted" | "managed";
export type PartyIntensity = "quiet" | "casual" | "lively" | "heavy";

export interface LifestyleDayAggregate {
  day: string;
  sleepMinutes: number;
  effectiveSleepMinutes?: number;
  sleepStartHour?: number;
  restMinutes?: number;
  exerciseMinutes?: number;
  nutritionScore?: number;
  hydrationScore?: number;
  socialMinutes?: number;
  partyMinutes?: number;
  alcoholUnits?: number;
  workloadMinutes?: number;
  travelMinutes?: number;
  gigMinutes?: number;
  rehearsalMinutes?: number;
  recordingMinutes?: number;
  professionalSupportMinutes?: number;
  homeRecoveryMinutes?: number;
}

export interface LifestyleProfile {
  sleep_consistency: number; sleep_debt: number; activity_balance: number; exercise_consistency: number;
  nutrition_consistency: number; hydration_consistency: number; social_activity: number; partying_frequency: number;
  alcohol_exposure: number; recovery_discipline: number; workload_intensity: number; downtime_quality: number;
  routine_stability: number; burnout_pressure: number; lifestyle_balance: number; state: LifestyleState;
  burnout_stage: BurnoutStage; identity: string; traits: LifestyleTraitProgress[]; recommendation: string;
}

export interface LifestyleTraitProgress { slug: string; name: string; progress: number; active: boolean; benefit: string; tradeoff: string; }
export interface SleepResult { targetMinutes: number; effectiveMinutes: number; quality: number; debtDelta: number; nextDebt: number; causes: string[]; }
export interface PartyResult { happiness: number; stress: number; fatigue: number; hydration: number; sleepDisruption: number; alcoholExposure: number; networkingChance: number; relationshipChance: number; fameChance: number; costCents: number; readinessPenalty: number; }

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));
const avg = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0) / xs.length : 0;
const sum = (xs: number[]) => xs.reduce((a,b)=>a+b,0);

export const LIFESTYLE_BALANCE = {
  sleepTargetMinutes: 480,
  maxDebt: 100,
  debtMinutesPerPoint: 18,
  maxDebtRecoveryPerDay: 16,
  alcoholExposureCap: 100,
  napEffectivePerDay: 2,
  socialRewardDailyCap: 3,
  traitGainDays: 18,
  traitLoseDays: 14,
  routineBudgetDefaults: { guided: 0, assisted: 5000, managed: 25000 },
  party: {
    quiet: { cost: 0, happiness: 5, stress: -4, fatigue: 2, hydration: -2, sleep: 3, alcohol: 0, networking: 8, relationship: 12, fame: 1, readiness: 1 },
    casual: { cost: 1800, happiness: 8, stress: -6, fatigue: 6, hydration: -8, sleep: 9, alcohol: 12, networking: 14, relationship: 16, fame: 2, readiness: 4 },
    lively: { cost: 4500, happiness: 11, stress: -7, fatigue: 12, hydration: -16, sleep: 18, alcohol: 24, networking: 22, relationship: 20, fame: 4, readiness: 8 },
    heavy: { cost: 9000, happiness: 14, stress: -8, fatigue: 22, hydration: -28, sleep: 34, alcohol: 42, networking: 28, relationship: 22, fame: 6, readiness: 16 },
  },
  burnout: { low: 20, building: 38, high: 55, warning: 70, mild: 82, severe: 94 },
} as const;

export function calculateSleepResult(input: { durationMinutes: number; previousDebt?: number; workloadMinutes?: number; travelMinutes?: number; alcoholExposure?: number; accommodationQuality?: number; startHour?: number; interrupted?: boolean; }): SleepResult {
  const target = LIFESTYLE_BALANCE.sleepTargetMinutes + Math.min(60, Math.round((input.workloadMinutes ?? 0) / 12)) + Math.min(45, Math.round((input.travelMinutes ?? 0) / 16));
  const alcoholPenalty = Math.round((input.alcoholExposure ?? 0) * 0.55);
  const accommodationPenalty = Math.max(0, 70 - (input.accommodationQuality ?? 70)) * 0.35;
  const timingPenalty = input.startHour == null ? 0 : (input.startHour >= 3 && input.startHour <= 8 ? 12 : input.startHour >= 1 ? 6 : 0);
  const interruptionPenalty = input.interrupted ? 25 : 0;
  const quality = clamp(86 - alcoholPenalty - accommodationPenalty - timingPenalty - interruptionPenalty, 20, 100);
  const effectiveMinutes = Math.round(input.durationMinutes * (quality / 100));
  const diff = target - effectiveMinutes;
  const previousDebt = clamp(input.previousDebt ?? 0, 0, LIFESTYLE_BALANCE.maxDebt);
  const rawDelta = diff > 0 ? Math.ceil(diff / LIFESTYLE_BALANCE.debtMinutesPerPoint) : -Math.min(LIFESTYLE_BALANCE.maxDebtRecoveryPerDay, Math.ceil(Math.abs(diff) / 24));
  const nextDebt = clamp(previousDebt + rawDelta, 0, LIFESTYLE_BALANCE.maxDebt);
  const causes = [alcoholPenalty > 0 && "alcohol disrupted sleep", timingPenalty > 0 && "late or irregular timing", accommodationPenalty > 0 && "rough accommodation", interruptionPenalty > 0 && "interrupted sleep", diff > 0 && "below target duration"].filter(Boolean) as string[];
  return { targetMinutes: target, effectiveMinutes, quality, debtDelta: nextDebt - previousDebt, nextDebt, causes };
}

export function calculatePartyResult(intensity: PartyIntensity, opts: { sober?: boolean; repeatedSimilarCount?: number; hoursUntilDemandingActivity?: number } = {}): PartyResult {
  const b = LIFESTYLE_BALANCE.party[intensity];
  const diminishing = Math.max(0.35, 1 - (opts.repeatedSimilarCount ?? 0) * 0.18);
  const soberFactor = opts.sober ? 0.3 : 1;
  const timing = (opts.hoursUntilDemandingActivity ?? 24) < 10 ? 1.35 : 1;
  return { happiness: Math.round(b.happiness * diminishing), stress: Math.round(b.stress * diminishing), fatigue: clamp(b.fatigue * timing, 0, 30), hydration: Math.round(b.hydration * soberFactor), sleepDisruption: Math.round(b.sleep * soberFactor * timing), alcoholExposure: Math.round(b.alcohol * soberFactor), networkingChance: clamp(b.networking * diminishing, 0, 35), relationshipChance: clamp(b.relationship * diminishing, 0, 35), fameChance: clamp(b.fame * diminishing, 0, 8), costCents: opts.sober ? Math.round(b.cost * 0.45) : b.cost, readinessPenalty: clamp(b.readiness * soberFactor * timing, 0, 25) };
}

export function deriveLifestyleProfile(days: LifestyleDayAggregate[], previousTraits: LifestyleTraitProgress[] = []): LifestyleProfile {
  const recent = days.slice(-7); const month = days.slice(-28); const last = days.at(-1);
  const sleepEff = recent.map(d => d.effectiveSleepMinutes ?? d.sleepMinutes);
  const debt = clamp(sum(recent.map(d => Math.max(0, 450 - (d.effectiveSleepMinutes ?? d.sleepMinutes)))) / LIFESTYLE_BALANCE.debtMinutesPerPoint);
  const starts = recent.map(d => d.sleepStartHour).filter((n): n is number => typeof n === 'number');
  const consistency = clamp(100 - (starts.length ? avg(starts.map(h => Math.abs(h - avg(starts)))) * 16 : 15) - debt * 0.35);
  const workload = clamp(avg(recent.map(d => ((d.workloadMinutes ?? 0)+(d.travelMinutes ?? 0)) / 6)));
  const downtime = clamp(avg(recent.map(d => ((d.restMinutes ?? 0)+(d.homeRecoveryMinutes ?? 0)+(d.professionalSupportMinutes ?? 0)) / 3)));
  const social = clamp(avg(recent.map(d => (d.socialMinutes ?? 0) / 3)));
  const party = clamp(avg(recent.map(d => (d.partyMinutes ?? 0) / 2.4)));
  const alcohol = clamp(avg(recent.map(d => (d.alcoholUnits ?? 0) * 12)));
  const recovery = clamp((consistency * .35) + (downtime * .35) + avg(recent.map(d => ((d.hydrationScore ?? 65)+(d.nutritionScore ?? 65))/2)) * .3);
  const balance = clamp(100 - Math.abs(workload - recovery) * .45 - debt * .35 - Math.max(0, party - 55) * .25 + Math.min(12, social * .08));
  const burnout = clamp(workload * .5 + debt * .35 + Math.max(0, 50 - downtime) * .25 + alcohol * .12 - recovery * .18);
  const state: LifestyleState = balance >= 84 ? "Highly balanced" : balance >= 68 ? "Balanced" : burnout < 55 && workload > 58 ? "Busy" : balance >= 45 ? "Unstable" : burnout < 82 ? "Exhausting" : "Unsustainable";
  const burnout_stage: BurnoutStage = burnout >= 94 ? "Severe burnout" : burnout >= 82 ? "Mild burnout" : burnout >= 70 ? "Burnout warning" : burnout >= 55 ? "High pressure" : burnout >= 38 ? "Building pressure" : "Low pressure";
  const traitDefs = [
    ["night_owl","Night owl", avg(month.map(d => d.sleepStartHour ?? 23)) >= 1.5 || avg(month.map(d => d.partyMinutes ?? 0)) > 80, "Late events disrupt sleep less when consistent.", "Morning readiness is slightly weaker."],
    ["disciplined","Disciplined", consistency > 72 && recovery > 68 && party < 45, "More consistent readiness and routine adherence.", "Fewer spontaneous nightlife hooks."],
    ["social_butterfly","Social butterfly", social > 55, "Better relationship and networking rolls.", "Higher spending and isolation stress."],
    ["party_regular","Party regular", party > 58, "More nightlife invitations and social ease.", "More sleep disruption and recovery pressure."],
    ["recovery_conscious","Recovery conscious", recovery > 76 && downtime > 55, "Burnout recovery improves modestly.", "Less time for high-volume work weeks."],
    ["workaholic","Workaholic", workload > 72 && downtime < 45, "Higher short-term workload capacity.", "Burnout pressure rises faster."],
  ] as const;
  const traits = traitDefs.map(([slug,name,activeNow,benefit,tradeoff]) => { const prev = previousTraits.find(t=>t.slug===slug); const progress = clamp((prev?.progress ?? 0) + (activeNow ? 12 : -8)); return { slug, name, progress, active: progress >= 70, benefit, tradeoff }; });
  const identity = state.includes("Balanced") ? "Balanced performer" : party > 60 ? "Nightlife-focused musician" : workload > 72 ? "Exhausted workaholic" : recovery > 74 ? "Recovery-conscious professional" : social > 58 ? "Highly social rising artist" : "Busy working musician";
  const recommendation = burnout >= 70 ? "Plan a rest block before adding demanding bookings." : debt > 35 ? "Protect two steady sleep periods to reduce debt gradually." : party > 65 ? "Keep sober or quiet social options in the next nightlife slot." : workload > recovery + 25 ? "Add downtime around rehearsals, recording or tour travel." : "Routine is sustainable; keep varying recovery, work and social time.";
  return { sleep_consistency: consistency, sleep_debt: debt, activity_balance: balance, exercise_consistency: clamp(avg(recent.map(d => (d.exerciseMinutes ?? 0)/1.8))), nutrition_consistency: clamp(avg(recent.map(d => d.nutritionScore ?? 65))), hydration_consistency: clamp(avg(recent.map(d => d.hydrationScore ?? 65))), social_activity: social, partying_frequency: party, alcohol_exposure: alcohol, recovery_discipline: recovery, workload_intensity: workload, downtime_quality: downtime, routine_stability: consistency, burnout_pressure: burnout, lifestyle_balance: balance, state, burnout_stage, identity, traits, recommendation };
}
