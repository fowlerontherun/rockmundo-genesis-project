export type LoadoutSectionKey = "vocal" | "pedal" | "other";

export type GearQuality = "Pristine" | "Stage Ready" | "Road Worn" | "Studio Kept";
export type GearRarity = "Common" | "Uncommon" | "Rare" | "Legendary";
export type PedalSlotType =
  | "input"
  | "dynamics"
  | "gain"
  | "modulation"
  | "ambient"
  | "utility"
  | "looping"
  | "output";

export interface GearDefinition {
  id: string;
  name: string;
  manufacturer?: string;
  sections: LoadoutSectionKey[];
  quality: GearQuality;
  rarity: GearRarity;
  compatiblePedalSlots?: PedalSlotType[];
  description?: string;
}

export interface LoadoutMetadata {
  name: string;
  role: string;
  scenario: string;
  primaryInstrument: string;
  isActive: boolean;
  notes?: string;
}

export interface LoadoutVocalSlot {
  id: string;
  label: string;
  gearId: string | null;
  equipped: boolean;
  notes?: string;
}

export interface LoadoutPedalSlot {
  slotNumber: number;
  slotType: PedalSlotType;
  gearId: string | null;
  equipped: boolean;
  notes?: string;
}

export interface LoadoutOtherItem {
  id: string;
  label: string;
  gearId: string | null;
  equipped: boolean;
  notes?: string;
}

export interface LoadoutState {
  metadata: LoadoutMetadata;
  vocalSetup: LoadoutVocalSlot[];
  pedalBoard: LoadoutPedalSlot[];
  otherGear: LoadoutOtherItem[];
}

export const OTHER_GEAR_LIMIT = 6;

export const gearDefinitions: GearDefinition[] = [
  {
    id: "shure-ksm9",
    name: "Shure KSM9 Wireless Capsule",
    manufacturer: "Shure",
    sections: ["vocal", "other"],
    quality: "Pristine",
    rarity: "Rare",
    description: "Dual-diaphragm capsule tuned for arena stages with rich high-end detail.",
  },
  {
    id: "telefunken-eif",
    name: "Telefunken Elektroakustik M80",
    manufacturer: "Telefunken",
    sections: ["vocal"],
    quality: "Stage Ready",
    rarity: "Uncommon",
    description: "Dynamic microphone for backup singers with focused mids.",
  },
  {
    id: "avalon-vt737",
    name: "Avalon VT-737sp Channel Strip",
    manufacturer: "Avalon Design",
    sections: ["vocal", "other"],
    quality: "Studio Kept",
    rarity: "Rare",
    description: "Tube preamp and compressor for the main vocal path.",
  },
  {
    id: "neve-1073",
    name: "AMS Neve 1073DPX",
    manufacturer: "AMS Neve",
    sections: ["vocal", "other"],
    quality: "Stage Ready",
    rarity: "Legendary",
    description: "Dual-channel preamp used as a swap-in for studio sessions.",
  },
  {
    id: "ultimate-ears-ue11",
    name: "Ultimate Ears UE 11 Pro",
    manufacturer: "Ultimate Ears",
    sections: ["vocal", "other"],
    quality: "Pristine",
    rarity: "Rare",
    description: "Custom in-ear monitors for lead vocals and click track.",
  },
  {
    id: "sennheiser-ew-iem",
    name: "Sennheiser EW IEM G4",
    manufacturer: "Sennheiser",
    sections: ["vocal", "other"],
    quality: "Stage Ready",
    rarity: "Uncommon",
    description: "Wireless transmitter pack for the vocal rig",
  },
  {
    id: "tc-polytune-3",
    name: "TC Electronic Polytune 3",
    manufacturer: "TC Electronic",
    sections: ["pedal"],
    quality: "Pristine",
    rarity: "Common",
    compatiblePedalSlots: ["input", "utility"],
    description: "Always-on tuner and buffer at the front of the board.",
  },
  {
    id: "origin-cali76",
    name: "Origin Effects Cali76 Compact Deluxe",
    manufacturer: "Origin Effects",
    sections: ["pedal"],
    quality: "Stage Ready",
    rarity: "Rare",
    compatiblePedalSlots: ["dynamics"],
    description: "Studio-style compressor smoothing the front of the signal chain.",
  },
  {
    id: "ibanez-ts808",
    name: "Ibanez Tube Screamer TS808",
    manufacturer: "Ibanez",
    sections: ["pedal"],
    quality: "Road Worn",
    rarity: "Legendary",
    compatiblePedalSlots: ["gain"],
    description: "Primary mid-gain drive used for choruses.",
  },
  {
    id: "jhs-morning-glory",
    name: "JHS Morning Glory V4",
    manufacturer: "JHS Pedals",
    sections: ["pedal"],
    quality: "Stage Ready",
    rarity: "Uncommon",
    compatiblePedalSlots: ["gain"],
    description: "Transparent overdrive stacked after the Tube Screamer.",
  },
  {
    id: "wampler-plexi-drive",
    name: "Wampler Plexi-Drive Mini",
    manufacturer: "Wampler Pedals",
    sections: ["pedal"],
    quality: "Stage Ready",
    rarity: "Uncommon",
    compatiblePedalSlots: ["gain"],
    description: "Marshall-inspired crunch for festival medleys.",
  },
  {
    id: "strymon-mobius",
    name: "Strymon Mobius",
    manufacturer: "Strymon",
    sections: ["pedal"],
    quality: "Pristine",
    rarity: "Rare",
    compatiblePedalSlots: ["modulation"],
    description: "Flagship modulation with MIDI recall.",
  },
  {
    id: "mxr-phase-95",
    name: "MXR Phase 95",
    manufacturer: "Dunlop",
    sections: ["pedal"],
    quality: "Stage Ready",
    rarity: "Common",
    compatiblePedalSlots: ["modulation"],
    description: "Compact phaser blending script and block tones.",
  },
  {
    id: "strymon-timeline",
    name: "Strymon Timeline",
    manufacturer: "Strymon",
    sections: ["pedal"],
    quality: "Pristine",
    rarity: "Rare",
    compatiblePedalSlots: ["ambient", "looping"],
    description: "Preset-driven delay for synced dotted eighth repeats.",
  },
  {
    id: "strymon-bigsky",
    name: "Strymon BigSky",
    manufacturer: "Strymon",
    sections: ["pedal"],
    quality: "Pristine",
    rarity: "Rare",
    compatiblePedalSlots: ["ambient"],
    description: "Shimmer and cloud reverbs for ambient swells.",
  },
  {
    id: "boss-rv500",
    name: "Boss RV-500",
    manufacturer: "Boss",
    sections: ["pedal"],
    quality: "Stage Ready",
    rarity: "Uncommon",
    compatiblePedalSlots: ["ambient"],
    description: "Alternate reverb engine when BigSky presets are full.",
  },
  {
    id: "boss-es8",
    name: "Boss ES-8 Effects Switching System",
    manufacturer: "Boss",
    sections: ["pedal", "other"],
    quality: "Stage Ready",
    rarity: "Rare",
    compatiblePedalSlots: ["utility"],
    description: "Controls routing and preset switching for the entire board.",
  },
  {
    id: "disaster-dpc",
    name: "Disaster Area DPC-5 Gen3",
    manufacturer: "Disaster Area Designs",
    sections: ["pedal"],
    quality: "Stage Ready",
    rarity: "Uncommon",
    compatiblePedalSlots: ["utility"],
    description: "Backup MIDI and loop switcher.",
  },
  {
    id: "neural-quad-cortex",
    name: "Neural DSP Quad Cortex",
    manufacturer: "Neural DSP",
    sections: ["pedal", "other"],
    quality: "Pristine",
    rarity: "Rare",
    compatiblePedalSlots: ["output", "utility"],
    description: "All-in-one amp and capture rig for fly dates.",
  },
  {
    id: "radial-j48",
    name: "Radial J48 Active DI",
    manufacturer: "Radial Engineering",
    sections: ["pedal", "other"],
    quality: "Stage Ready",
    rarity: "Common",
    compatiblePedalSlots: ["output"],
    description: "Feeds front-of-house with a clean balanced signal.",
  },
  {
    id: "kemper-stage",
    name: "Kemper Profiler Stage",
    manufacturer: "Kemper",
    sections: ["other", "pedal"],
    quality: "Stage Ready",
    rarity: "Rare",
    description: "Backup modeling rig with festival presets.",
  },
  {
    id: "fender-american-tele",
    name: "Fender American Professional II Telecaster",
    manufacturer: "Fender",
    sections: ["other"],
    quality: "Stage Ready",
    rarity: "Rare",
    description: "Backup guitar tuned to open C for specific tracks.",
  },
  {
    id: "gibson-es335",
    name: "Gibson ES-335 Figured",
    manufacturer: "Gibson",
    sections: ["other"],
    quality: "Studio Kept",
    rarity: "Legendary",
    description: "Semi-hollow used for ballads and studio sessions.",
  },
  {
    id: "boss-waza-air",
    name: "Boss Waza-Air Wireless Headphones",
    manufacturer: "Boss",
    sections: ["other"],
    quality: "Pristine",
    rarity: "Uncommon",
    description: "Silent practice monitoring while traveling.",
  },
  {
    id: "akg-c414",
    name: "AKG C414 XLII",
    manufacturer: "AKG",
    sections: ["vocal", "other"],
    quality: "Studio Kept",
    rarity: "Legendary",
    description: "Studio condenser for acoustic sessions.",
  },
  {
    id: "radial-hotshot",
    name: "Radial HotShot DM1",
    manufacturer: "Radial Engineering",
    sections: ["vocal", "other"],
    quality: "Stage Ready",
    rarity: "Common",
    description: "Footswitch to route vocals to talkback.",
  },
];

const pedalSlotPlan: Array<Pick<LoadoutPedalSlot, "slotNumber" | "slotType" | "gearId" | "equipped" | "notes">> = [
  {
    slotNumber: 1,
    slotType: "input",
    gearId: "tc-polytune-3",
    equipped: true,
    notes: "Front-of-chain buffer + tuner",
  },
  {
    slotNumber: 2,
    slotType: "dynamics",
    gearId: "origin-cali76",
    equipped: true,
    notes: "Smooths transients before the drives",
  },
  {
    slotNumber: 3,
    slotType: "gain",
    gearId: "ibanez-ts808",
    equipped: true,
    notes: "Core overdrive tone",
  },
  {
    slotNumber: 4,
    slotType: "gain",
    gearId: "jhs-morning-glory",
    equipped: true,
    notes: "Stacked drive for choruses",
  },
  {
    slotNumber: 5,
    slotType: "modulation",
    gearId: "strymon-mobius",
    equipped: true,
    notes: "Rotary and tremolo presets",
  },
  {
    slotNumber: 6,
    slotType: "modulation",
    gearId: "mxr-phase-95",
    equipped: false,
    notes: "Single switch phaser for solos",
  },
  {
    slotNumber: 7,
    slotType: "ambient",
    gearId: "strymon-timeline",
    equipped: true,
    notes: "MIDI synced delays",
  },
  {
    slotNumber: 8,
    slotType: "ambient",
    gearId: "strymon-bigsky",
    equipped: true,
    notes: "Shimmer pad reverbs",
  },
  {
    slotNumber: 9,
    slotType: "utility",
    gearId: "boss-es8",
    equipped: true,
    notes: "Program changes and routing",
  },
  {
    slotNumber: 10,
    slotType: "output",
    gearId: "radial-j48",
    equipped: true,
    notes: "Feeds front-of-house",
  },
];

export const initialLoadoutState: LoadoutState = {
  metadata: {
    name: "Arena Headline Rig",
    role: "Lead Vocalist & Guitar",
    scenario: "Festival headline set",
    primaryInstrument: "Stratocaster / Helix Hybrid",
    isActive: true,
    notes:
      "Working draft of the upcoming tour loadout. Slots update live as assignments change—use it to prep rehearsal notes.",
  },
  vocalSetup: [
    {
      id: "vocal-mic",
      label: "Primary Microphone",
      gearId: "shure-ksm9",
      equipped: true,
      notes: "Swappable capsule on Axient wireless bodypack",
    },
    {
      id: "vocal-pre",
      label: "Front-of-House Preamp",
      gearId: "avalon-vt737",
      equipped: true,
      notes: "Adds gentle compression and tube warmth",
    },
    {
      id: "vocal-monitor",
      label: "In-Ear Monitoring",
      gearId: "ultimate-ears-ue11",
      equipped: true,
      notes: "Paired with Sennheiser IEM transmitter",
    },
    {
      id: "talkback",
      label: "Talkback Switcher",
      gearId: "radial-hotshot",
      equipped: false,
      notes: "Routed to monitor engineer only",
    },
  ],
  pedalBoard: pedalSlotPlan,
  otherGear: [
    {
      id: "spare-modeler",
      label: "Backup Modeler",
      gearId: "neural-quad-cortex",
      equipped: false,
      notes: "Used when fly dates limit pedalboard shipping",
    },
    {
      id: "spare-guitar",
      label: "Secondary Guitar",
      gearId: "fender-american-tele",
      equipped: true,
      notes: "Open C tuning for the encore",
    },
    {
      id: "studio-guitar",
      label: "Studio Semi-Hollow",
      gearId: "gibson-es335",
      equipped: false,
      notes: "Lives in the road case for clean ballads",
    },
    {
      id: "wireless-pack",
      label: "Wireless Pack",
      gearId: "sennheiser-ew-iem",
      equipped: true,
      notes: "Dedicated transmitter for vocal in-ears",
    },
  ],
};
