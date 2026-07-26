/** Server-side boundary around the normal-gig simulator.  It deliberately owns no scoring formula. */
export interface FestivalGigModifiers {
  festivalScale: number;
  stageQuality: number;
  stageSize?: number;
  soundcheckQuality: number;
  lightingQuality?: number;
  technicalReadiness?: number;
  rehearsalReadiness?: number;
  crewEffectiveness?: number;
  changeoverQuality: number;
  weatherImpact?: number;
  delayPressure: number;
  crowdDensity?: number;
  crowdMood?: number;
  artistReady?: number;
  equipmentCondition?: number;
  festivalFamiliarity?: number;
  billingPosition?: number;
  headlinerExpectation: number;
  setLength?: number;
  incidentDisruption?: number;
  estimatedAudience: number;
}

export interface FestivalPerformanceEngineInput {
  seed: string;
  canonicalInput: Readonly<Record<string, unknown>>;
  modifiers: Readonly<FestivalGigModifiers>;
}

/**
 * The third argument is part of the canonical engine's context contract. Normal gigs omit it;
 * Festival jobs supply an immutable context without mutating artist or setlist records.
 */
export interface CanonicalGigEngine<Result> {
  version: string;
  validate(input: Readonly<Record<string, unknown>>): void;
  simulate(
    input: Readonly<Record<string, unknown>>,
    seed: string,
    context?: Readonly<{ source: "festival"; modifiers: Readonly<FestivalGigModifiers> }>,
  ): Result;
}

export interface FestivalPerformanceResult<Result> {
  engineVersion: string;
  adapterVersion: "festival-gig-adapter-v2";
  seed: string;
  canonicalResult: Result;
  modifiers: Readonly<FestivalGigModifiers>;
}

export function runFestivalPerformance<Result>(
  engine: CanonicalGigEngine<Result>,
  input: FestivalPerformanceEngineInput,
): FestivalPerformanceResult<Result> {
  engine.validate(input.canonicalInput);
  const modifiers = Object.freeze({ ...input.modifiers });
  const canonicalResult = engine.simulate(
    input.canonicalInput,
    input.seed,
    Object.freeze({ source: "festival" as const, modifiers }),
  );
  return Object.freeze({
    engineVersion: engine.version,
    adapterVersion: "festival-gig-adapter-v2",
    seed: input.seed,
    canonicalResult,
    modifiers,
  });
}
