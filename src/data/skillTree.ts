import { type SkillDefinitionRecord, type SkillRelationshipRecord } from "@/hooks/useSkillSystem.types";

export type TierName = "Basic" | "Professional" | "Mastery";

export const SKILL_TIER_ORDER: readonly TierName[] = ["Basic", "Professional", "Mastery"] as const;

const PROFESSIONAL_UNLOCK_VALUE = 250;
const MASTERY_UNLOCK_VALUE = 650;

const TIER_DEFAULTS: Record<TierName, { xp: number; duration: number }> = {
  Basic: { xp: 6, duration: 30 },
  Professional: { xp: 10, duration: 45 },
  Mastery: { xp: 14, duration: 60 }
};

type PrerequisiteConfig = {
  slug: string;
  requiredValue?: number;
};

type TierEntry = {
  name: string;
  description: string;
  slug?: string;
  xp?: number;
  duration?: number;
  icon?: string;
  requiredValue?: number;
  prerequisites?: PrerequisiteConfig[];
};

interface TieredSkillConfig {
  prefix: string;
  category: string;
  track: string;
  icon: string;
  tiers: Partial<Record<TierName, TierEntry>>;
  chainPrerequisites?: boolean;
}

const sanitizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const createSlug = (prefix: string, tier: TierName, track: string) =>
  `${prefix}_${tier.toLowerCase()}_${sanitizeSlug(track)}`;

const buildSkillTree = (configs: TieredSkillConfig[]) => {
  const definitions: SkillDefinitionRecord[] = [];
  const relationships: SkillRelationshipRecord[] = [];
  const relationshipKeys = new Set<string>();

  for (const config of configs) {
    let previousSlug: string | null = null;
    for (const tier of SKILL_TIER_ORDER) {
      const entry = config.tiers[tier];
      if (!entry) {
        continue;
      }

      const slug = entry.slug ?? createSlug(config.prefix, tier, config.track);
      const icon = entry.icon ?? config.icon;
      const defaults = TIER_DEFAULTS[tier];

      definitions.push({
        id: slug,
        slug,
        display_name: entry.name,
        description: entry.description,
        icon_slug: icon,
        base_xp_gain: entry.xp ?? defaults.xp,
        training_duration_minutes: entry.duration ?? defaults.duration,
        metadata: {
          category: config.category,
          tier,
          track: config.track
        }
      });

      if (config.chainPrerequisites !== false && previousSlug) {
        const requiredValue = entry.requiredValue ?? (tier === "Mastery" ? MASTERY_UNLOCK_VALUE : PROFESSIONAL_UNLOCK_VALUE);
        const relationshipKey = `${slug}__${previousSlug}`;
        if (!relationshipKeys.has(relationshipKey)) {
          relationshipKeys.add(relationshipKey);
          relationships.push({
            id: relationshipKey,
            skill_slug: slug,
            required_skill_slug: previousSlug,
            required_value: requiredValue,
            metadata: {
              category: config.category,
              type: "tier_prerequisite",
              track: config.track,
              tier
            }
          });
        }
      }

      if (entry.prerequisites) {
        for (const prerequisite of entry.prerequisites) {
          const relationshipKey = `${slug}__${prerequisite.slug}`;
          if (relationshipKeys.has(relationshipKey)) {
            continue;
          }

          relationshipKeys.add(relationshipKey);
          relationships.push({
            id: relationshipKey,
            skill_slug: slug,
            required_skill_slug: prerequisite.slug,
            required_value: prerequisite.requiredValue ?? (tier === "Mastery" ? MASTERY_UNLOCK_VALUE : PROFESSIONAL_UNLOCK_VALUE),
            metadata: {
              category: config.category,
              type: "cross_prerequisite",
              track: config.track,
              tier
            }
          });
        }
      }

      previousSlug = slug;
    }
  }

  return { definitions, relationships };
};

const songwritingProductionConfigs: TieredSkillConfig[] = [
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Composing",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Composing",
        description: "Learn chord progressions, melodies, and core song structures.",
        slug: "songwriting_basic_composing"
      },
      Professional: {
        name: "Professional Composing",
        description: "Craft advanced arrangements with modulations and dynamic movements.",
        slug: "songwriting_professional_composing"
      },
      Mastery: {
        name: "Composing Anthems & Crowdpleasers",
        description: "Write unforgettable anthems, ballads, and show-stopping compositions.",
        slug: "songwriting_mastery_composing_anthems"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Lyrics",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Lyrics",
        description: "Develop storytelling, rhymes, and lyrical phrasing fundamentals.",
        slug: "songwriting_basic_lyrics"
      },
      Professional: {
        name: "Professional Lyrics",
        description: "Deliver lyrical narratives with evocative imagery and hooks.",
        slug: "songwriting_professional_lyrics"
      },
      Mastery: {
        name: "Lyrics Mastery",
        description: "Pen timeless lyrics that resonate with global audiences.",
        slug: "songwriting_mastery_lyrics"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Record Production",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Record Production",
        description: "Explore session planning, mic placement, and studio workflow basics.",
        slug: "songwriting_basic_record_production"
      },
      Professional: {
        name: "Professional Record Production",
        description: "Lead full productions with session players, engineers, and budgets.",
        slug: "songwriting_professional_record_production"
      },
      Mastery: {
        name: "Record Production Mastery",
        description: "Deliver chart-ready productions with elite polish and direction.",
        slug: "songwriting_mastery_record_production"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "DAW Production",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic DAW Use",
        description: "Navigate DAWs, arrange tracks, and manage project workflows.",
        slug: "songwriting_basic_daw"
      },
      Professional: {
        name: "Professional DAW Production",
        description: "Build efficient templates, automation, and hybrid recording pipelines.",
        slug: "songwriting_professional_daw"
      },
      Mastery: {
        name: "DAW Mastery",
        description: "Command every DAW feature for limitless creative execution.",
        slug: "songwriting_mastery_daw"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Beatmaking",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Beatmaking",
        description: "Program grooves, drums, and rhythm section foundations.",
        slug: "songwriting_basic_beatmaking"
      },
      Professional: {
        name: "Professional Beatmaking",
        description: "Design signature drums, swing, and groove-based productions.",
        slug: "songwriting_professional_beatmaking"
      },
      Mastery: {
        name: "Beatmaking Mastery",
        description: "Create iconic beats that define scenes and cultures.",
        slug: "songwriting_mastery_beatmaking"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Sampling & Remixing",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Sampling & Remixing",
        description: "Chop, flip, and reimagine samples with legal and creative insight.",
        slug: "songwriting_basic_sampling"
      },
      Professional: {
        name: "Professional Sampling & Remixing",
        description: "Blend multi-genre samples into cohesive, release-ready remixes.",
        slug: "songwriting_professional_sampling"
      },
      Mastery: {
        name: "Sampling & Remixing Mastery",
        description: "Transform source material into era-defining remixes and edits.",
        slug: "songwriting_mastery_sampling"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Sound Design & Synthesis",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Sound Design & Synthesis",
        description: "Shape oscillators, filters, and modulation for original tones.",
        slug: "songwriting_basic_sound_design"
      },
      Professional: {
        name: "Professional Sound Design & Synthesis",
        description: "Engineer complex patches, textures, and evolving soundscapes.",
        slug: "songwriting_professional_sound_design"
      },
      Mastery: {
        name: "Sound Design & Synthesis Mastery",
        description: "Craft iconic sonic identities across hardware and software synths.",
        slug: "songwriting_mastery_sound_design"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Mixing & Mastering",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Mixing & Mastering",
        description: "Balance levels, EQ, and dynamics for clear demo-ready mixes.",
        slug: "songwriting_basic_mixing"
      },
      Professional: {
        name: "Professional Mixing & Mastering",
        description: "Deliver competitive loudness, depth, and tonal consistency.",
        slug: "songwriting_professional_mixing"
      },
      Mastery: {
        name: "Mix & Mastering Mastery",
        description: "Craft award-winning mixes that translate on any system.",
        slug: "songwriting_mastery_mixing"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Live Looping",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Live Looping",
        description: "Build layered performances with timing and overdub discipline.",
        slug: "songwriting_basic_live_looping"
      },
      Professional: {
        name: "Professional Live Looping",
        description: "Design immersive solo shows with complex loop arrangements.",
        slug: "songwriting_professional_live_looping"
      },
      Mastery: {
        name: "Live Looping Mastery",
        description: "Command loop-based performances that captivate audiences.",
        slug: "songwriting_mastery_live_looping"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "Vocal Production",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic Vocal Tuning & Processing",
        description: "Tune vocals, manage takes, and apply tasteful processing.",
        slug: "songwriting_basic_vocal_processing"
      },
      Professional: {
        name: "Professional Vocal Production",
        description: "Direct sessions, comp performances, and sculpt vocal mixes.",
        slug: "songwriting_professional_vocal_production"
      },
      Mastery: {
        name: "Vocal Processing Mastery",
        description: "Deliver pristine vocals with signature effects and presence.",
        slug: "songwriting_mastery_vocal_processing"
      }
    }
  },
  {
    prefix: "songwriting",
    category: "Songwriting & Production",
    track: "AI Music",
    icon: "songwriting",
    tiers: {
      Basic: {
        name: "Basic AI Music Tools",
        description: "Experiment with generative tools for ideation and sketches.",
        slug: "songwriting_basic_ai_music"
      },
      Professional: {
        name: "Professional AI Music Integration",
        description: "Blend AI workflows with human production for unique outputs.",
        slug: "songwriting_professional_ai_music"
      },
      Mastery: {
        name: "AI Music Mastery",
        description: "Lead cutting-edge hybrid collaborations with intelligent tools.",
        slug: "songwriting_mastery_ai_music"
      }
    }
  }
];

const genreTracks = [
  "Rock",
  "Pop",
  "Hip Hop",
  "Jazz",
  "Blues",
  "Country",
  "Reggae",
  "Heavy Metal",
  "Classical",
  "Electronica",
  "Latin",
  "World Music",
  "R&B",
  "Punk Rock",
  "Flamenco",
  "African Music",
  "Modern Rock",
  "EDM",
  "Trap",
  "Drill",
  "Lo-Fi Hip Hop",
  "K-Pop/J-Pop",
  "Afrobeats/Amapiano",
  "Synthwave",
  "Indie/Bedroom Pop",
  "Hyperpop",
  "Metalcore/Djent",
  "Alt R&B/Neo-Soul"
];

const genreConfigs: TieredSkillConfig[] = genreTracks.map(track => {
  const slugBase = sanitizeSlug(track);
  return {
    prefix: "genres",
    category: "Genres",
    track,
    icon: "genre",
    tiers: {
      Basic: {
        name: `Basic ${track}`,
        description: `Study the roots, rhythms, and instrumentation that define ${track}.`,
        slug: `genres_basic_${slugBase}`
      },
      Professional: {
        name: `Professional ${track}`,
        description: `Produce polished ${track} songs ready for release and touring.`,
        slug: `genres_professional_${slugBase}`
      },
      Mastery: {
        name: `${track} Mastery`,
        description: `Innovate within ${track} and shape the future sound of the genre.`,
        slug: `genres_mastery_${slugBase}`
      }
    }
  } satisfies TieredSkillConfig;
});

const instrumentsConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Singing",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Singing",
        description: "Build pitch, breath control, and vocal confidence.",
        slug: createSlug("instruments", "Basic", "Singing")
      },
      Professional: {
        name: "Professional Singing",
        description: "Deliver stage-ready vocals with dynamics and stylistic nuance.",
        slug: createSlug("instruments", "Professional", "Singing")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Rapping",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Rapping",
        description: "Develop flow, cadence, and lyrical delivery on the mic.",
        slug: createSlug("instruments", "Basic", "Rapping")
      },
      Professional: {
        name: "Professional Rapping",
        description: "Master breath control, double-time flows, and live crowd energy.",
        slug: createSlug("instruments", "Professional", "Rapping")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Brass",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Brass",
        description: "Practice embouchure, tone production, and ensemble support.",
        slug: createSlug("instruments", "Basic", "Brass")
      },
      Professional: {
        name: "Professional Brass",
        description: "Lead brass sections with advanced articulation and dynamics.",
        slug: createSlug("instruments", "Professional", "Brass")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Keyboard",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Keyboard",
        description: "Learn chords, voicings, and stage-ready keyboard techniques.",
        slug: createSlug("instruments", "Basic", "Keyboard")
      },
      Professional: {
        name: "Professional Keyboard",
        description: "Layer synths, pianos, and organs with seamless transitions.",
        slug: createSlug("instruments", "Professional", "Keyboard")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Percussions",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Percussions",
        description: "Lock in time, grooves, and foundational rhythm reading.",
        slug: createSlug("instruments", "Basic", "Percussions")
      },
      Professional: {
        name: "Professional Percussions",
        description: "Blend acoustic and electronic percussion for hybrid sets.",
        slug: createSlug("instruments", "Professional", "Percussions")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Strings",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Strings",
        description: "Strengthen fretting, bowing, and tonal control across stringed instruments.",
        slug: createSlug("instruments", "Basic", "Strings")
      },
      Professional: {
        name: "Professional Strings",
        description: "Perform expressive solos and complex accompaniment across genres.",
        slug: createSlug("instruments", "Professional", "Strings")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Woodwinds",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Woodwinds",
        description: "Master embouchure, intonation, and phrasing across woodwind instruments.",
        slug: createSlug("instruments", "Basic", "Woodwinds")
      },
      Professional: {
        name: "Professional Woodwinds",
        description: "Deliver improvisations, harmonies, and studio-ready performances.",
        slug: createSlug("instruments", "Professional", "Woodwinds")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Electronic Instruments",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Electronic Instruments",
        description: "Perform with synths, controllers, and hybrid rigs in real time.",
        slug: createSlug("instruments", "Basic", "Electronic Instruments")
      },
      Professional: {
        name: "Professional Electronic Instruments",
        description: "Integrate modular, hardware, and software instruments on stage.",
        slug: createSlug("instruments", "Professional", "Electronic Instruments")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "DJ Performance",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic DJ Controller Skills",
        description: "Learn beatmatching, cueing, and controller-based transitions.",
        slug: createSlug("instruments", "Basic", "DJ Performance")
      },
      Professional: {
        name: "Professional DJing",
        description: "Deliver extended club sets with creative mixing and crowd reading.",
        slug: createSlug("instruments", "Professional", "DJ Performance")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "MIDI Performance",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic MIDI Controller Skills",
        description: "Trigger clips, map controls, and perform live with MIDI devices.",
        slug: createSlug("instruments", "Basic", "MIDI Performance")
      },
      Professional: {
        name: "Professional MIDI Performance",
        description: "Build expressive mappings, gestures, and performance rigs.",
        slug: createSlug("instruments", "Professional", "MIDI Performance")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Sampler & Drum Machine",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Sampler/Drum Machine",
        description: "Sequence beats, assign pads, and design live sampler sets.",
        slug: createSlug("instruments", "Basic", "Sampler Drum Machine")
      },
      Professional: {
        name: "Professional Drum Machine Use",
        description: "Perform complex step sequencing and live resampling routines.",
        slug: createSlug("instruments", "Professional", "Sampler Drum Machine")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Hybrid Drums",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Hybrid Drums",
        description: "Blend acoustic kits with triggers and electronic elements.",
        slug: createSlug("instruments", "Basic", "Hybrid Drums")
      },
      Professional: {
        name: "Professional Hybrid Drumming",
        description: "Design hybrid kits and perform genre-spanning rhythms live.",
        slug: createSlug("instruments", "Professional", "Hybrid Drums")
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Electronic Strings",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Basic Electronic Strings",
        description: "Perform with electric violins, cellos, and processed string rigs.",
        slug: createSlug("instruments", "Basic", "Electronic Strings")
      },
      Professional: {
        name: "Professional Electronic Strings",
        description: "Layer live looping, effects, and virtuoso performances.",
        slug: createSlug("instruments", "Professional", "Electronic Strings")
      }
    }
  }
];

const instrumentMasteryConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Lead Vocals",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Lead Vocals Mastery",
        description: "Command center-stage vocals with endurance, charisma, and precision.",
        slug: createSlug("instruments", "Mastery", "Lead Vocals"),
        prerequisites: [
          { slug: createSlug("instruments", "Professional", "Singing"), requiredValue: 650 },
          { slug: createSlug("instruments", "Professional", "Rapping"), requiredValue: 600 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Instrument",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Instrument Mastery",
        description: "Achieve virtuosity across piano, drums, guitar, and more.",
        slug: createSlug("instruments", "Mastery", "Instrument"),
        prerequisites: [
          { slug: createSlug("instruments", "Professional", "Keyboard"), requiredValue: 650 },
          { slug: createSlug("instruments", "Professional", "Percussions"), requiredValue: 650 },
          { slug: createSlug("instruments", "Professional", "Strings"), requiredValue: 650 },
          { slug: createSlug("instruments", "Professional", "Woodwinds"), requiredValue: 600 },
          { slug: createSlug("instruments", "Professional", "Electronic Instruments"), requiredValue: 600 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "DJ",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "DJ Mastery",
        description: "Headliner-level DJ sets with intricate blends and storytelling.",
        slug: createSlug("instruments", "Mastery", "DJ"),
        prerequisites: [
          { slug: createSlug("instruments", "Professional", "DJ Performance"), requiredValue: 650 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "MIDI",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "MIDI Mastery",
        description: "Design expressive MIDI performances that feel organic.",
        slug: createSlug("instruments", "Mastery", "MIDI"),
        prerequisites: [
          { slug: createSlug("instruments", "Professional", "MIDI Performance"), requiredValue: 650 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Sampler",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Sampler/Drum Machine Mastery",
        description: "Flip samples live with flawless timing and musicality.",
        slug: createSlug("instruments", "Mastery", "Sampler"),
        prerequisites: [
          { slug: createSlug("instruments", "Professional", "Sampler Drum Machine"), requiredValue: 650 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Hybrid Drumming",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Hybrid Drumming Mastery",
        description: "Fuse acoustic power with electronic precision effortlessly.",
        slug: createSlug("instruments", "Mastery", "Hybrid Drumming"),
        prerequisites: [
          { slug: createSlug("instruments", "Professional", "Hybrid Drums"), requiredValue: 650 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Electronic Strings Mastery",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Electronic Strings Mastery",
        description: "Deliver futuristic string performances with immersive sound design.",
        slug: createSlug("instruments", "Mastery", "Electronic Strings"),
        prerequisites: [
          { slug: createSlug("instruments", "Professional", "Electronic Strings"), requiredValue: 650 }
        ]
      }
    }
  }
];

const stageShowmanshipConfigs: TieredSkillConfig[] = [
  {
    prefix: "stage",
    category: "Stage & Showmanship",
    track: "Showmanship",
    icon: "stagecraft",
    tiers: {
      Basic: {
        name: "Basic Showmanship",
        description: "Engage audiences with confidence, charisma, and movement.",
        slug: "stage_basic_showmanship"
      },
      Professional: {
        name: "Professional Showmanship",
        description: "Design signature moves, pacing, and crowd-leading moments.",
        slug: "stage_professional_showmanship"
      },
      Mastery: {
        name: "Showmanship Mastery",
        description: "Deliver legendary performances that create lifelong fans.",
        slug: "stage_mastery_showmanship"
      }
    }
  },
  {
    prefix: "stage",
    category: "Stage & Showmanship",
    track: "Stage Tech",
    icon: "stagecraft",
    tiers: {
      Basic: {
        name: "Basic Stage Tech",
        description: "Understand sound checks, signal flow, and stage safety.",
        slug: "stage_basic_tech"
      },
      Professional: {
        name: "Professional Stage Tech",
        description: "Run pro-level rigs, monitor mixes, and live production cues.",
        slug: "stage_professional_tech"
      },
      Mastery: {
        name: "Stage Tech Mastery",
        description: "Engineer world-class touring productions with flawless execution.",
        slug: "stage_mastery_tech"
      }
    }
  },
  {
    prefix: "stage",
    category: "Stage & Showmanship",
    track: "Visual Performance",
    icon: "stagecraft",
    tiers: {
      Basic: {
        name: "Basic Visual Performance Integration",
        description: "Sync simple visuals, lighting, and projections with music.",
        slug: "stage_basic_visuals"
      },
      Professional: {
        name: "Professional Visual Shows",
        description: "Produce multimedia concerts with choreographed visuals.",
        slug: "stage_professional_visuals"
      },
      Mastery: {
        name: "Visual Performance Mastery",
        description: "Create immersive audiovisual experiences and narratives.",
        slug: "stage_mastery_visuals"
      }
    }
  },
  {
    prefix: "stage",
    category: "Stage & Showmanship",
    track: "Social Musician",
    icon: "stagecraft",
    tiers: {
      Basic: {
        name: "Basic Social Media Performance",
        description: "Share performances online with authentic storytelling.",
        slug: "stage_basic_social"
      },
      Professional: {
        name: "Professional Social Media Musician",
        description: "Grow engaged communities with consistent creative content.",
        slug: "stage_professional_social"
      },
      Mastery: {
        name: "Social Music Mastery",
        description: "Lead global digital fandoms with boundary-pushing performances.",
        slug: "stage_mastery_social"
      }
    }
  },
  {
    prefix: "stage",
    category: "Stage & Showmanship",
    track: "Streaming Concerts",
    icon: "stagecraft",
    tiers: {
      Basic: {
        name: "Basic Streaming Concerts",
        description: "Set up live streams with reliable audio, video, and chat.",
        slug: "stage_basic_streaming"
      },
      Professional: {
        name: "Professional Streaming Shows",
        description: "Produce multi-camera, interactive concerts for global fans.",
        slug: "stage_professional_streaming"
      },
      Mastery: {
        name: "Streaming Concert Mastery",
        description: "Host immersive digital festivals with high production value.",
        slug: "stage_mastery_streaming"
      }
    }
  },
  {
    prefix: "stage",
    category: "Stage & Showmanship",
    track: "Crowd Engagement",
    icon: "stagecraft",
    tiers: {
      Basic: {
        name: "Basic Crowd Interaction",
        description: "Read the room and energize audiences between songs.",
        slug: "stage_basic_crowd"
      },
      Professional: {
        name: "Professional Crowd Engagement",
        description: "Lead chants, call-and-response, and emotional peak moments.",
        slug: "stage_professional_crowd"
      },
      Mastery: {
        name: "Crowd Engagement Mastery",
        description: "Turn every audience into superfans through unforgettable interaction.",
        slug: "stage_mastery_crowd"
      }
    }
  }
];

const { definitions, relationships } = buildSkillTree([
  ...songwritingProductionConfigs,
  ...genreConfigs,
  ...instrumentsConfigs,
  ...instrumentMasteryConfigs,
  ...stageShowmanshipConfigs
]);

export const SKILL_TREE_DEFINITIONS: SkillDefinitionRecord[] = definitions;
export const SKILL_TREE_RELATIONSHIPS: SkillRelationshipRecord[] = relationships;
