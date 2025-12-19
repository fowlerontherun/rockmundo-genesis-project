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

// ============================================================================
// SONGWRITING & PRODUCTION SKILLS
// ============================================================================
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

// ============================================================================
// GENRE SKILLS
// ============================================================================
export const GENRE_LIST = [
  "Rock", "Pop", "Hip Hop", "Jazz", "Blues", "Country", "Reggae", "Heavy Metal",
  "Classical", "Electronica", "Latin", "World Music", "R&B", "Punk Rock", "Flamenco",
  "African Music", "Modern Rock", "EDM", "Trap", "Drill", "Lo-Fi Hip Hop",
  "K-Pop/J-Pop", "Afrobeats/Amapiano", "Synthwave", "Indie/Bedroom Pop", "Hyperpop",
  "Metalcore/Djent", "Alt R&B/Neo-Soul", "Funk", "Soul", "Gospel", "Folk",
  "Bluegrass", "Celtic", "Ska", "Grunge", "Progressive Rock", "Ambient",
  "Industrial", "Dubstep", "House", "Techno", "Trance", "Drum and Bass"
] as const;

const genreTracks = [...GENRE_LIST];

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

// ============================================================================
// SPECIFIC STRING INSTRUMENTS
// ============================================================================
const stringInstrumentConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Acoustic Guitar",
    icon: "guitar",
    tiers: {
      Basic: {
        name: "Basic Acoustic Guitar",
        description: "Master open chords, strumming patterns, and fingerpicking fundamentals.",
        slug: "instruments_basic_acoustic_guitar"
      },
      Professional: {
        name: "Professional Acoustic Guitar",
        description: "Perform advanced fingerstyle, alternate tunings, and acoustic arrangements.",
        slug: "instruments_professional_acoustic_guitar"
      },
      Mastery: {
        name: "Acoustic Guitar Mastery",
        description: "Deliver virtuosic acoustic performances with percussive techniques and complex harmonics.",
        slug: "instruments_mastery_acoustic_guitar"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Classical Guitar",
    icon: "guitar",
    tiers: {
      Basic: {
        name: "Basic Classical Guitar",
        description: "Learn proper hand position, nylon string technique, and classical repertoire basics.",
        slug: "instruments_basic_classical_guitar"
      },
      Professional: {
        name: "Professional Classical Guitar",
        description: "Master tremolo, arpeggios, and Spanish guitar techniques with refined tone.",
        slug: "instruments_professional_classical_guitar"
      },
      Mastery: {
        name: "Classical Guitar Mastery",
        description: "Perform concert-level classical pieces with expressive dynamics and flawless technique.",
        slug: "instruments_mastery_classical_guitar"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Electric Guitar",
    icon: "guitar",
    tiers: {
      Basic: {
        name: "Basic Electric Guitar",
        description: "Learn power chords, distortion tones, and electric guitar fundamentals.",
        slug: "instruments_basic_electric_guitar"
      },
      Professional: {
        name: "Professional Electric Guitar",
        description: "Master bending, vibrato, effects pedals, and genre-specific techniques.",
        slug: "instruments_professional_electric_guitar"
      },
      Mastery: {
        name: "Electric Guitar Mastery",
        description: "Deliver arena-ready solos with tapping, sweep picking, and signature tone crafting.",
        slug: "instruments_mastery_electric_guitar"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Bass Guitar",
    icon: "bass",
    tiers: {
      Basic: {
        name: "Basic Bass Guitar",
        description: "Lock into the pocket with fingerstyle, pick technique, and groove fundamentals.",
        slug: "instruments_basic_bass_guitar"
      },
      Professional: {
        name: "Professional Bass Guitar",
        description: "Develop slap and pop, walking bass lines, and tight ensemble precision.",
        slug: "instruments_professional_bass_guitar"
      },
      Mastery: {
        name: "Bass Guitar Mastery",
        description: "Command the low end with virtuosic technique, fills, and harmonic sophistication.",
        slug: "instruments_mastery_bass_guitar"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Upright Bass",
    icon: "bass",
    tiers: {
      Basic: {
        name: "Basic Upright Bass",
        description: "Learn proper posture, intonation, and pizzicato technique on double bass.",
        slug: "instruments_basic_upright_bass"
      },
      Professional: {
        name: "Professional Upright Bass",
        description: "Master arco bowing, jazz walking lines, and orchestral phrasing.",
        slug: "instruments_professional_upright_bass"
      },
      Mastery: {
        name: "Upright Bass Mastery",
        description: "Perform virtuosic solos and lead sections with impeccable tone and timing.",
        slug: "instruments_mastery_upright_bass"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Violin",
    icon: "strings",
    tiers: {
      Basic: {
        name: "Basic Violin",
        description: "Develop bow control, intonation, and first position fundamentals.",
        slug: "instruments_basic_violin"
      },
      Professional: {
        name: "Professional Violin",
        description: "Master shifting, vibrato, and advanced bowing techniques across styles.",
        slug: "instruments_professional_violin"
      },
      Mastery: {
        name: "Violin Mastery",
        description: "Deliver concerto-level performances with expressive phrasing and virtuosic command.",
        slug: "instruments_mastery_violin"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Viola",
    icon: "strings",
    tiers: {
      Basic: {
        name: "Basic Viola",
        description: "Learn alto clef reading, proper bow weight, and viola-specific technique.",
        slug: "instruments_basic_viola"
      },
      Professional: {
        name: "Professional Viola",
        description: "Master warm mid-register tone, chamber music, and orchestral phrasing.",
        slug: "instruments_professional_viola"
      },
      Mastery: {
        name: "Viola Mastery",
        description: "Lead viola sections with rich tone, expressive solos, and ensemble leadership.",
        slug: "instruments_mastery_viola"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Cello",
    icon: "strings",
    tiers: {
      Basic: {
        name: "Basic Cello",
        description: "Develop proper posture, bow technique, and bass clef reading.",
        slug: "instruments_basic_cello"
      },
      Professional: {
        name: "Professional Cello",
        description: "Master expressive vibrato, thumb position, and solo repertoire.",
        slug: "instruments_professional_cello"
      },
      Mastery: {
        name: "Cello Mastery",
        description: "Deliver emotionally powerful performances with virtuosic technique and rich tone.",
        slug: "instruments_mastery_cello"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Banjo",
    icon: "strings",
    tiers: {
      Basic: {
        name: "Basic Banjo",
        description: "Learn clawhammer and three-finger picking on 5-string banjo.",
        slug: "instruments_basic_banjo"
      },
      Professional: {
        name: "Professional Banjo",
        description: "Master Scruggs-style rolls, melodic playing, and bluegrass repertoire.",
        slug: "instruments_professional_banjo"
      },
      Mastery: {
        name: "Banjo Mastery",
        description: "Deliver blazing bluegrass solos and innovative cross-genre performances.",
        slug: "instruments_mastery_banjo"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Mandolin",
    icon: "strings",
    tiers: {
      Basic: {
        name: "Basic Mandolin",
        description: "Learn chords, tremolo technique, and basic melody playing.",
        slug: "instruments_basic_mandolin"
      },
      Professional: {
        name: "Professional Mandolin",
        description: "Master bluegrass leads, Celtic ornamentation, and ensemble playing.",
        slug: "instruments_professional_mandolin"
      },
      Mastery: {
        name: "Mandolin Mastery",
        description: "Perform virtuosic solos with speed, accuracy, and stylistic authenticity.",
        slug: "instruments_mastery_mandolin"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Ukulele",
    icon: "strings",
    tiers: {
      Basic: {
        name: "Basic Ukulele",
        description: "Master chord shapes, strumming patterns, and Hawaiian style basics.",
        slug: "instruments_basic_ukulele"
      },
      Professional: {
        name: "Professional Ukulele",
        description: "Develop fingerstyle arrangements, campanella technique, and advanced repertoire.",
        slug: "instruments_professional_ukulele"
      },
      Mastery: {
        name: "Ukulele Mastery",
        description: "Deliver show-stopping performances with virtuosic technique across genres.",
        slug: "instruments_mastery_ukulele"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Harp",
    icon: "strings",
    tiers: {
      Basic: {
        name: "Basic Harp",
        description: "Learn proper hand position, pedal operation, and glissando technique.",
        slug: "instruments_basic_harp"
      },
      Professional: {
        name: "Professional Harp",
        description: "Master complex pedal changes, harmonics, and orchestral repertoire.",
        slug: "instruments_professional_harp"
      },
      Mastery: {
        name: "Harp Mastery",
        description: "Perform concerto-level pieces with ethereal tone and virtuosic command.",
        slug: "instruments_mastery_harp"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "12-String Guitar",
    icon: "guitar",
    tiers: {
      Basic: {
        name: "Basic 12-String Guitar",
        description: "Learn to handle the wider neck and doubled strings for rich chord tones.",
        slug: "instruments_basic_12_string_guitar"
      },
      Professional: {
        name: "Professional 12-String Guitar",
        description: "Master the jangly textures, folk accompaniment, and unique voicings.",
        slug: "instruments_professional_12_string_guitar"
      },
      Mastery: {
        name: "12-String Guitar Mastery",
        description: "Create shimmering, layered performances with impeccable intonation and control.",
        slug: "instruments_mastery_12_string_guitar"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Pedal Steel Guitar",
    icon: "guitar",
    tiers: {
      Basic: {
        name: "Basic Pedal Steel Guitar",
        description: "Learn bar technique, pedal/knee lever coordination, and country basics.",
        slug: "instruments_basic_pedal_steel"
      },
      Professional: {
        name: "Professional Pedal Steel",
        description: "Master crying bends, complex chord voicings, and session-ready playing.",
        slug: "instruments_professional_pedal_steel"
      },
      Mastery: {
        name: "Pedal Steel Mastery",
        description: "Deliver iconic pedal steel solos with expressive bends and unique textures.",
        slug: "instruments_mastery_pedal_steel"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Lap Steel Guitar",
    icon: "guitar",
    tiers: {
      Basic: {
        name: "Basic Lap Steel Guitar",
        description: "Learn bar slide technique and open tuning fundamentals.",
        slug: "instruments_basic_lap_steel"
      },
      Professional: {
        name: "Professional Lap Steel",
        description: "Master Hawaiian slack-key, blues slide, and volume swells.",
        slug: "instruments_professional_lap_steel"
      },
      Mastery: {
        name: "Lap Steel Mastery",
        description: "Create haunting slide performances with perfect intonation and expression.",
        slug: "instruments_mastery_lap_steel"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Dobro/Resonator",
    icon: "guitar",
    tiers: {
      Basic: {
        name: "Basic Dobro/Resonator",
        description: "Learn slide technique and bluegrass resonator basics.",
        slug: "instruments_basic_dobro"
      },
      Professional: {
        name: "Professional Dobro",
        description: "Master intricate bluegrass licks and hybrid picking on resonator.",
        slug: "instruments_professional_dobro"
      },
      Mastery: {
        name: "Dobro Mastery",
        description: "Deliver blazing resonator solos with precision and authentic tone.",
        slug: "instruments_mastery_dobro"
      }
    }
  }
];

// ============================================================================
// KEYBOARD & PIANO INSTRUMENTS
// ============================================================================
const keyboardConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Classical Piano",
    icon: "piano",
    tiers: {
      Basic: {
        name: "Basic Classical Piano",
        description: "Develop proper technique, sight-reading, and classical repertoire foundations.",
        slug: "instruments_basic_classical_piano"
      },
      Professional: {
        name: "Professional Classical Piano",
        description: "Master advanced repertoire, pedaling, and expressive dynamics.",
        slug: "instruments_professional_classical_piano"
      },
      Mastery: {
        name: "Classical Piano Mastery",
        description: "Perform concert-level pieces with technical brilliance and artistic depth.",
        slug: "instruments_mastery_classical_piano"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Jazz Piano",
    icon: "piano",
    tiers: {
      Basic: {
        name: "Basic Jazz Piano",
        description: "Learn shell voicings, swing comping, and ii-V-I progressions.",
        slug: "instruments_basic_jazz_piano"
      },
      Professional: {
        name: "Professional Jazz Piano",
        description: "Improvise with extended harmony, stride variations, and reharmonization.",
        slug: "instruments_professional_jazz_piano"
      },
      Mastery: {
        name: "Jazz Piano Mastery",
        description: "Command trio settings with modal improvisation and harmonic storytelling.",
        slug: "instruments_mastery_jazz_piano"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Hammond Organ",
    icon: "organ",
    tiers: {
      Basic: {
        name: "Basic Hammond Organ",
        description: "Learn drawbar registration, percussion switch, and basic gospel/jazz comping.",
        slug: "instruments_basic_hammond_organ"
      },
      Professional: {
        name: "Professional Hammond Organ",
        description: "Master Leslie speaker control, jazz voicings, and registration changes.",
        slug: "instruments_professional_hammond_organ"
      },
      Mastery: {
        name: "Hammond Organ Mastery",
        description: "Deliver soulful performances with signature tone and improvisational fire.",
        slug: "instruments_mastery_hammond_organ"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Pipe Organ",
    icon: "organ",
    tiers: {
      Basic: {
        name: "Basic Pipe Organ",
        description: "Learn manual technique, pedalboard, and registration fundamentals.",
        slug: "instruments_basic_pipe_organ"
      },
      Professional: {
        name: "Professional Pipe Organ",
        description: "Master Bach repertoire, complex registrations, and liturgical playing.",
        slug: "instruments_professional_pipe_organ"
      },
      Mastery: {
        name: "Pipe Organ Mastery",
        description: "Command cathedral instruments with virtuosic technique and profound musicality.",
        slug: "instruments_mastery_pipe_organ"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Rhodes Piano",
    icon: "piano",
    tiers: {
      Basic: {
        name: "Basic Rhodes Piano",
        description: "Learn the distinctive bell-like tone and dynamic touch of electric piano.",
        slug: "instruments_basic_rhodes"
      },
      Professional: {
        name: "Professional Rhodes Piano",
        description: "Master neo-soul voicings, tremolo control, and warm tonal shaping.",
        slug: "instruments_professional_rhodes"
      },
      Mastery: {
        name: "Rhodes Piano Mastery",
        description: "Deliver signature electric piano performances with soulful expression.",
        slug: "instruments_mastery_rhodes"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Wurlitzer",
    icon: "piano",
    tiers: {
      Basic: {
        name: "Basic Wurlitzer",
        description: "Explore the reedy tone and unique character of the Wurlitzer electric piano.",
        slug: "instruments_basic_wurlitzer"
      },
      Professional: {
        name: "Professional Wurlitzer",
        description: "Master the biting edge and vintage textures in rock and pop contexts.",
        slug: "instruments_professional_wurlitzer"
      },
      Mastery: {
        name: "Wurlitzer Mastery",
        description: "Create iconic Wurlitzer tones with perfect touch sensitivity and expression.",
        slug: "instruments_mastery_wurlitzer"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Accordion",
    icon: "accordion",
    tiers: {
      Basic: {
        name: "Basic Accordion",
        description: "Learn bellows control, bass buttons, and fundamental folk patterns.",
        slug: "instruments_basic_accordion"
      },
      Professional: {
        name: "Professional Accordion",
        description: "Master button accordion, register changes, and cross-cultural styles.",
        slug: "instruments_professional_accordion"
      },
      Mastery: {
        name: "Accordion Mastery",
        description: "Perform virtuosic accordion across zydeco, tango, and classical styles.",
        slug: "instruments_mastery_accordion"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Harpsichord",
    icon: "piano",
    tiers: {
      Basic: {
        name: "Basic Harpsichord",
        description: "Learn baroque articulation, registration, and period technique.",
        slug: "instruments_basic_harpsichord"
      },
      Professional: {
        name: "Professional Harpsichord",
        description: "Master ornamentation, continuo playing, and baroque repertoire.",
        slug: "instruments_professional_harpsichord"
      },
      Mastery: {
        name: "Harpsichord Mastery",
        description: "Deliver historically informed performances with virtuosic command.",
        slug: "instruments_mastery_harpsichord"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Clavinet",
    icon: "piano",
    tiers: {
      Basic: {
        name: "Basic Clavinet",
        description: "Learn the funky, percussive attack and basic playing techniques.",
        slug: "instruments_basic_clavinet"
      },
      Professional: {
        name: "Professional Clavinet",
        description: "Master wah pedal integration, muting techniques, and funk grooves.",
        slug: "instruments_professional_clavinet"
      },
      Mastery: {
        name: "Clavinet Mastery",
        description: "Deliver iconic Stevie Wonder-style performances with precision and groove.",
        slug: "instruments_mastery_clavinet"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Mellotron",
    icon: "synth",
    tiers: {
      Basic: {
        name: "Basic Mellotron",
        description: "Learn the unique tape-based sound and its role in progressive rock.",
        slug: "instruments_basic_mellotron"
      },
      Professional: {
        name: "Professional Mellotron",
        description: "Master tape section selection, expression, and period-appropriate playing.",
        slug: "instruments_professional_mellotron"
      },
      Mastery: {
        name: "Mellotron Mastery",
        description: "Create ethereal, otherworldly textures with expert Mellotron control.",
        slug: "instruments_mastery_mellotron"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Celesta",
    icon: "piano",
    tiers: {
      Basic: {
        name: "Basic Celesta",
        description: "Learn the delicate touch and bell-like tone of the celesta.",
        slug: "instruments_basic_celesta"
      },
      Professional: {
        name: "Professional Celesta",
        description: "Master orchestral passages and the instrument's unique tonal palette.",
        slug: "instruments_professional_celesta"
      },
      Mastery: {
        name: "Celesta Mastery",
        description: "Deliver magical, shimmering performances in orchestral and solo contexts.",
        slug: "instruments_mastery_celesta"
      }
    }
  }
];

// ============================================================================
// PERCUSSION & DRUMS
// ============================================================================
const percussionConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Rock Drum Kit",
    icon: "drums",
    tiers: {
      Basic: {
        name: "Basic Rock Drums",
        description: "Learn standard grooves, fills, and rock drumming fundamentals.",
        slug: "instruments_basic_rock_drums"
      },
      Professional: {
        name: "Professional Rock Drums",
        description: "Master power fills, dynamic control, and stadium-ready drumming.",
        slug: "instruments_professional_rock_drums"
      },
      Mastery: {
        name: "Rock Drums Mastery",
        description: "Deliver arena-shaking performances with explosive technique and feel.",
        slug: "instruments_mastery_rock_drums"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Jazz Drums",
    icon: "drums",
    tiers: {
      Basic: {
        name: "Basic Jazz Drums",
        description: "Learn brush technique, swing patterns, and jazz time-keeping.",
        slug: "instruments_basic_jazz_drums"
      },
      Professional: {
        name: "Professional Jazz Drums",
        description: "Master bebop coordination, trading fours, and conversational playing.",
        slug: "instruments_professional_jazz_drums"
      },
      Mastery: {
        name: "Jazz Drums Mastery",
        description: "Command the drum chair with subtle dynamics and improvisational brilliance.",
        slug: "instruments_mastery_jazz_drums"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Latin Percussion",
    icon: "percussion",
    tiers: {
      Basic: {
        name: "Basic Latin Percussion",
        description: "Learn conga tones, bongo patterns, and timbale fundamentals.",
        slug: "instruments_basic_latin_percussion"
      },
      Professional: {
        name: "Professional Latin Percussion",
        description: "Master son clave, guaguancó, and authentic Afro-Cuban rhythms.",
        slug: "instruments_professional_latin_percussion"
      },
      Mastery: {
        name: "Latin Percussion Mastery",
        description: "Lead percussion sections with fire, authenticity, and improvisational flair.",
        slug: "instruments_mastery_latin_percussion"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "African Drumming",
    icon: "percussion",
    tiers: {
      Basic: {
        name: "Basic African Drumming",
        description: "Learn djembe tones, traditional rhythms, and call-and-response.",
        slug: "instruments_basic_african_drums"
      },
      Professional: {
        name: "Professional African Drumming",
        description: "Master dundun ensemble, talking drum, and West African polyrhythms.",
        slug: "instruments_professional_african_drums"
      },
      Mastery: {
        name: "African Drumming Mastery",
        description: "Lead drum circles with authentic technique and cultural understanding.",
        slug: "instruments_mastery_african_drums"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Tabla",
    icon: "percussion",
    tiers: {
      Basic: {
        name: "Basic Tabla",
        description: "Learn basic bols, hand positions, and simple compositions.",
        slug: "instruments_basic_tabla"
      },
      Professional: {
        name: "Professional Tabla",
        description: "Master kaidas, relas, and accompaniment in classical contexts.",
        slug: "instruments_professional_tabla"
      },
      Mastery: {
        name: "Tabla Mastery",
        description: "Perform virtuosic tabla with gharana-specific technique and improvisation.",
        slug: "instruments_mastery_tabla"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Marimba",
    icon: "mallet",
    tiers: {
      Basic: {
        name: "Basic Marimba",
        description: "Learn two and four-mallet technique with proper stroke and tone.",
        slug: "instruments_basic_marimba"
      },
      Professional: {
        name: "Professional Marimba",
        description: "Master Stevens grip, rapid passages, and solo repertoire.",
        slug: "instruments_professional_marimba"
      },
      Mastery: {
        name: "Marimba Mastery",
        description: "Deliver virtuosic performances with independence and musical expression.",
        slug: "instruments_mastery_marimba"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Vibraphone",
    icon: "mallet",
    tiers: {
      Basic: {
        name: "Basic Vibraphone",
        description: "Learn dampening, motor control, and jazz vibraphone basics.",
        slug: "instruments_basic_vibraphone"
      },
      Professional: {
        name: "Professional Vibraphone",
        description: "Master four-mallet jazz comping and improvisation techniques.",
        slug: "instruments_professional_vibraphone"
      },
      Mastery: {
        name: "Vibraphone Mastery",
        description: "Create shimmering jazz performances with harmonic sophistication.",
        slug: "instruments_mastery_vibraphone"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Timpani",
    icon: "mallet",
    tiers: {
      Basic: {
        name: "Basic Timpani",
        description: "Learn tuning, proper stroke, and basic orchestral excerpts.",
        slug: "instruments_basic_timpani"
      },
      Professional: {
        name: "Professional Timpani",
        description: "Master rapid tuning changes, rolls, and major orchestral repertoire.",
        slug: "instruments_professional_timpani"
      },
      Mastery: {
        name: "Timpani Mastery",
        description: "Command the timpani section with precision and musical authority.",
        slug: "instruments_mastery_timpani"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Snare Drum",
    icon: "drums",
    tiers: {
      Basic: {
        name: "Basic Snare Drum",
        description: "Learn rudiments, matched grip, and basic snare technique.",
        slug: "instruments_basic_snare"
      },
      Professional: {
        name: "Professional Snare Drum",
        description: "Master rudimental solos, orchestral excerpts, and corps-style drumming.",
        slug: "instruments_professional_snare"
      },
      Mastery: {
        name: "Snare Drum Mastery",
        description: "Deliver competition-ready performances with blazing technique.",
        slug: "instruments_mastery_snare"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Steelpan",
    icon: "percussion",
    tiers: {
      Basic: {
        name: "Basic Steelpan",
        description: "Learn note layout, mallet technique, and Caribbean rhythms.",
        slug: "instruments_basic_steelpan"
      },
      Professional: {
        name: "Professional Steelpan",
        description: "Master chromatic playing, arranging, and steel band ensemble.",
        slug: "instruments_professional_steelpan"
      },
      Mastery: {
        name: "Steelpan Mastery",
        description: "Lead panorama performances with virtuosic technique and expression.",
        slug: "instruments_mastery_steelpan"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Taiko",
    icon: "drums",
    tiers: {
      Basic: {
        name: "Basic Taiko",
        description: "Learn proper stance, striking technique, and basic patterns.",
        slug: "instruments_basic_taiko"
      },
      Professional: {
        name: "Professional Taiko",
        description: "Master ensemble playing, choreography, and various drum types.",
        slug: "instruments_professional_taiko"
      },
      Mastery: {
        name: "Taiko Mastery",
        description: "Lead powerful taiko performances with athleticism and showmanship.",
        slug: "instruments_mastery_taiko"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Cajon",
    icon: "percussion",
    tiers: {
      Basic: {
        name: "Basic Cajon",
        description: "Learn bass and slap tones, flamenco patterns, and pop grooves.",
        slug: "instruments_basic_cajon"
      },
      Professional: {
        name: "Professional Cajon",
        description: "Master brush techniques, heel-toe, and acoustic band integration.",
        slug: "instruments_professional_cajon"
      },
      Mastery: {
        name: "Cajon Mastery",
        description: "Deliver dynamic performances as a complete rhythm section.",
        slug: "instruments_mastery_cajon"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Xylophone",
    icon: "mallet",
    tiers: {
      Basic: {
        name: "Basic Xylophone",
        description: "Learn mallet grip, keyboard geography, and orchestral basics.",
        slug: "instruments_basic_xylophone"
      },
      Professional: {
        name: "Professional Xylophone",
        description: "Master ragtime, orchestral excerpts, and rapid passage work.",
        slug: "instruments_professional_xylophone"
      },
      Mastery: {
        name: "Xylophone Mastery",
        description: "Perform virtuosic solos with crystal clarity and precision.",
        slug: "instruments_mastery_xylophone"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Glockenspiel",
    icon: "mallet",
    tiers: {
      Basic: {
        name: "Basic Glockenspiel",
        description: "Learn delicate touch and bright tone production on orchestral bells.",
        slug: "instruments_basic_glockenspiel"
      },
      Professional: {
        name: "Professional Glockenspiel",
        description: "Master orchestral excerpts and ensemble balancing techniques.",
        slug: "instruments_professional_glockenspiel"
      },
      Mastery: {
        name: "Glockenspiel Mastery",
        description: "Deliver sparkling performances with perfect intonation and timing.",
        slug: "instruments_mastery_glockenspiel"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Frame Drum",
    icon: "percussion",
    tiers: {
      Basic: {
        name: "Basic Frame Drum",
        description: "Learn lap technique, finger rolls, and world music patterns.",
        slug: "instruments_basic_frame_drum"
      },
      Professional: {
        name: "Professional Frame Drum",
        description: "Master tar, bodhran, and Middle Eastern frame drum techniques.",
        slug: "instruments_professional_frame_drum"
      },
      Mastery: {
        name: "Frame Drum Mastery",
        description: "Create mesmerizing performances with advanced ornamentation and dynamics.",
        slug: "instruments_mastery_frame_drum"
      }
    }
  }
];

// ============================================================================
// WIND INSTRUMENTS
// ============================================================================
const windConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Flute",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Flute",
        description: "Develop embouchure, breath support, and tone production fundamentals.",
        slug: "instruments_basic_flute"
      },
      Professional: {
        name: "Professional Flute",
        description: "Master vibrato, extended range, and classical/jazz repertoire.",
        slug: "instruments_professional_flute"
      },
      Mastery: {
        name: "Flute Mastery",
        description: "Deliver virtuosic performances with extended techniques and expression.",
        slug: "instruments_mastery_flute"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Clarinet",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Clarinet",
        description: "Learn embouchure, crossing the break, and tonal foundations.",
        slug: "instruments_basic_clarinet"
      },
      Professional: {
        name: "Professional Clarinet",
        description: "Master altissimo, klezmer, and classical/jazz techniques.",
        slug: "instruments_professional_clarinet"
      },
      Mastery: {
        name: "Clarinet Mastery",
        description: "Perform with liquid tone and virtuosic command across all registers.",
        slug: "instruments_mastery_clarinet"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Oboe",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Oboe",
        description: "Learn reed making basics, embouchure, and orchestral fundamentals.",
        slug: "instruments_basic_oboe"
      },
      Professional: {
        name: "Professional Oboe",
        description: "Master major excerpts, English horn, and chamber music.",
        slug: "instruments_professional_oboe"
      },
      Mastery: {
        name: "Oboe Mastery",
        description: "Lead orchestral wind sections with impeccable tone and intonation.",
        slug: "instruments_mastery_oboe"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Bassoon",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Bassoon",
        description: "Learn reed selection, breath support, and bass clef reading.",
        slug: "instruments_basic_bassoon"
      },
      Professional: {
        name: "Professional Bassoon",
        description: "Master tenor clef, major excerpts, and chamber repertoire.",
        slug: "instruments_professional_bassoon"
      },
      Mastery: {
        name: "Bassoon Mastery",
        description: "Deliver virtuosic performances with character and precision.",
        slug: "instruments_mastery_bassoon"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Alto Saxophone",
    icon: "saxophone",
    tiers: {
      Basic: {
        name: "Basic Alto Saxophone",
        description: "Learn embouchure, tone production, and fundamental jazz voicings.",
        slug: "instruments_basic_alto_sax"
      },
      Professional: {
        name: "Professional Alto Saxophone",
        description: "Master bebop vocabulary, altissimo, and section playing.",
        slug: "instruments_professional_alto_sax"
      },
      Mastery: {
        name: "Alto Saxophone Mastery",
        description: "Deliver virtuosic jazz and classical performances with signature voice.",
        slug: "instruments_mastery_alto_sax"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Tenor Saxophone",
    icon: "saxophone",
    tiers: {
      Basic: {
        name: "Basic Tenor Saxophone",
        description: "Develop the warm, rich tenor tone and jazz fundamentals.",
        slug: "instruments_basic_tenor_sax"
      },
      Professional: {
        name: "Professional Tenor Saxophone",
        description: "Master Coltrane changes, subtone, and soul saxophone techniques.",
        slug: "instruments_professional_tenor_sax"
      },
      Mastery: {
        name: "Tenor Saxophone Mastery",
        description: "Create iconic tenor solos with personal voice and fire.",
        slug: "instruments_mastery_tenor_sax"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Soprano Saxophone",
    icon: "saxophone",
    tiers: {
      Basic: {
        name: "Basic Soprano Saxophone",
        description: "Learn to control intonation and develop the unique soprano voice.",
        slug: "instruments_basic_soprano_sax"
      },
      Professional: {
        name: "Professional Soprano Saxophone",
        description: "Master the challenging intonation and expressive upper register.",
        slug: "instruments_professional_soprano_sax"
      },
      Mastery: {
        name: "Soprano Saxophone Mastery",
        description: "Deliver haunting soprano performances with perfect pitch and expression.",
        slug: "instruments_mastery_soprano_sax"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Baritone Saxophone",
    icon: "saxophone",
    tiers: {
      Basic: {
        name: "Basic Baritone Saxophone",
        description: "Learn to handle the large instrument with solid fundamentals.",
        slug: "instruments_basic_bari_sax"
      },
      Professional: {
        name: "Professional Baritone Saxophone",
        description: "Master anchoring big band sections and solo playing.",
        slug: "instruments_professional_bari_sax"
      },
      Mastery: {
        name: "Baritone Saxophone Mastery",
        description: "Deliver thundering baritone solos with agility and power.",
        slug: "instruments_mastery_bari_sax"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Recorder",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Recorder",
        description: "Learn proper baroque articulation and early music technique.",
        slug: "instruments_basic_recorder"
      },
      Professional: {
        name: "Professional Recorder",
        description: "Master historical performance practice and virtuoso repertoire.",
        slug: "instruments_professional_recorder"
      },
      Mastery: {
        name: "Recorder Mastery",
        description: "Perform at concert level with historically informed brilliance.",
        slug: "instruments_mastery_recorder"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Harmonica",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Harmonica",
        description: "Learn single notes, bending, and blues harp fundamentals.",
        slug: "instruments_basic_harmonica"
      },
      Professional: {
        name: "Professional Harmonica",
        description: "Master chromatic harmonica, overblows, and advanced blues.",
        slug: "instruments_professional_harmonica"
      },
      Mastery: {
        name: "Harmonica Mastery",
        description: "Deliver soul-stirring blues and virtuosic chromatic performances.",
        slug: "instruments_mastery_harmonica"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Pan Flute",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Pan Flute",
        description: "Learn breath control and Andean pan flute fundamentals.",
        slug: "instruments_basic_pan_flute"
      },
      Professional: {
        name: "Professional Pan Flute",
        description: "Master circular breathing and world music repertoire.",
        slug: "instruments_professional_pan_flute"
      },
      Mastery: {
        name: "Pan Flute Mastery",
        description: "Create evocative performances with authentic technique and expression.",
        slug: "instruments_mastery_pan_flute"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Bagpipes",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Bagpipes",
        description: "Learn bag control, chanter fingering, and traditional tunes.",
        slug: "instruments_basic_bagpipes"
      },
      Professional: {
        name: "Professional Bagpipes",
        description: "Master piobaireachd, competition standards, and drone tuning.",
        slug: "instruments_professional_bagpipes"
      },
      Mastery: {
        name: "Bagpipes Mastery",
        description: "Deliver championship-level piping with flawless technique.",
        slug: "instruments_mastery_bagpipes"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Didgeridoo",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Didgeridoo",
        description: "Learn circular breathing and fundamental drone technique.",
        slug: "instruments_basic_didgeridoo"
      },
      Professional: {
        name: "Professional Didgeridoo",
        description: "Master rhythmic patterns, overtones, and animal sounds.",
        slug: "instruments_professional_didgeridoo"
      },
      Mastery: {
        name: "Didgeridoo Mastery",
        description: "Create hypnotic performances with expert circular breathing and rhythm.",
        slug: "instruments_mastery_didgeridoo"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Piccolo",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Piccolo",
        description: "Learn to control the high register and piccolo-specific embouchure.",
        slug: "instruments_basic_piccolo"
      },
      Professional: {
        name: "Professional Piccolo",
        description: "Master major orchestral excerpts and marching band techniques.",
        slug: "instruments_professional_piccolo"
      },
      Mastery: {
        name: "Piccolo Mastery",
        description: "Deliver soaring piccolo passages with perfect intonation and brilliance.",
        slug: "instruments_mastery_piccolo"
      }
    }
  }
];

// ============================================================================
// BRASS INSTRUMENTS
// ============================================================================
const brassConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Trumpet",
    icon: "brass",
    tiers: {
      Basic: {
        name: "Basic Trumpet",
        description: "Develop embouchure, breath support, and fundamental range.",
        slug: "instruments_basic_trumpet"
      },
      Professional: {
        name: "Professional Trumpet",
        description: "Master upper register, jazz improvisation, and lead playing.",
        slug: "instruments_professional_trumpet"
      },
      Mastery: {
        name: "Trumpet Mastery",
        description: "Deliver screaming lead or virtuosic classical with signature sound.",
        slug: "instruments_mastery_trumpet"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Trombone",
    icon: "brass",
    tiers: {
      Basic: {
        name: "Basic Trombone",
        description: "Learn slide positions, embouchure, and legato technique.",
        slug: "instruments_basic_trombone"
      },
      Professional: {
        name: "Professional Trombone",
        description: "Master jazz improvisation, trigger use, and section playing.",
        slug: "instruments_professional_trombone"
      },
      Mastery: {
        name: "Trombone Mastery",
        description: "Deliver virtuosic solos and lead section work with power and finesse.",
        slug: "instruments_mastery_trombone"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "French Horn",
    icon: "brass",
    tiers: {
      Basic: {
        name: "Basic French Horn",
        description: "Learn hand position, embouchure, and fundamental technique.",
        slug: "instruments_basic_french_horn"
      },
      Professional: {
        name: "Professional French Horn",
        description: "Master stopped horn, transposition, and major excerpts.",
        slug: "instruments_professional_french_horn"
      },
      Mastery: {
        name: "French Horn Mastery",
        description: "Command the horn with warm tone, accurate attacks, and musical depth.",
        slug: "instruments_mastery_french_horn"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Tuba",
    icon: "brass",
    tiers: {
      Basic: {
        name: "Basic Tuba",
        description: "Learn breath support, embouchure, and low brass fundamentals.",
        slug: "instruments_basic_tuba"
      },
      Professional: {
        name: "Professional Tuba",
        description: "Master brass band, orchestral, and solo repertoire.",
        slug: "instruments_professional_tuba"
      },
      Mastery: {
        name: "Tuba Mastery",
        description: "Deliver powerful foundation and virtuosic solos with agility.",
        slug: "instruments_mastery_tuba"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Euphonium",
    icon: "brass",
    tiers: {
      Basic: {
        name: "Basic Euphonium",
        description: "Develop the warm, lyrical tone and brass band fundamentals.",
        slug: "instruments_basic_euphonium"
      },
      Professional: {
        name: "Professional Euphonium",
        description: "Master British brass band style and solo repertoire.",
        slug: "instruments_professional_euphonium"
      },
      Mastery: {
        name: "Euphonium Mastery",
        description: "Create singing, virtuosic performances with rich golden tone.",
        slug: "instruments_mastery_euphonium"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Flugelhorn",
    icon: "brass",
    tiers: {
      Basic: {
        name: "Basic Flugelhorn",
        description: "Learn the mellow tone and jazz ballad playing fundamentals.",
        slug: "instruments_basic_flugelhorn"
      },
      Professional: {
        name: "Professional Flugelhorn",
        description: "Master warm jazz phrasing and lyrical solo playing.",
        slug: "instruments_professional_flugelhorn"
      },
      Mastery: {
        name: "Flugelhorn Mastery",
        description: "Deliver intimate, expressive jazz performances with signature warmth.",
        slug: "instruments_mastery_flugelhorn"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Cornet",
    icon: "brass",
    tiers: {
      Basic: {
        name: "Basic Cornet",
        description: "Learn the conical bore tone and brass band traditions.",
        slug: "instruments_basic_cornet"
      },
      Professional: {
        name: "Professional Cornet",
        description: "Master British brass band principal and solo playing.",
        slug: "instruments_professional_cornet"
      },
      Mastery: {
        name: "Cornet Mastery",
        description: "Lead brass bands with agile, sweet-toned virtuosity.",
        slug: "instruments_mastery_cornet"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Sousaphone",
    icon: "brass",
    tiers: {
      Basic: {
        name: "Basic Sousaphone",
        description: "Learn marching technique and the massive wrap-around instrument.",
        slug: "instruments_basic_sousaphone"
      },
      Professional: {
        name: "Professional Sousaphone",
        description: "Master New Orleans second line and marching band styles.",
        slug: "instruments_professional_sousaphone"
      },
      Mastery: {
        name: "Sousaphone Mastery",
        description: "Deliver powerful street performances with infectious groove.",
        slug: "instruments_mastery_sousaphone"
      }
    }
  }
];

// ============================================================================
// ELECTRONIC & MODERN INSTRUMENTS
// ============================================================================
const electronicConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Turntablism",
    icon: "dj",
    tiers: {
      Basic: {
        name: "Basic Turntablism",
        description: "Learn scratching techniques, cueing, and basic beat juggling.",
        slug: "instruments_basic_turntablism"
      },
      Professional: {
        name: "Professional Turntablism",
        description: "Master chirps, crabs, flares, and battle-ready routines.",
        slug: "instruments_professional_turntablism"
      },
      Mastery: {
        name: "Turntablism Mastery",
        description: "Deliver championship-level scratch performances and routines.",
        slug: "instruments_mastery_turntablism"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Ableton Push/Launchpad",
    icon: "controller",
    tiers: {
      Basic: {
        name: "Basic Push/Launchpad",
        description: "Learn clip launching, finger drumming, and grid navigation.",
        slug: "instruments_basic_push_launchpad"
      },
      Professional: {
        name: "Professional Push/Launchpad",
        description: "Master melodic playing, session view performance, and custom mappings.",
        slug: "instruments_professional_push_launchpad"
      },
      Mastery: {
        name: "Push/Launchpad Mastery",
        description: "Create mesmerizing grid performances with virtuosic finger work.",
        slug: "instruments_mastery_push_launchpad"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Eurorack Modular",
    icon: "synth",
    tiers: {
      Basic: {
        name: "Basic Eurorack Modular",
        description: "Learn oscillators, filters, and basic patching concepts.",
        slug: "instruments_basic_eurorack"
      },
      Professional: {
        name: "Professional Eurorack Modular",
        description: "Master complex patches, generative systems, and live repatching.",
        slug: "instruments_professional_eurorack"
      },
      Mastery: {
        name: "Eurorack Mastery",
        description: "Design innovative modular systems and deliver hypnotic performances.",
        slug: "instruments_mastery_eurorack"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Theremin",
    icon: "synth",
    tiers: {
      Basic: {
        name: "Basic Theremin",
        description: "Learn hand position, pitch/volume control, and vibrato.",
        slug: "instruments_basic_theremin"
      },
      Professional: {
        name: "Professional Theremin",
        description: "Master classical repertoire and precise intonation control.",
        slug: "instruments_professional_theremin"
      },
      Mastery: {
        name: "Theremin Mastery",
        description: "Deliver ethereal, pitch-perfect theremin performances.",
        slug: "instruments_mastery_theremin"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "EWI (Electronic Wind)",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic EWI",
        description: "Learn breath controller basics and synth sound triggering.",
        slug: "instruments_basic_ewi"
      },
      Professional: {
        name: "Professional EWI",
        description: "Master bite pressure, pitch bend, and expressive synthesis.",
        slug: "instruments_professional_ewi"
      },
      Mastery: {
        name: "EWI Mastery",
        description: "Create otherworldly performances blending breath and synthesis.",
        slug: "instruments_mastery_ewi"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Keytar",
    icon: "synth",
    tiers: {
      Basic: {
        name: "Basic Keytar",
        description: "Learn strap ergonomics, synth action, and stage movement.",
        slug: "instruments_basic_keytar"
      },
      Professional: {
        name: "Professional Keytar",
        description: "Master pitch ribbon, modulation, and crowd-engaging performance.",
        slug: "instruments_professional_keytar"
      },
      Mastery: {
        name: "Keytar Mastery",
        description: "Deliver iconic keytar performances with showmanship and virtuosity.",
        slug: "instruments_mastery_keytar"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "MPC/Maschine",
    icon: "controller",
    tiers: {
      Basic: {
        name: "Basic MPC/Maschine",
        description: "Learn pad velocity, sampling basics, and sequencing.",
        slug: "instruments_basic_mpc"
      },
      Professional: {
        name: "Professional MPC/Maschine",
        description: "Master live beatmaking, chopping, and performance modes.",
        slug: "instruments_professional_mpc"
      },
      Mastery: {
        name: "MPC/Maschine Mastery",
        description: "Create iconic beats live with impeccable timing and creativity.",
        slug: "instruments_mastery_mpc"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Loop Station",
    icon: "fx",
    tiers: {
      Basic: {
        name: "Basic Loop Station",
        description: "Learn timing, layering, and simple loop arrangements.",
        slug: "instruments_basic_loop_station"
      },
      Professional: {
        name: "Professional Loop Station",
        description: "Master complex arrangements, live mixing, and crowd engagement.",
        slug: "instruments_professional_loop_station"
      },
      Mastery: {
        name: "Loop Station Mastery",
        description: "Deliver captivating one-person shows with intricate looped layers.",
        slug: "instruments_mastery_loop_station"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Analog Synthesizer",
    icon: "synth",
    tiers: {
      Basic: {
        name: "Basic Analog Synthesizer",
        description: "Learn oscillators, filters, and subtractive synthesis fundamentals.",
        slug: "instruments_basic_analog_synth"
      },
      Professional: {
        name: "Professional Analog Synthesizer",
        description: "Master patch creation, modulation routing, and live tweaking.",
        slug: "instruments_professional_analog_synth"
      },
      Mastery: {
        name: "Analog Synth Mastery",
        description: "Craft signature sounds and deliver expressive synthesizer performances.",
        slug: "instruments_mastery_analog_synth"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Digital/VA Synthesizer",
    icon: "synth",
    tiers: {
      Basic: {
        name: "Basic Digital Synthesizer",
        description: "Explore FM, wavetable, and virtual analog synthesis basics.",
        slug: "instruments_basic_digital_synth"
      },
      Professional: {
        name: "Professional Digital Synthesizer",
        description: "Master advanced synthesis techniques and deep sound design.",
        slug: "instruments_professional_digital_synth"
      },
      Mastery: {
        name: "Digital Synth Mastery",
        description: "Create cutting-edge sounds pushing synthesis boundaries.",
        slug: "instruments_mastery_digital_synth"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Electronic Drums",
    icon: "drums",
    tiers: {
      Basic: {
        name: "Basic Electronic Drums",
        description: "Learn trigger sensitivity, sound selection, and hybrid integration.",
        slug: "instruments_basic_electronic_drums"
      },
      Professional: {
        name: "Professional Electronic Drums",
        description: "Master sample triggering, layering, and SPD-style playing.",
        slug: "instruments_professional_electronic_drums"
      },
      Mastery: {
        name: "Electronic Drums Mastery",
        description: "Deliver cutting-edge performances blending acoustic and electronic.",
        slug: "instruments_mastery_electronic_drums"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Vocoder",
    icon: "fx",
    tiers: {
      Basic: {
        name: "Basic Vocoder",
        description: "Learn carrier/modulator concepts and robotic vocal effects.",
        slug: "instruments_basic_vocoder"
      },
      Professional: {
        name: "Professional Vocoder",
        description: "Master talk box, vocoder chords, and expressive vocal synthesis.",
        slug: "instruments_professional_vocoder"
      },
      Mastery: {
        name: "Vocoder Mastery",
        description: "Create iconic vocoded performances with musical expression.",
        slug: "instruments_mastery_vocoder"
      }
    }
  }
];

// ============================================================================
// WORLD & FOLK INSTRUMENTS
// ============================================================================
const worldFolkConfigs: TieredSkillConfig[] = [
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Sitar",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Sitar",
        description: "Learn proper posture, meend technique, and basic ragas.",
        slug: "instruments_basic_sitar"
      },
      Professional: {
        name: "Professional Sitar",
        description: "Master jhala, taans, and classical Indian music forms.",
        slug: "instruments_professional_sitar"
      },
      Mastery: {
        name: "Sitar Mastery",
        description: "Deliver mesmerizing raga performances with authentic technique.",
        slug: "instruments_mastery_sitar"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Oud",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Oud",
        description: "Learn maqam basics, right-hand technique, and traditional patterns.",
        slug: "instruments_basic_oud"
      },
      Professional: {
        name: "Professional Oud",
        description: "Master taqasim improvisation and microtonal expression.",
        slug: "instruments_professional_oud"
      },
      Mastery: {
        name: "Oud Mastery",
        description: "Create transcendent performances with virtuosic maqam exploration.",
        slug: "instruments_mastery_oud"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Kora",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Kora",
        description: "Learn the 21-string harp-lute basics and Mandinka patterns.",
        slug: "instruments_basic_kora"
      },
      Professional: {
        name: "Professional Kora",
        description: "Master kumbengo/birimintingo and griot traditions.",
        slug: "instruments_professional_kora"
      },
      Mastery: {
        name: "Kora Mastery",
        description: "Deliver hypnotic West African performances with authentic spirit.",
        slug: "instruments_mastery_kora"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Erhu",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Erhu",
        description: "Learn bowing technique, intonation, and traditional melodies.",
        slug: "instruments_basic_erhu"
      },
      Professional: {
        name: "Professional Erhu",
        description: "Master vibrato, ornamentation, and classical Chinese repertoire.",
        slug: "instruments_professional_erhu"
      },
      Mastery: {
        name: "Erhu Mastery",
        description: "Create hauntingly beautiful performances with expressive depth.",
        slug: "instruments_mastery_erhu"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Shamisen",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Shamisen",
        description: "Learn bachi technique, striking, and fundamental patterns.",
        slug: "instruments_basic_shamisen"
      },
      Professional: {
        name: "Professional Shamisen",
        description: "Master Tsugaru style, speed technique, and traditional forms.",
        slug: "instruments_professional_shamisen"
      },
      Mastery: {
        name: "Shamisen Mastery",
        description: "Deliver electrifying performances with percussive virtuosity.",
        slug: "instruments_mastery_shamisen"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Bouzouki",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Bouzouki",
        description: "Learn pick technique and Greek/Irish bouzouki fundamentals.",
        slug: "instruments_basic_bouzouki"
      },
      Professional: {
        name: "Professional Bouzouki",
        description: "Master tremolo, ornamentation, and both Greek and Irish styles.",
        slug: "instruments_professional_bouzouki"
      },
      Mastery: {
        name: "Bouzouki Mastery",
        description: "Create distinctive performances bridging Mediterranean and Celtic.",
        slug: "instruments_mastery_bouzouki"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Balalaika",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Balalaika",
        description: "Learn the triangular instrument's strumming and picking basics.",
        slug: "instruments_basic_balalaika"
      },
      Professional: {
        name: "Professional Balalaika",
        description: "Master tremolo, folk repertoire, and ensemble playing.",
        slug: "instruments_professional_balalaika"
      },
      Mastery: {
        name: "Balalaika Mastery",
        description: "Deliver virtuosic Russian folk performances with authentic spirit.",
        slug: "instruments_mastery_balalaika"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Charango",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Charango",
        description: "Learn strumming patterns and Andean music fundamentals.",
        slug: "instruments_basic_charango"
      },
      Professional: {
        name: "Professional Charango",
        description: "Master the bright, rapid technique and folk repertoire.",
        slug: "instruments_professional_charango"
      },
      Mastery: {
        name: "Charango Mastery",
        description: "Create vibrant Andean performances with virtuosic flair.",
        slug: "instruments_mastery_charango"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Kalimba/Mbira",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Kalimba/Mbira",
        description: "Learn thumb technique and traditional African patterns.",
        slug: "instruments_basic_kalimba"
      },
      Professional: {
        name: "Professional Kalimba/Mbira",
        description: "Master Shona mbira traditions and interlocking patterns.",
        slug: "instruments_professional_kalimba"
      },
      Mastery: {
        name: "Kalimba/Mbira Mastery",
        description: "Create trance-inducing performances with authentic spirit.",
        slug: "instruments_mastery_kalimba"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Gamelan",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Gamelan",
        description: "Learn mallet technique and ensemble role fundamentals.",
        slug: "instruments_basic_gamelan"
      },
      Professional: {
        name: "Professional Gamelan",
        description: "Master specific instruments and traditional Javanese/Balinese repertoire.",
        slug: "instruments_professional_gamelan"
      },
      Mastery: {
        name: "Gamelan Mastery",
        description: "Lead gamelan ensembles with authentic knowledge and precision.",
        slug: "instruments_mastery_gamelan"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Uilleann Pipes",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Uilleann Pipes",
        description: "Learn bellows control and chanter fundamentals.",
        slug: "instruments_basic_uilleann"
      },
      Professional: {
        name: "Professional Uilleann Pipes",
        description: "Master regulators, drones, and traditional Irish music.",
        slug: "instruments_professional_uilleann"
      },
      Mastery: {
        name: "Uilleann Pipes Mastery",
        description: "Deliver hauntingly beautiful Irish music with full pipe set.",
        slug: "instruments_mastery_uilleann"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Guzheng",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Guzheng",
        description: "Learn finger techniques, tuning, and traditional melodies.",
        slug: "instruments_basic_guzheng"
      },
      Professional: {
        name: "Professional Guzheng",
        description: "Master tremolo, bending, and classical Chinese repertoire.",
        slug: "instruments_professional_guzheng"
      },
      Mastery: {
        name: "Guzheng Mastery",
        description: "Create flowing, virtuosic Chinese zither performances.",
        slug: "instruments_mastery_guzheng"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Biwa",
    icon: "world",
    tiers: {
      Basic: {
        name: "Basic Biwa",
        description: "Learn plectrum technique and narrative singing basics.",
        slug: "instruments_basic_biwa"
      },
      Professional: {
        name: "Professional Biwa",
        description: "Master Satsuma biwa and traditional storytelling forms.",
        slug: "instruments_professional_biwa"
      },
      Mastery: {
        name: "Biwa Mastery",
        description: "Deliver powerful narrative performances with dramatic expression.",
        slug: "instruments_mastery_biwa"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Tin Whistle",
    icon: "wind",
    tiers: {
      Basic: {
        name: "Basic Tin Whistle",
        description: "Learn breath control and Irish tune fundamentals.",
        slug: "instruments_basic_tin_whistle"
      },
      Professional: {
        name: "Professional Tin Whistle",
        description: "Master ornamentation, rolls, and session playing.",
        slug: "instruments_professional_tin_whistle"
      },
      Mastery: {
        name: "Tin Whistle Mastery",
        description: "Deliver lightning-fast reels with authentic Celtic expression.",
        slug: "instruments_mastery_tin_whistle"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Concertina",
    icon: "accordion",
    tiers: {
      Basic: {
        name: "Basic Concertina",
        description: "Learn push-pull bellows and Anglo/English systems.",
        slug: "instruments_basic_concertina"
      },
      Professional: {
        name: "Professional Concertina",
        description: "Master Irish traditional music and chordal accompaniment.",
        slug: "instruments_professional_concertina"
      },
      Mastery: {
        name: "Concertina Mastery",
        description: "Create virtuosic performances with authentic traditional flair.",
        slug: "instruments_mastery_concertina"
      }
    }
  }
];

// ============================================================================
// LEGACY INSTRUMENT CONFIGS (preserved for backward compatibility)
// ============================================================================
const legacyInstrumentsConfigs: TieredSkillConfig[] = [
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
    track: "Vocal & Performance Skills",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Vocal & Performance Skills",
        description: "Develop pitch accuracy, breath management, and confident lead or backing vocals.",
        slug: "instruments_basic_vocal_performance"
      },
      Professional: {
        name: "Professional Vocal Performance",
        description: "Blend harmonies, stage movement, and vocal dynamics across ensemble settings.",
        slug: "instruments_professional_vocal_performance"
      },
      Mastery: {
        name: "Vocal Performance Mastery",
        description: "Command stages with expressive phrasing, show-ready presence, and adaptive harmonizing.",
        slug: "instruments_mastery_vocal_performance"
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Vocal Effects & Technology",
    icon: "performance",
    tiers: {
      Basic: {
        name: "Vocal Effects & Technology",
        description: "Explore auto-tune, harmonizers, and vocal FX chains in live settings.",
        slug: "instruments_basic_vocal_fx"
      },
      Professional: {
        name: "Professional Vocal FX",
        description: "Configure real-time vocal FX rigs with confident signal routing.",
        slug: "instruments_professional_vocal_fx"
      },
      Mastery: {
        name: "Vocal Effects Mastery",
        description: "Orchestrate creative vocal FX layering, live timing, and adaptive routing strategies.",
        slug: "instruments_mastery_vocal_fx"
      }
    }
  }
];

// ============================================================================
// CAPSTONE MASTERY SKILLS
// ============================================================================
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
          { slug: createSlug("instruments", "Professional", "Rapping"), requiredValue: 600 },
          { slug: "instruments_professional_vocal_performance", requiredValue: 650 },
          { slug: "instruments_professional_vocal_fx", requiredValue: 600 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Multi-Instrumentalist",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Multi-Instrumentalist Mastery",
        description: "Play 5+ instruments with professional competency across families.",
        slug: "instruments_mastery_multi_instrumentalist",
        prerequisites: [
          { slug: "instruments_professional_acoustic_guitar", requiredValue: 600 },
          { slug: "instruments_professional_classical_piano", requiredValue: 600 },
          { slug: "instruments_professional_rock_drums", requiredValue: 600 },
          { slug: "instruments_professional_bass_guitar", requiredValue: 600 },
          { slug: "instruments_professional_vocal_performance", requiredValue: 500 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Session Musician",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Session Musician Mastery",
        description: "Excel at sight-reading, adaptability, and studio session work.",
        slug: "instruments_mastery_session_musician",
        prerequisites: [
          { slug: "instruments_professional_acoustic_guitar", requiredValue: 500 },
          { slug: "instruments_professional_electric_guitar", requiredValue: 500 },
          { slug: "instruments_professional_bass_guitar", requiredValue: 500 },
          { slug: "songwriting_professional_record_production", requiredValue: 500 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Bandleader",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Bandleader Mastery",
        description: "Conduct, cue, and manage live ensembles with authority.",
        slug: "instruments_mastery_bandleader",
        prerequisites: [
          { slug: "stage_professional_showmanship", requiredValue: 600 },
          { slug: "stage_professional_crowd", requiredValue: 600 },
          { slug: "instruments_professional_vocal_performance", requiredValue: 500 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Touring Musician",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Touring Musician Mastery",
        description: "Maintain peak performance through road endurance and gear management.",
        slug: "instruments_mastery_touring_musician",
        prerequisites: [
          { slug: "stage_professional_tech", requiredValue: 600 },
          { slug: "stage_professional_showmanship", requiredValue: 600 }
        ]
      }
    }
  },
  {
    prefix: "instruments",
    category: "Instruments & Performance",
    track: "Studio Virtuoso",
    icon: "performance",
    chainPrerequisites: false,
    tiers: {
      Mastery: {
        name: "Studio Virtuoso Mastery",
        description: "Master recording techniques, efficiency, and tone crafting in studio.",
        slug: "instruments_mastery_studio_virtuoso",
        prerequisites: [
          { slug: "songwriting_professional_record_production", requiredValue: 650 },
          { slug: "songwriting_professional_mixing", requiredValue: 600 },
          { slug: "songwriting_professional_daw", requiredValue: 600 }
        ]
      }
    }
  }
];

// ============================================================================
// STAGE & SHOWMANSHIP
// ============================================================================
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

// ============================================================================
// BUILD AND EXPORT
// ============================================================================
const { definitions, relationships } = buildSkillTree([
  ...songwritingProductionConfigs,
  ...genreConfigs,
  ...stringInstrumentConfigs,
  ...keyboardConfigs,
  ...percussionConfigs,
  ...windConfigs,
  ...brassConfigs,
  ...electronicConfigs,
  ...worldFolkConfigs,
  ...legacyInstrumentsConfigs,
  ...instrumentMasteryConfigs,
  ...stageShowmanshipConfigs
]);

export const SKILL_TREE_DEFINITIONS: SkillDefinitionRecord[] = definitions;
export const SKILL_TREE_RELATIONSHIPS: SkillRelationshipRecord[] = relationships;
