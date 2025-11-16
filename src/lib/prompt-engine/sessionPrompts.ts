import type { Json } from "@/integrations/supabase/types";

export interface StemDescriptor {
  name: string;
  instrument?: string | null;
  storagePath?: string | null;
  downloadUrl?: string | null;
  lengthSeconds?: number | null;
  loudness?: number | null;
}

export interface SessionPromptMetadata {
  sessionId: string;
  songId: string;
  songTitle: string;
  genre?: string | null;
  tempo?: number | null;
  durationSeconds?: number | null;
  durationHours?: number | null;
  mood?: string | null;
  arrangementStrength?: number | null;
  melodyStrength?: number | null;
  rhythmStrength?: number | null;
  lyricsStrength?: number | null;
  studioName?: string | null;
  cityId?: string | null;
  producerName?: string | null;
  recordingVersion?: string | null;
  qualityImprovement?: number | null;
  totalCost?: number | null;
  status?: string | null;
  updatedAt?: string | null;
  qualityScore?: number | null;
  lyricsProgress?: number | null;
  musicProgress?: number | null;
  extraMetadata?: Json;
}

export interface SessionPromptSummary {
  style: string;
  mood: string;
  arrangement: string;
  short: string;
}

export interface BuildSessionPromptInput {
  metadata: SessionPromptMetadata;
  stems?: StemDescriptor[];
  lyrics?: string | null;
  options?: BuildPromptOptions;
}

export interface BuildPromptOptions {
  maxPromptTokens?: number;
  maxLyricsTokens?: number;
  instructions?: string;
}

export interface SessionPromptArtifact {
  prompt: {
    metadata: SessionPromptMetadata;
    stems: StemDescriptor[];
    lyrics_excerpt: string;
    summaries: SessionPromptSummary;
    instructions: string;
  };
  summary: string;
  metadata: SessionPromptMetadata & { summaries: SessionPromptSummary };
  stemPaths: string[];
  lyricsExcerpt: string;
  tokenEstimate: number;
}

export const DEFAULT_PROMPT_INSTRUCTIONS =
  "Use the metadata, mood cues, arrangement notes, stems, and lyrics excerpt to generate a cohesive continuation without exceeding the provided context.";

const DEFAULT_MAX_PROMPT_TOKENS = 700;

export const buildSessionPromptArtifact = ({
  metadata,
  stems = [],
  lyrics = null,
  options = {},
}: BuildSessionPromptInput): SessionPromptArtifact => {
  const maxPromptTokens = options.maxPromptTokens ?? DEFAULT_MAX_PROMPT_TOKENS;
  const maxLyricsTokens = options.maxLyricsTokens ?? Math.floor(maxPromptTokens * 0.4);

  const styleSummary = describeStyle(metadata);
  const moodSummary = describeMood(metadata);
  const arrangementSummary = describeArrangement(metadata, stems);
  const shortSummary = buildShortSummary(
    metadata,
    styleSummary,
    moodSummary,
    arrangementSummary,
    Math.floor(maxPromptTokens * 0.25),
  );

  const lyricsExcerpt = buildLyricsExcerpt(lyrics, maxLyricsTokens);
  const sanitizedStems = stems.map((stem) => ({
    name: stem.name,
    instrument: stem.instrument ?? inferInstrumentFromName(stem.name),
    storagePath: stem.storagePath ?? null,
    downloadUrl: stem.downloadUrl ?? null,
    lengthSeconds: stem.lengthSeconds ?? null,
    loudness: stem.loudness ?? null,
  }));

  const summaries: SessionPromptSummary = {
    style: styleSummary,
    mood: moodSummary,
    arrangement: arrangementSummary,
    short: shortSummary,
  };

  const promptPayload = {
    metadata,
    stems: sanitizedStems,
    lyrics_excerpt: lyricsExcerpt,
    summaries,
    instructions: options.instructions ?? DEFAULT_PROMPT_INSTRUCTIONS,
  };

  const descriptiveSummary = [styleSummary, moodSummary, arrangementSummary]
    .filter(Boolean)
    .join(". ");

  const tokenEstimate = Math.min(
    maxPromptTokens,
    estimateTokenLength(JSON.stringify(promptPayload)) + estimateTokenLength(descriptiveSummary),
  );

  const stemPaths = sanitizedStems
    .map((stem) => stem.storagePath ?? stem.name)
    .filter((path, index, all) => Boolean(path) && all.indexOf(path) === index) as string[];

  return {
    prompt: promptPayload,
    summary: descriptiveSummary,
    metadata: { ...metadata, summaries },
    stemPaths,
    lyricsExcerpt,
    tokenEstimate,
  };
};

export const describeStyle = (metadata: SessionPromptMetadata): string => {
  const parts: string[] = [];

  if (metadata.genre) {
    parts.push(`${titleCase(metadata.genre)} pulse`);
  }

  if (metadata.recordingVersion) {
    parts.push(`${metadata.recordingVersion} cut focus`);
  }

  if (metadata.tempo && metadata.tempo > 0) {
    parts.push(`${metadata.tempo} BPM momentum`);
  } else if (metadata.durationSeconds) {
    const approxTempo = Math.min(180, Math.max(60, Math.round((60 / (metadata.durationSeconds / 60 || 1)) * 4)));
    parts.push(`mid-tempo (~${approxTempo} BPM)`);
  }

  if (metadata.qualityImprovement && metadata.qualityImprovement > 0) {
    parts.push(`tracking for +${metadata.qualityImprovement} quality jump`);
  }

  if (metadata.qualityScore) {
    parts.push(`current quality ${metadata.qualityScore}/1000`);
  }

  if (!parts.length) {
    return "Undefined style reference";
  }

  return parts.join(" • ");
};

export const describeMood = (metadata: SessionPromptMetadata): string => {
  const tone = metadata.mood ?? inferMoodFromStatus(metadata.status, metadata.qualityImprovement);
  const producer = metadata.producerName ? ` with ${metadata.producerName}` : "";
  const studio = metadata.studioName ? ` inside ${metadata.studioName}` : "";
  return `${tone}${producer}${studio}`.trim() || "Calm production focus";
};

export const describeArrangement = (
  metadata: SessionPromptMetadata,
  stems: StemDescriptor[],
): string => {
  if (!stems.length) {
    return metadata.arrangementStrength
      ? `Arrangement strength ${metadata.arrangementStrength}/100 without uploaded stems`
      : "Arrangement details unavailable";
  }

  const instrumentCounts = stems.reduce<Record<string, number>>((acc, stem) => {
    const key = (stem.instrument ?? inferInstrumentFromName(stem.name) ?? "misc").toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const ranked = Object.entries(instrumentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([instrument, count]) => `${titleCase(instrument)} x${count}`);

  const strengthDescriptor = describeStrength(metadata.arrangementStrength ?? null, "arrangement");

  return `${strengthDescriptor} built from ${ranked.join(", ")}`.trim();
};

export const buildLyricsExcerpt = (lyrics: string | null, maxTokens: number): string => {
  if (!lyrics) {
    return "";
  }

  const tokens = tokenize(lyrics);
  if (tokens.length <= maxTokens) {
    return lyrics.trim();
  }

  return `${tokens.slice(0, maxTokens).join(" ")}…`;
};

const buildShortSummary = (
  metadata: SessionPromptMetadata,
  style: string,
  mood: string,
  arrangement: string,
  tokenLimit: number,
): string => {
  const base = `${metadata.songTitle} (${metadata.genre ?? "Unknown genre"})`;
  const supplemental: string[] = [];

  if (metadata.durationHours) {
    supplemental.push(`${metadata.durationHours}h block`);
  }

  if (metadata.totalCost) {
    supplemental.push(`budget ${formatCurrency(metadata.totalCost)}`);
  }

  if (metadata.cityId) {
    supplemental.push(`city: ${metadata.cityId}`);
  }

  const sentence = `${base} | ${style}. ${mood}. ${arrangement}. ${supplemental.join(" • ")}`.trim();
  return truncateToTokens(sentence, tokenLimit);
};

const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "unknown";
  }

  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }

  return `$${value}`;
};

const describeStrength = (score: number | null, label: string): string => {
  if (score === null || score === undefined) {
    return `Unrated ${label}`;
  }

  if (score >= 80) {
    return `Virtuosic ${label}`;
  }

  if (score >= 60) {
    return `Polished ${label}`;
  }

  if (score >= 40) {
    return `Developing ${label}`;
  }

  return `Rough ${label}`;
};

const inferInstrumentFromName = (name: string): string | null => {
  const normalized = name.toLowerCase();
  if (normalized.includes("guitar")) return "guitar";
  if (normalized.includes("vocal")) return "vocals";
  if (normalized.includes("drum")) return "drums";
  if (normalized.includes("bass")) return "bass";
  if (normalized.includes("synth")) return "synth";
  if (normalized.includes("piano")) return "piano";
  return null;
};

const inferMoodFromStatus = (status?: string | null, qualityImprovement?: number | null): string => {
  if (status && status.includes("party")) {
    return "Party-mode tracking";
  }

  if (status && status.includes("chilled")) {
    return "Chilled overdubs";
  }

  if ((qualityImprovement ?? 0) > 20) {
    return "High-pressure polish sprint";
  }

  return "Focused tracking";
};

const truncateToTokens = (text: string, maxTokens: number): string => {
  if (maxTokens <= 0) {
    return "";
  }

  const tokens = tokenize(text);
  if (tokens.length <= maxTokens) {
    return text;
  }

  return `${tokens.slice(0, maxTokens).join(" ")}…`;
};

const tokenize = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

const estimateTokenLength = (text: string): number => {
  if (!text) {
    return 0;
  }

  const tokens = tokenize(text);
  return Math.ceil(tokens.length * 1.2);
};

const titleCase = (value: string): string =>
  value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export type { StemDescriptor as SessionStemDescriptor };
