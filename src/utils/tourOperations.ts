import { getVehicleTier, type VehicleTier } from "@/lib/tourVehicles";
import { calculateTourLoadState, calculateTravelFatigueEffect, getTransportWellnessProfile, resolveAccommodationRecoveryProfile, type TourLoadState } from "@/lib/wellnessRecovery";
import { calculateTravelCost, calculateTicketPrice, estimateTicketSalesPercent } from "@/utils/tourCalculations";

export type TourIssueSeverity = "info" | "warning" | "critical";
export type TourEventType = "vehicle_breakdown" | "flight_delay" | "lost_luggage" | "food_poisoning" | "sponsor_dinner" | "fan_meet_greet" | "local_media_interview" | "weather_delay" | "customs_inspection" | "equipment_delivery_issue" | "unexpected_upgrade" | "hotel_overbooking";
export type SponsorObligationType = "meet_fans" | "social_post" | "vip_appearance" | "interview" | "merch_promotion";

export interface TourStop { id: string; cityId: string; cityName: string; region?: string; country: string; venueId: string; venueName: string; capacity: number; scheduledAt: string; doorsAt?: string; loadInAt?: string; setupHours?: number; breakdownHours?: number; distanceFromPreviousKm?: number; guarantee?: number; doorSplit?: number; ticketPrice?: number; venuePenalty?: number; status?: "planned" | "completed" | "cancelled"; rating?: number; crowdEnergy?: number; ticketsSold?: number; }
export interface TourCrewMember { id: string; name: string; role: string; dailyCost: number; fatigue: number; morale: number; experience: number; shiftHours?: number; realPlayer?: boolean; hasAccommodation?: boolean; inTransit?: boolean; }
export interface TourEquipmentItem { id: string; name: string; role: string; weight: number; condition: number; isSpare?: boolean; inTransit?: boolean; needsRepair?: boolean; replacementCost?: number; }
export interface MerchandisePlan { startingStock: number; unitCost: number; unitPrice: number; reorderQuantity?: number; reorderCost?: number; shippingCost?: number; storageCostPerDay?: number; }
export interface SponsorObligation { id: string; type: SponsorObligationType; dueStopId?: string; value: number; completed?: boolean; ignored?: boolean; }
export interface TourTemplate { id: string; name: string; preferredCrewRoles: string[]; productionPackage: string; vehicleTier: VehicleTier; accommodationPreference: "budget" | "standard" | "comfort" | "premium"; equipmentRoles: string[]; rehearsalDaysBeforeStart: number; cateringPreference: "none" | "basic" | "healthy" | "premium"; backupEquipmentRoles: string[]; lightingPackage: string; audioPackage: string; }
export interface TourOperationsInput { tourId: string; bandFame: number; bandFans: number; currentCityId: string; stops: TourStop[]; crew: TourCrewMember[]; equipment: TourEquipmentItem[]; vehicleTier: VehicleTier; merch: MerchandisePlan; sponsorObligations?: SponsorObligation[]; startingBudget?: number; accommodationQuality?: "none" | "budget" | "standard" | "comfort" | "premium"; restDays?: string[]; completedStopIds?: string[]; seed?: number; }
export interface TourBudget { income: Record<string, number>; costs: Record<string, number>; totalIncome: number; totalCosts: number; profit: number; rollingBudget: number; }
export interface TourIssue { severity: TourIssueSeverity; code: string; message: string; stopId?: string; }
export interface TourStats { attendance: number; revenue: number; profit: number; averageRating: number; averageCrowdEnergy: number; fanGrowth: number; citiesVisited: number; distanceTravelledKm: number; merchandiseSold: number; equipmentFailures: number; crewInterventions: number; tourReputation: number; }
export interface TourWellnessForecast { tourLoadState: TourLoadState; tourLoadScore: number; estimatedGigReadiness: number; predictedTravelFatigue: number; expectedSleepOpportunities: number; highRiskSegments: string[]; recommendations: string[]; accommodationRecoveryScore: number; transportRecoveryScore: number; }
export interface TourHQSummary { currentCity: string; nextVenue: string | null; remainingShows: number; mapStops: Array<{ cityName: string; venueName: string; status: string }>; calendar: Array<{ date: string; label: string }>; budget: TourBudget; crew: { total: number; fatigued: number; morale: number; dailyCost: number }; vehicles: { tier: VehicleTier; capacity: number; comfort: number; fuelLevel: number; repairsRequired: boolean }; equipment: { total: number; inTransit: number; needsRepair: number; spares: number; loadWeight: number; capacityOk: boolean }; accommodation: { quality: string; roomsRequired: number; nightlyCost: number }; fatigue: number; health: number; productionStatus: "ready" | "at_risk" | "blocked"; outstandingIssues: TourIssue[]; sponsorObligations: { total: number; completed: number; ignored: number }; merchandise: { stockRemaining: number; sold: number; lostSales: number; sellThroughPct: number }; tourReputation: number; tourMomentum: number; stats: TourStats; wellnessForecast: TourWellnessForecast; }

const ACCOMMODATION = { none: { cost: 0, morale: -8, recovery: -4 }, budget: { cost: 45, morale: -3, recovery: 0 }, standard: { cost: 85, morale: 2, recovery: 4 }, comfort: { cost: 140, morale: 6, recovery: 8 }, premium: { cost: 260, morale: 10, recovery: 12 } } as const;
const haulCapacityKg: Record<string, number> = { minimal: 250, small: 650, medium: 1400, large: 3200, massive: 9000, unlimited: 999999 };
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 36e5 / 24;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function validateTourSchedule(stops: TourStop[], vehicleTier: VehicleTier): TourIssue[] {
  const issues: TourIssue[] = [];
  const vehicle = getVehicleTier(vehicleTier);
  const sorted = [...stops].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  for (let i = 0; i < sorted.length; i++) {
    const stop = sorted[i]!;
    const setup = stop.setupHours ?? 4;
    const loadIn = stop.loadInAt ? new Date(stop.loadInAt) : new Date(new Date(stop.scheduledAt).getTime() - setup * 36e5);
    if (loadIn.getTime() + setup * 36e5 > new Date(stop.scheduledAt).getTime()) issues.push({ severity: "critical", code: "setup_time", message: `${stop.venueName} does not have enough setup time.`, stopId: stop.id });
    const next = sorted[i + 1];
    if (!next) continue;
    const gapHours = (new Date(next.scheduledAt).getTime() - new Date(stop.scheduledAt).getTime()) / 36e5;
    if (gapHours < 3) issues.push({ severity: "critical", code: "overlap", message: `${stop.venueName} overlaps with ${next.venueName}.`, stopId: next.id });
    const distance = next.distanceFromPreviousKm ?? 500;
    const travel = calculateTravelCost(distance, vehicle.speed === "fastest" ? "plane" : "tour_bus").durationHours;
    const required = travel + (stop.breakdownHours ?? 2) + (next.setupHours ?? 4) + (travel > 8 ? 8 : 0);
    if (gapHours < required) issues.push({ severity: "critical", code: "travel_time", message: `No safe travel/setup window from ${stop.cityName} to ${next.cityName}. Need ${Math.ceil(required)}h, have ${Math.floor(gapHours)}h.`, stopId: next.id });
    if (gapHours < required + 8) issues.push({ severity: "warning", code: "rest_window", message: `Tight rest window before ${next.venueName}; fatigue will accumulate.`, stopId: next.id });
  }
  return issues;
}

export function calculateTourBudget(input: TourOperationsInput): TourBudget {
  const completed = new Set(input.completedStopIds ?? input.stops.filter((s) => s.status === "completed").map((s) => s.id));
  const vehicle = getVehicleTier(input.vehicleTier);
  const attendance = input.stops.map((s) => s.ticketsSold ?? Math.round(s.capacity * estimateTicketSalesPercent(s.capacity, input.bandFans, input.bandFame)));
  const ticket = sum(input.stops.map((s, i) => completed.has(s.id) ? Math.round((s.guarantee ?? 0) + attendance[i]! * (s.ticketPrice ?? calculateTicketPrice(s.capacity, input.bandFame)) * (s.doorSplit ?? 0.55)) : 0));
  const merchSold = Math.min(input.merch.startingStock, Math.round(sum(attendance) * 0.22));
  const sponsor = sum((input.sponsorObligations ?? []).filter((o) => !o.ignored).map((o) => o.value));
  const travelKm = sum(input.stops.slice(1).map((s) => s.distanceFromPreviousKm ?? 500));
  const nights = Math.max(1, Math.ceil(daysBetween(input.stops[0]?.scheduledAt ?? new Date().toISOString(), input.stops.at(-1)?.scheduledAt ?? new Date().toISOString())));
  const rooms = Math.ceil((input.crew.length + 4) / 2);
  const accommodation = ACCOMMODATION[input.accommodationQuality ?? "standard"].cost * rooms * nights;
  const costs = { hotels: accommodation, fuel: Math.round(travelKm * 0.32), flights: vehicle.speed === "fastest" ? input.crew.length * Math.round(travelKm * 0.18) : 0, ferries: 0, crewWages: sum(input.crew.map((c) => c.dailyCost)) * nights, vehicleHire: vehicle.dailyCost * nights, repairs: sum(input.equipment.filter((e) => e.needsRepair || e.condition < 45).map((e) => Math.round((e.replacementCost ?? 500) * 0.18))), catering: (input.crew.length + 4) * 22 * nights, venuePenalties: sum(input.stops.map((s) => s.venuePenalty ?? 0)), marketing: input.stops.length * 120, insurance: Math.round(sum(input.equipment.map((e) => e.replacementCost ?? 500)) * 0.015), equipmentRental: 0, merchandise: merchSold * input.merch.unitCost + (input.merch.shippingCost ?? 0) + (input.merch.storageCostPerDay ?? 0) * nights };
  const income = { ticketGuarantees: sum(input.stops.filter((s) => completed.has(s.id)).map((s) => s.guarantee ?? 0)), doorSplit: ticket, merchandise: merchSold * input.merch.unitPrice, sponsorship: sponsor, vipPackages: Math.round(ticket * 0.08) };
  const totalIncome = sum(Object.values(income)); const totalCosts = sum(Object.values(costs));
  return { income, costs, totalIncome, totalCosts, profit: totalIncome - totalCosts, rollingBudget: (input.startingBudget ?? 0) + totalIncome - totalCosts };
}

export function buildTourHQ(input: TourOperationsInput): TourHQSummary {
  const sorted = [...input.stops].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const completed = new Set(input.completedStopIds ?? sorted.filter((s) => s.status === "completed").map((s) => s.id));
  const next = sorted.find((s) => !completed.has(s.id));
  const vehicle = getVehicleTier(input.vehicleTier);
  const loadWeight = sum(input.equipment.map((e) => e.weight));
  const capacityOk = loadWeight <= haulCapacityKg[vehicle.gearHaulCapacity];
  const issues = validateTourSchedule(sorted, input.vehicleTier);
  if (!capacityOk) issues.push({ severity: "critical", code: "vehicle_capacity", message: "Equipment load exceeds vehicle haul capacity." });
  const avgCrewFatigue = input.crew.length ? sum(input.crew.map((c) => c.fatigue)) / input.crew.length : 0;
  const restDays = input.restDays?.length ?? 0;
  const consecutivePressure = Math.max(0, sorted.length - restDays * 2) * 3;
  const accommodation = ACCOMMODATION[input.accommodationQuality ?? "standard"];
  const recoveryProfile = resolveAccommodationRecoveryProfile({ kind: input.accommodationQuality === "none" ? "none" : "hotel", tier: input.accommodationQuality ?? "standard", occupied: true, quality: 45 + accommodation.recovery * 4, pricePerNightCents: accommodation.cost * 100 });
  const transportProfile = getTransportWellnessProfile(input.vehicleTier);
  const travelEffects = sorted.slice(1).map((s) => calculateTravelFatigueEffect({ id: `${input.tourId}:${s.id}`, durationHours: Math.max(1, (s.distanceFromPreviousKm ?? 500) / Math.max(60, vehicle.speed === "fastest" ? 700 : vehicle.speed === "fast" ? 180 : 80)), distanceKm: s.distanceFromPreviousKm ?? 500, vehicleTier: input.vehicleTier }));
  const tourLoad = calculateTourLoadState({ travelHours: sum(travelEffects.map((e) => Math.max(0, e.fatigueDelta))), distanceKm: sum(sorted.slice(1).map((s) => s.distanceFromPreviousKm ?? 500)), consecutiveNightsAway: Math.max(0, sorted.length - 1), consecutiveGigs: sorted.length, restDays, accommodationScore: recoveryProfile.comfort_rating, transportComfort: transportProfile.travel_comfort });
  const fatigue = clamp(avgCrewFatigue + consecutivePressure + sum(travelEffects.map((e) => e.fatigueDelta)) - accommodation.recovery - restDays * 4);
  const morale = clamp((input.crew.length ? sum(input.crew.map((c) => c.morale)) / input.crew.length : 70) + vehicle.moralBoost + accommodation.morale + (calculateTourBudget(input).profit > 0 ? 5 : -5));
  const merchandiseSold = Math.min(input.merch.startingStock, Math.round(sum(sorted.map((s) => s.ticketsSold ?? s.capacity * 0.55)) * 0.22));
  const lostSales = Math.max(0, Math.round(sum(sorted.map((s) => s.capacity * 0.55)) * 0.22) - input.merch.startingStock);
  const budget = calculateTourBudget(input);
  const stats: TourStats = { attendance: sum(sorted.map((s) => s.ticketsSold ?? 0)), revenue: budget.totalIncome, profit: budget.profit, averageRating: sum(sorted.filter((s) => s.rating).map((s) => s.rating!)) / Math.max(1, sorted.filter((s) => s.rating).length), averageCrowdEnergy: sum(sorted.filter((s) => s.crowdEnergy).map((s) => s.crowdEnergy!)) / Math.max(1, sorted.filter((s) => s.crowdEnergy).length), fanGrowth: Math.round(Math.max(0, budget.profit / 100) + morale / 2), citiesVisited: new Set(sorted.filter((s) => completed.has(s.id)).map((s) => s.cityId)).size, distanceTravelledKm: sum(sorted.slice(1).map((s) => s.distanceFromPreviousKm ?? 500)), merchandiseSold, equipmentFailures: input.equipment.filter((e) => e.condition < 35).length, crewInterventions: issues.filter((i) => i.code.includes("crew") || i.code.includes("rest")).length, tourReputation: clamp(50 + morale * 0.25 - fatigue * 0.2 + budget.profit / 1000) };
  const wellnessForecast: TourWellnessForecast = { tourLoadState: tourLoad.state, tourLoadScore: tourLoad.score, estimatedGigReadiness: clamp((100 - fatigue) * tourLoad.performanceModifier), predictedTravelFatigue: Math.round(sum(travelEffects.map((e) => e.fatigueDelta))), expectedSleepOpportunities: Math.round(sum(travelEffects.map((e) => e.partialSleepHours)) + Math.max(0, sorted.length - 1) * (recoveryProfile.tier === "none" ? 0 : 7)), highRiskSegments: travelEffects.filter((e) => e.fatigueDelta >= 14 || e.arrivalReadiness < 55).map((e) => e.idempotencyKey.replace("travel-fatigue:", "")), recommendations: [
    ...(tourLoad.needsRest ? ["Add a rest day before the next demanding segment."] : []),
    ...(recoveryProfile.tier === "none" || recoveryProfile.tier === "basic" ? ["Book standard accommodation before back-to-back gigs."] : []),
    ...(transportProfile.sleep_capability < 35 && travelEffects.some((e) => e.fatigueDelta > 10) ? ["Avoid overnight van travel or add sleeping facilities."] : []),
    ...(fatigue > 65 ? ["Schedule massage, sleep or a low-demand recovery activity."] : []),
  ], accommodationRecoveryScore: Math.round((recoveryProfile.comfort_rating + recoveryProfile.cleanliness_rating + recoveryProfile.safety_rating) / 3), transportRecoveryScore: Math.round((transportProfile.travel_comfort + transportProfile.sleep_capability + transportProfile.recovery_efficiency) / 3) };
  return { currentCity: sorted.find((s) => s.cityId === input.currentCityId)?.cityName ?? sorted[0]?.cityName ?? "Unknown", nextVenue: next?.venueName ?? null, remainingShows: sorted.filter((s) => !completed.has(s.id)).length, mapStops: sorted.map((s) => ({ cityName: s.cityName, venueName: s.venueName, status: completed.has(s.id) ? "completed" : s.id === next?.id ? "next" : "planned" })), calendar: sorted.map((s) => ({ date: s.scheduledAt, label: `${s.cityName} — ${s.venueName}` })), budget, crew: { total: input.crew.length, fatigued: input.crew.filter((c) => c.fatigue >= 65).length, morale, dailyCost: sum(input.crew.map((c) => c.dailyCost)) }, vehicles: { tier: input.vehicleTier, capacity: vehicle.capacity, comfort: vehicle.comfort, fuelLevel: clamp(100 - stats.distanceTravelledKm / 50), repairsRequired: vehicle.breakdownChance > 0.07 || issues.some((i) => i.code === "travel_time") }, equipment: { total: input.equipment.length, inTransit: input.equipment.filter((e) => e.inTransit).length, needsRepair: input.equipment.filter((e) => e.needsRepair || e.condition < 45).length, spares: input.equipment.filter((e) => e.isSpare).length, loadWeight, capacityOk }, accommodation: { quality: input.accommodationQuality ?? "standard", roomsRequired: Math.ceil((input.crew.length + 4) / 2), nightlyCost: accommodation.cost }, fatigue, health: clamp(100 - fatigue * 0.55), productionStatus: issues.some((i) => i.severity === "critical") ? "blocked" : issues.length ? "at_risk" : "ready", outstandingIssues: issues, sponsorObligations: { total: input.sponsorObligations?.length ?? 0, completed: (input.sponsorObligations ?? []).filter((o) => o.completed).length, ignored: (input.sponsorObligations ?? []).filter((o) => o.ignored).length }, merchandise: { stockRemaining: input.merch.startingStock - merchandiseSold, sold: merchandiseSold, lostSales, sellThroughPct: Math.round((merchandiseSold / Math.max(1, input.merch.startingStock)) * 100) }, tourReputation: stats.tourReputation, tourMomentum: clamp(50 + morale * 0.2 - fatigue * 0.25 + (budget.profit > 0 ? 10 : -10)), stats, wellnessForecast };
}

export function generateTourEvent(input: TourOperationsInput): { type: TourEventType; severity: TourIssueSeverity; message: string; costImpact: number; fatigueImpact: number; moraleImpact: number } | null {
  const hq = buildTourHQ(input);
  const risk = (100 - hq.health) + hq.outstandingIssues.length * 12 + (hq.vehicles.repairsRequired ? 20 : 0) + (hq.equipment.needsRepair * 8);
  if (risk < 35) return null;
  if (hq.vehicles.repairsRequired) return { type: "vehicle_breakdown", severity: "critical", message: "A vehicle breakdown delays load-in and creates repair costs.", costImpact: 650, fatigueImpact: 8, moraleImpact: -6 };
  if (hq.equipment.needsRepair > hq.equipment.spares) return { type: "equipment_delivery_issue", severity: "warning", message: "Backline issues force a rushed repair or local rental.", costImpact: 300, fatigueImpact: 4, moraleImpact: -3 };
  return { type: "sponsor_dinner", severity: "info", message: "A sponsor dinner can improve partner confidence but costs recovery time.", costImpact: 0, fatigueImpact: 3, moraleImpact: 2 };
}

export function completeTourReport(input: TourOperationsInput) {
  const hq = buildTourHQ(input);
  const completed = input.stops.filter((s) => (input.completedStopIds ?? []).includes(s.id) || s.status === "completed");
  const byProfit = [...completed].sort((a, b) => ((b.ticketsSold ?? 0) * (b.ticketPrice ?? 0)) - ((a.ticketsSold ?? 0) * (a.ticketPrice ?? 0)));
  const byRating = [...completed].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return { financialPerformance: hq.budget, reputationGained: Math.round(Math.max(0, hq.tourReputation - 50)), fansGained: hq.stats.fanGrowth, crewPerformance: hq.crew, equipmentWear: hq.equipment, vehicleUsage: hq.vehicles, tourHighlights: hq.outstandingIssues.length ? hq.outstandingIssues.map((i) => i.message) : ["Tour completed without major logistics incidents."], bestGig: byRating[0]?.venueName ?? null, worstGig: byRating.at(-1)?.venueName ?? null, mostProfitableCity: byProfit[0]?.cityName ?? null, strongestAudience: [...completed].sort((a, b) => (b.crowdEnergy ?? 0) - (a.crowdEnergy ?? 0))[0]?.cityName ?? null, biggestMediaStory: hq.tourReputation >= 70 ? "Strong routing and morale turned the tour into a regional reputation win." : "Logistics lessons define the post-tour coverage.", futurePlanning: { bookingOfferModifier: Math.round(hq.tourReputation - 50), sponsorshipModifier: hq.sponsorObligations.ignored ? -10 : 8, venueConfidence: hq.productionStatus === "ready" ? 10 : -8, festivalInvitationChance: clamp(hq.tourReputation + hq.stats.averageRating) } };
}
