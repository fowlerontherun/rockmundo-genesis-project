export type CrewMorale = "electric" | "steady" | "strained" | "burned_out";
export type CrewAssignment = "Touring" | "Studio" | "Production" | "Standby";
export type CrewDiscipline =
  | "Tour Manager"
  | "Front of House Engineer"
  | "Lighting Director"
  | "Road Crew Chief"
  | "Backline Technician"
  | "Merch Director"
  | "Security Lead"
  | "Wardrobe Stylist";

export interface CrewMetadata {
  morale: CrewMorale;
  loyalty: number;
  assignment: CrewAssignment;
  focus: string;
  specialties: string[];
  traits: string[];
  trainingFocus: string | null;
  trainingProgress: number;
  biography: string | null;
  lastGigDate: string | null;
}

export interface CrewCatalogItem {
  id: string;
  name: string;
  role: CrewDiscipline;
  headline: string;
  background: string;
  skill: number;
  salary: number;
  experience: number;
  morale: CrewMorale;
  loyalty: number;
  assignment: CrewAssignment;
  focus: string;
  specialties: string[];
  traits: string[];
  openings: number;
}

export const moraleLabelMap: Record<CrewMorale, string> = {
  electric: "Electric",
  steady: "Steady",
  strained: "Strained",
  burned_out: "Burned Out",
};

export const moraleBadgeVariant: Record<CrewMorale, "default" | "secondary" | "outline" | "destructive"> = {
  electric: "default",
  steady: "secondary",
  strained: "outline",
  burned_out: "destructive",
};

export const moraleScoreMap: Record<CrewMorale, number> = {
  electric: 90,
  steady: 70,
  strained: 45,
  burned_out: 25,
};

export const assignmentHighlights: Record<CrewAssignment, string> = {
  Touring: "Core road crew keeping the nightly show on rails.",
  Studio: "Focused on rehearsals, tracking sessions, and arrangement polish.",
  Production: "Overseeing load-ins, stage builds, and vendor wrangling.",
  Standby: "Floating specialists ready to plug gaps or spin up pop-up shows.",
};

export const CREW_DISCIPLINES: CrewDiscipline[] = [
  "Tour Manager",
  "Front of House Engineer",
  "Lighting Director",
  "Road Crew Chief",
  "Backline Technician",
  "Merch Director",
  "Security Lead",
  "Wardrobe Stylist",
];

export const DISCIPLINE_DEFAULTS: Record<
  CrewDiscipline,
  { assignment: CrewAssignment; focus: string; specialties: string[]; traits: string[] }
> = {
  "Tour Manager": {
    assignment: "Touring",
    focus: "Routing & settlements",
    specialties: ["Advance packets", "Promoter settlements", "Crisis triage"],
    traits: ["Logistics wizard", "Diplomatic"],
  },
  "Front of House Engineer": {
    assignment: "Touring",
    focus: "Front of house mix",
    specialties: ["Arena EQ", "Broadcast stems", "Audience tuning"],
    traits: ["Detail-obsessed", "Calm under pressure"],
  },
  "Lighting Director": {
    assignment: "Production",
    focus: "Lighting design & timecode",
    specialties: ["Timecode programming", "Rig redesign", "Atmospherics"],
    traits: ["Show painter", "Precision cueing"],
  },
  "Road Crew Chief": {
    assignment: "Production",
    focus: "Load-in leadership",
    specialties: ["Stage builds", "Crew routing", "Risk assessment"],
    traits: ["Hands-on", "Commanding"],
  },
  "Backline Technician": {
    assignment: "Touring",
    focus: "Instrument tech",
    specialties: ["Guitar setups", "Quick change swaps", "Pedalboard repair"],
    traits: ["Unflappable", "Gear whisperer"],
  },
  "Merch Director": {
    assignment: "Standby",
    focus: "Merchandising & ecom",
    specialties: ["Pop-up shops", "Inventory", "Design drops"],
    traits: ["Storyteller", "Data fluent"],
  },
  "Security Lead": {
    assignment: "Production",
    focus: "Safety & advance",
    specialties: ["Advance sweeps", "Artist protection", "Crowd response"],
    traits: ["Protective", "Quick-thinking"],
  },
  "Wardrobe Stylist": {
    assignment: "Studio",
    focus: "Image & styling",
    specialties: ["Show looks", "Quick repairs", "Tour capsule"],
    traits: ["Visionary", "Fast hands"],
  },
};

const CATALOG_TEMPLATE: ReadonlyArray<CrewCatalogItem> = [
  {
    id: "tour-manager-compass",
    name: "Mara \"Compass\" Liang",
    role: "Tour Manager",
    headline: "Eight-country arena routing ace who never misses curfew.",
    background:
      "Guided three platinum acts through world tours without a single canceled date. Legendary for turning promoter panic into viral fan experiences.",
    skill: 86,
    salary: 4200,
    experience: 8,
    morale: "electric",
    loyalty: 78,
    assignment: "Touring",
    focus: "Logistics & settlements",
    specialties: ["Visa wrangling", "Promoter negotiations", "Crisis messaging"],
    traits: ["Budget hawk", "Sleeps on the bus"],
    openings: 1,
  },
  {
    id: "foh-clarity",
    name: "Riley \"Fader\" Cortez",
    role: "Front of House Engineer",
    headline: "Makes stadium crowds feel like club mixes night after night.",
    background:
      "Cut their teeth mixing late-night TV sessions and hybrid festival sets. Fans routinely share board mixes because the clarity is unreal.",
    skill: 89,
    salary: 3900,
    experience: 10,
    morale: "electric",
    loyalty: 84,
    assignment: "Touring",
    focus: "Front of house mix",
    specialties: ["Timecode automation", "Broadcast-ready mixes", "Arena EQ"],
    traits: ["Meticulous", "Calm under pressure"],
    openings: 1,
  },
  {
    id: "ld-halo",
    name: "Sera Nyx",
    role: "Lighting Director",
    headline: "Turns club stages into cinematic worlds with synced cues.",
    background:
      "Was the secret weapon behind a breakout band's residency visuals. Known for designing dynamic timecode experiences on short turnarounds.",
    skill: 83,
    salary: 3600,
    experience: 7,
    morale: "steady",
    loyalty: 72,
    assignment: "Production",
    focus: "Lighting design & timecode",
    specialties: ["Timecode programming", "Hybrid rigs", "Laser choreography"],
    traits: ["Precision", "Story-driven"],
    openings: 1,
  },
  {
    id: "road-chief-hammer",
    name: "Donovan \"Hammer\" Wells",
    role: "Road Crew Chief",
    headline: "Leads 30-person crews with Zen calm even on festival chaos days.",
    background:
      "Former construction superintendent who reinvented load-ins for two major touring productions. Keeps every vendor and local crew in sync.",
    skill: 82,
    salary: 3500,
    experience: 12,
    morale: "steady",
    loyalty: 80,
    assignment: "Production",
    focus: "Load-in leadership",
    specialties: ["Stage builds", "Crew routing", "Risk assessment"],
    traits: ["Hands-on", "Crew dad"],
    openings: 1,
  },
  {
    id: "backline-gear",
    name: "Jules Armitage",
    role: "Backline Technician",
    headline: "Can rebuild a pedalboard blindfolded in the dark between songs.",
    background:
      "Supported major festival headliners with last-second guitar swaps and synth triage. Loves maintaining touring rigs under pressure.",
    skill: 78,
    salary: 3100,
    experience: 6,
    morale: "steady",
    loyalty: 70,
    assignment: "Touring",
    focus: "Instrument tech",
    specialties: ["Guitar setups", "Synth calibration", "Quick change swaps"],
    traits: ["Unflappable", "Gear whisperer"],
    openings: 1,
  },
  {
    id: "merch-director-stream",
    name: "Lex Avery",
    role: "Merch Director",
    headline: "Turns merch lines into pop-up retail experiences that trend.",
    background:
      "Built touring merch programs that doubled per-head spend for three indie darlings. Partners with artists to spin release drops into narrative moments.",
    skill: 75,
    salary: 2800,
    experience: 5,
    morale: "steady",
    loyalty: 68,
    assignment: "Standby",
    focus: "Merchandising & ecom",
    specialties: ["Pop-up shops", "Inventory", "Design drops"],
    traits: ["Storyteller", "Data fluent"],
    openings: 1,
  },
  {
    id: "security-guard",
    name: "Ibrahim Cole",
    role: "Security Lead",
    headline: "Former tour security for global pop icons with zero incident record.",
    background:
      "Ran advance sweeps for stadium runs and ensured VIP logistics for celebrity-heavy productions. Partners closely with venue heads to keep fans safe.",
    skill: 81,
    salary: 3300,
    experience: 11,
    morale: "steady",
    loyalty: 85,
    assignment: "Production",
    focus: "Safety & advance",
    specialties: ["Advance sweeps", "Artist protection", "Crowd response"],
    traits: ["Protective", "Quick-thinking"],
    openings: 1,
  },
  {
    id: "wardrobe-style",
    name: "Noa Elise",
    role: "Wardrobe Stylist",
    headline: "Builds capsule wardrobes that evolve with each tour storyline.",
    background:
      "Styled award-show runs and festival tours with quick-change mastery. Known for working hand-in-hand with lighting to make fabrics pop on camera.",
    skill: 74,
    salary: 2700,
    experience: 4,
    morale: "steady",
    loyalty: 66,
    assignment: "Studio",
    focus: "Image & styling",
    specialties: ["Show looks", "Quick repairs", "Tour capsule"],
    traits: ["Visionary", "Fast hands"],
    openings: 1,
  },
];

export const createInitialCrewCatalog = (): CrewCatalogItem[] =>
  CATALOG_TEMPLATE.map((item) => ({
    ...item,
    specialties: [...item.specialties],
    traits: [...item.traits],
  }));

export const formatCrewCurrency = (value?: number | null) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
