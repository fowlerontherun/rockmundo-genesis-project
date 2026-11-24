import {
  MINIMAX_MUSIC_26_STYLE_MAX_LENGTH,
  MINIMAX_STYLE_MAX_LENGTH,
  normalizeMiniMaxStylePrompt,
} from "./musicStylePrompt.ts";

export type MusicModel = "music-1.5" | "music-2.6";

// Stored in songwriting_projects.creative_brief.sound_profile. Missing fields
// deliberately mean "let the generator choose" for Basic Songwriting.
export interface SongSoundProfile {
  bpm?: number | null;
  musical_key?: string;
  energy?: string;
  vocal_style?: string;
  guitar_tone?: string;
  production_style?: string;
  arrangement?: string;
}

export interface SongSoundBrief {
  sound_profile?: SongSoundProfile | null;
  mood_modifiers?: string[];
  inspiration_modifiers?: string[];
  additional_notes?: string;
  // Older saved projects used these aliases.
  moodPalette?: string[];
  mood_palette?: string[];
}

export interface SongStyleInputs {
  model: MusicModel;
  genre: string;
  creatorGender?: string | null;
  chordProgression?: string | null;
  bandSoundDescription?: string | null;
  themeName?: string | null;
  themeMood?: string | null;
  quality?: number;
  instruments?: string[] | null;
  creativeBrief?: SongSoundBrief | null;
  isAcousticVersion?: boolean;
  customPrompt?: string | null;
}

const clean = (value: unknown, max = 100): string =>
  typeof value === "string"
    ? value.replace(/(?:^|\n)\s*(?:style|lyrics)\s*:/gi, " ").replace(/[^\p{L}\p{N}\s,.'+/#&()-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";

const INSTRUMENT_ALIASES: Record<string, string> = {
  analog_synth: "analog synthesizer",
  classical_piano: "piano",
  jazz_piano: "jazz piano",
  rock_drums: "rock drum kit",
  jazz_drums: "jazz drums",
  vocal_performance: "lead vocals",
  rapping: "rap vocals",
  rhodes: "Rhodes electric piano",
};

export function readableSongInstrument(slug: string): string {
  const normalized = slug.replace(/^instruments_basic_/, "").toLowerCase();
  return INSTRUMENT_ALIASES[normalized] || clean(normalized.replace(/_/g, " "), 40);
}

const ENERGIES: Record<string, string> = {
  mellow: "mellow, relaxed energy",
  building: "restrained verses building to an anthemic chorus",
  high: "high energy throughout",
};
const VOCALS: Record<string, string> = {
  raw: "raw melodic vocals",
  smooth: "smooth gentle vocals",
  aggressive: "aggressive vocals",
  intimate: "intimate breathy vocals",
};
const GUITARS: Record<string, string> = {
  jangly: "jangly clean guitar",
  crunchy: "crunchy rhythm guitar",
  distorted: "heavy distorted guitar",
  fingerstyle: "fingerpicked acoustic guitar",
  none: "no featured guitar",
};
const PRODUCTIONS: Record<string, string> = {
  live: "organic live studio production",
  modern: "polished modern production",
  vintage: "warm vintage analog production",
  lofi: "lo-fi bedroom production",
};
const ARRANGEMENTS: Record<string, string> = {
  standard: "verse chorus bridge and outro",
  anthem: "quiet verse, huge singalong chorus",
  solo: "instrumental solo before final chorus",
  dynamic: "dynamic build-up and final chorus",
};

const mapped = (options: Record<string, string>, value: unknown) =>
  typeof value === "string" ? options[value] || "" : "";

// A single canonical prompt builder serves both admin and player generation.
// Put explicit player direction first so the 1.5 character cap cannot silently
// discard their choices in favour of generic genre/quality adjectives.
export function buildSongStylePrompt(input: SongStyleInputs) {
  const { model, genre, creatorGender, chordProgression, bandSoundDescription,
    themeName, themeMood, quality = 50, instruments, creativeBrief,
    isAcousticVersion = false, customPrompt } = input;
  const selected = creativeBrief?.sound_profile || {};
  const parts: string[] = ["complete song around 110 seconds, recurring chorus, bridge and outro"];

  if (customPrompt?.trim()) {
    if (isAcousticVersion) parts.push("stripped-back acoustic guitar-led arrangement");
    // Keep admin edits free of a pasted Lyrics: block, just like the original
    // provider-boundary normalizer did.
    const styleOnly = normalizeMiniMaxStylePrompt(
      customPrompt, genre,
      model === "music-2.6" ? MINIMAX_MUSIC_26_STYLE_MAX_LENGTH : MINIMAX_STYLE_MAX_LENGTH,
    ).prompt;
    parts.push(clean(styleOnly, model === "music-2.6" ? 1800 : 300));
  } else {
    parts.push(clean(genre, 65) || "rock");
    if (isAcousticVersion) parts.push("stripped-back acoustic guitar-led arrangement, minimal organic instrumentation");
    if (Number.isInteger(selected.bpm) && selected.bpm! >= 60 && selected.bpm! <= 200) {
      parts.push(`${selected.bpm} BPM`);
    }
    if (selected.musical_key) parts.push(clean(selected.musical_key, 20));
    parts.push(mapped(ENERGIES, selected.energy));
    parts.push(mapped(VOCALS, selected.vocal_style));
    parts.push(mapped(GUITARS, selected.guitar_tone));
    parts.push(mapped(PRODUCTIONS, selected.production_style));
    parts.push(mapped(ARRANGEMENTS, selected.arrangement));
    const featured = (instruments || [])
      .filter((instrument): instrument is string => typeof instrument === "string" && instrument.startsWith("instruments_basic_"))
      .slice(0, model === "music-2.6" ? 8 : 4)
      .map(readableSongInstrument)
      .filter(Boolean);
    if (featured.length) parts.push(`featured ${featured.join(", ")}`);

    if (!selected.vocal_style) {
      const gender = creatorGender?.toLowerCase();
      parts.push(gender === "male" ? "male vocal" : gender === "female" ? "female vocal" : "vocal");
    }
    if (chordProgression) parts.push(clean(chordProgression, 45));
    if (bandSoundDescription && !isAcousticVersion) parts.push(clean(bandSoundDescription, 100));
    if (themeName) parts.push(clean(themeName, 35));
    if (themeMood) parts.push(`${clean(themeMood, 25)} mood`);
    const moods = creativeBrief?.mood_modifiers || creativeBrief?.moodPalette || creativeBrief?.mood_palette || [];
    if (Array.isArray(moods)) parts.push(moods.slice(0, 2).map(m => clean(m, 25)).filter(Boolean).join(", "));
    const inspirations = creativeBrief?.inspiration_modifiers || [];
    if (Array.isArray(inspirations)) parts.push(inspirations.slice(0, 2).map(m => clean(m.replace(/-/g, " "), 25)).filter(Boolean).join(", "));
    if (!selected.production_style) {
      parts.push(quality >= 80 ? "polished production" : quality >= 60 ? "clean mix" : quality >= 40 ? "demo sound" : "raw demo sound");
    }
    if (creativeBrief?.additional_notes) parts.push(clean(creativeBrief.additional_notes, 120));
  }
  return normalizeMiniMaxStylePrompt(
    parts.filter(Boolean).join(", "), genre,
    model === "music-2.6" ? MINIMAX_MUSIC_26_STYLE_MAX_LENGTH : MINIMAX_STYLE_MAX_LENGTH,
  );
}

export function prepareSongLyricsForModel(rawLyrics: string | null, model: MusicModel, arrangement?: string) {
  if (model === "music-1.5" || !rawLyrics) return rawLyrics;
  if (arrangement === "solo" && !/\[Solo\]/i.test(rawLyrics)) {
    const outro = rawLyrics.search(/\[Outro\]/i);
    return outro >= 0
      ? `${rawLyrics.slice(0, outro).trimEnd()}\n\n[Solo]\n\n${rawLyrics.slice(outro)}`
      : `${rawLyrics.trimEnd()}\n\n[Solo]`;
  }
  return rawLyrics;
}
