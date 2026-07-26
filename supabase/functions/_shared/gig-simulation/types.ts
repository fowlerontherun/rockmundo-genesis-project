/** Environment-neutral input consumed by the canonical Festival adapter. */
export interface CanonicalSong {
  id: string;
  title: string;
  position: number;
  quality: number;
  popularity: number;
  familiarity: number;
  rehearsalLevel: number;
  durationSeconds?: number;
}

export interface CanonicalFestivalGigInput {
  gigId: string;
  artistId: string;
  performerSkill: number;
  stagePresence: number;
  readinessScore: number;
  setlist: CanonicalSong[];
}

export interface FestivalModifiers {
  stageQuality: number; soundAndLighting: number; technicalReadiness: number;
  rehearsal: number; crewEffectiveness: number; weather: number;
  delayMinutes: number; crowdMood: number; crowdDensity: number;
  equipmentCondition: number; billingPosition: number;
  headlinerExpectation: number; incidentDisruption: number; setLengthMinutes: number;
}

export interface FestivalSimulationInput {
  runtimeSessionId: string; dayId: string; stageId: string; performanceId: string;
  seed: string; canonicalEngineVersion: string; festivalAdapterVersion: string;
  resultSchemaVersion: string; runtimeFormulaVersion: string;
  formulaVersions: Record<string, string>;
  canonicalGigInput: CanonicalFestivalGigInput;
  festivalModifiers: FestivalModifiers;
  crowdEvidence: { attendance: number; stageCapacity: number };
}
