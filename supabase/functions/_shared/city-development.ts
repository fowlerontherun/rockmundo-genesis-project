export interface CityGameplayModifiers {
  economyRating: number;
  infrastructureRating: number;
  transportRating: number;
  publicSafetyRating: number;
  healthcareRating: number;
  cultureRating: number;
  musicSceneRating: number;
  tourismRating: number;
  qualityOfLifeRating: number;
  educationRating: number;
  economyRevenueMultiplier: number;
  audienceDemandMultiplier: number;
  travelCostMultiplier: number;
  travelDurationMultiplier: number;
  incidentRiskMultiplier: number;
  recoveryMultiplier: number;
  festivalDemandMultiplier: number;
  taxBaseMultiplier: number;
  logisticsMultiplier: number;
  localTalentMultiplier: number;
}

export const NEUTRAL_CITY_GAMEPLAY_MODIFIERS: CityGameplayModifiers = {
  economyRating: 50,
  infrastructureRating: 50,
  transportRating: 50,
  publicSafetyRating: 50,
  healthcareRating: 50,
  cultureRating: 50,
  musicSceneRating: 50,
  tourismRating: 50,
  qualityOfLifeRating: 50,
  educationRating: 50,
  economyRevenueMultiplier: 1,
  audienceDemandMultiplier: 1,
  travelCostMultiplier: 1,
  travelDurationMultiplier: 1,
  incidentRiskMultiplier: 1,
  recoveryMultiplier: 1,
  festivalDemandMultiplier: 1,
  taxBaseMultiplier: 1,
  logisticsMultiplier: 1,
  localTalentMultiplier: 1,
};

const numberOr = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function loadCityGameplayModifiers(
  supabaseClient: any,
  cityId: string | null | undefined,
): Promise<CityGameplayModifiers> {
  if (!cityId) return NEUTRAL_CITY_GAMEPLAY_MODIFIERS;

  try {
    const { data, error } = await supabaseClient.rpc("city_gameplay_modifiers", {
      p_city_id: cityId,
    });

    if (error) {
      console.warn("[city-development] Modifier lookup failed; using neutral city modifiers", error);
      return NEUTRAL_CITY_GAMEPLAY_MODIFIERS;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return NEUTRAL_CITY_GAMEPLAY_MODIFIERS;

    return {
      economyRating: numberOr(row.economy_rating, 50),
      infrastructureRating: numberOr(row.infrastructure_rating, 50),
      transportRating: numberOr(row.transport_rating, 50),
      publicSafetyRating: numberOr(row.public_safety_rating, 50),
      healthcareRating: numberOr(row.healthcare_rating, 50),
      cultureRating: numberOr(row.culture_rating, 50),
      musicSceneRating: numberOr(row.music_scene_rating, 50),
      tourismRating: numberOr(row.tourism_rating, 50),
      qualityOfLifeRating: numberOr(row.quality_of_life_rating, 50),
      educationRating: numberOr(row.education_rating, 50),
      economyRevenueMultiplier: numberOr(row.economy_revenue_multiplier, 1),
      audienceDemandMultiplier: numberOr(row.audience_demand_multiplier, 1),
      travelCostMultiplier: numberOr(row.travel_cost_multiplier, 1),
      travelDurationMultiplier: numberOr(row.travel_duration_multiplier, 1),
      incidentRiskMultiplier: numberOr(row.incident_risk_multiplier, 1),
      recoveryMultiplier: numberOr(row.recovery_multiplier, 1),
      festivalDemandMultiplier: numberOr(row.festival_demand_multiplier, 1),
      taxBaseMultiplier: numberOr(row.tax_base_multiplier, 1),
      logisticsMultiplier: numberOr(row.logistics_multiplier, 1),
      localTalentMultiplier: numberOr(row.local_talent_multiplier, 1),
    };
  } catch (error) {
    console.warn("[city-development] Modifier lookup threw; using neutral city modifiers", error);
    return NEUTRAL_CITY_GAMEPLAY_MODIFIERS;
  }
}
