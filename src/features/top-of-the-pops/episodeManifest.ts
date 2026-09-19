import type { TotpEpisode, TotpPerformance } from "./api";

/**
 * Phase 0 broadcast contract.
 *
 * The manifest is the single immutable description of an episode used for
 * production, rendering and external delivery. It must be deterministic:
 * building it twice from the same inputs produces byte-identical JSON and the
 * same checksum.
 */

export type TotpProductionState =
  | "gameplay"
  | "production_ready"
  | "rendered_master"
  | "published";

export type TotpRightsStatus = "cleared" | "pending" | "blocked";

export interface TotpTrackRights {
  /** Who owns the master recording in fiction/production terms. */
  owner: string;
  licence: string;
  /** ISO territory codes, or ["WORLD"]. */
  territories: string[];
  /** ISO date the licence expires, if any. */
  expires_on: string | null;
  content_id_allowlisted: boolean;
  youtube_live_permitted: boolean;
  status: TotpRightsStatus;
}

export interface TotpManifestAsset {
  kind: "song_audio" | "presenter_audio";
  url: string | null;
  duration_ms: number | null;
  sha256: string | null;
  version: number | null;
  script_checksum: string | null;
}

export interface TotpManifestSegment {
  index: number;
  performance_id: string;
  band_id: string;
  band_name: string;
  song_id: string;
  song_title: string;
  stage_key: string;
  qualifying_rank: number;
  presenter_intro: string | null;
  assets: TotpManifestAsset[];
  rights: TotpTrackRights;
}

export interface TotpEpisodeManifest {
  manifest_version: 1;
  episode_id: string;
  episode_number: number;
  episode_date: string;
  broadcast_at: string;
  check_in_at: string;
  presenter_key: string;
  show_variant: string | null;
  broadcast_profile: string;
  programme_spec: {
    width: 1920;
    height: 1080;
    frame_rate: 30;
    video_codec: "h264";
    audio_codec: "aac";
    audio_channels: 2;
    aspect_ratio: "16:9";
  };
  segments: TotpManifestSegment[];
  total_runtime_ms: number;
  production_state: TotpProductionState;
  checksum: string;
}

export interface TotpManifestIssue {
  severity: "blocking" | "warning";
  code:
    | "missing_song_audio"
    | "missing_duration"
    | "rights_not_cleared"
    | "rights_expired"
    | "rights_incomplete"
    | "content_id_not_allowlisted"
    | "youtube_not_permitted"
    | "no_segments"
    | "missing_presenter_intro"
    | "missing_presenter_audio";
  performance_id?: string;
  message: string;
}

export interface TotpManifestInput {
  episode: TotpEpisode;
  /** performance_id -> audio */
  songAudio: Record<string, { url: string | null; duration_ms: number | null }>;
  /** performance_id -> immutable recorded presenter link audio */
  presenterAudio?: Record<string, {
    url: string | null;
    duration_ms: number | null;
    sha256: string | null;
    version: number | null;
    script_checksum: string | null;
  }>;
  /** song_id -> rights record */
  rights: Record<string, TotpTrackRights>;
  /** Used only to evaluate licence expiry; defaults to the broadcast date. */
  evaluatedOn?: string;
}

const PROGRAMME_SPEC = {
  width: 1920,
  height: 1080,
  frame_rate: 30,
  video_codec: "h264",
  audio_codec: "aac",
  audio_channels: 2,
  aspect_ratio: "16:9",
} as const;

const UNKNOWN_RIGHTS: TotpTrackRights = {
  owner: "unknown",
  licence: "none",
  territories: [],
  expires_on: null,
  content_id_allowlisted: false,
  youtube_live_permitted: false,
  status: "pending",
};

/** Deterministic, dependency-free 128-bit style checksum (four FNV-1a lanes). */
export function manifestChecksum(canonicalJson: string): string {
  const lanes = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  for (let i = 0; i < canonicalJson.length; i += 1) {
    const code = canonicalJson.charCodeAt(i);
    for (let lane = 0; lane < lanes.length; lane += 1) {
      lanes[lane] = (lanes[lane] ^ (code + lane)) >>> 0;
      lanes[lane] = Math.imul(lanes[lane], 16777619) >>> 0;
    }
  }
  return lanes.map((lane) => lane.toString(16).padStart(8, "0")).join("");
}

/** Stable key ordering so the same data always serialises identically. */
export function canonicalise(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalise(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalise(record[key])}`)
    .join(",")}}`;
}

function sortPerformances(performances: TotpPerformance[]): TotpPerformance[] {
  return [...performances].sort((a, b) => {
    if (a.running_order !== b.running_order) return a.running_order - b.running_order;
    if (a.qualifying_rank !== b.qualifying_rank) return a.qualifying_rank - b.qualifying_rank;
    return a.performance_id.localeCompare(b.performance_id);
  });
}

export function buildTotpEpisodeManifest(input: TotpManifestInput): TotpEpisodeManifest {
  const { episode, songAudio, presenterAudio = {}, rights } = input;

  const segments: TotpManifestSegment[] = sortPerformances(episode.performances).map(
    (performance, position) => {
      const song = songAudio[performance.performance_id] ?? { url: null, duration_ms: null };
      const link = presenterAudio[performance.performance_id] ?? null;
      const assets: TotpManifestAsset[] = [
        {
          kind: "song_audio",
          url: song.url ?? null,
          duration_ms: song.duration_ms ?? null,
          sha256: null,
          version: null,
          script_checksum: null,
        },
      ];
      if (link) {
        assets.push({
          kind: "presenter_audio",
          url: link.url ?? null,
          duration_ms: link.duration_ms ?? null,
          sha256: link.sha256 ?? null,
          version: link.version ?? null,
          script_checksum: link.script_checksum ?? null,
        });
      }

      return {
        index: position + 1,
        performance_id: performance.performance_id,
        band_id: performance.band_id,
        band_name: performance.band_name,
        song_id: performance.song_id,
        song_title: performance.song_title,
        stage_key: performance.stage_key,
        qualifying_rank: performance.qualifying_rank,
        presenter_intro: performance.presenter_intro ?? null,
        assets,
        rights: rights[performance.song_id] ?? UNKNOWN_RIGHTS,
      };
    },
  );

  const totalRuntimeMs = segments.reduce((total, segment) => {
    const segmentMs = segment.assets.reduce(
      (sum, asset) => sum + (asset.duration_ms ?? 0),
      0,
    );
    return total + segmentMs;
  }, 0);

  const body = {
    manifest_version: 1 as const,
    episode_id: episode.id,
    episode_number: episode.episode_number,
    episode_date: episode.episode_date,
    broadcast_at: episode.broadcast_at,
    check_in_at: episode.check_in_at,
    presenter_key: episode.presenter_key,
    show_variant: episode.show_variant ?? null,
    broadcast_profile: episode.broadcast_profile,
    programme_spec: PROGRAMME_SPEC,
    segments,
    total_runtime_ms: totalRuntimeMs,
  };

  return {
    ...body,
    production_state: "gameplay",
    checksum: manifestChecksum(canonicalise(body)),
  };
}

export function validateTotpEpisodeManifest(
  manifest: TotpEpisodeManifest,
  evaluatedOn: string = manifest.episode_date,
): TotpManifestIssue[] {
  const issues: TotpManifestIssue[] = [];

  if (manifest.segments.length === 0) {
    issues.push({
      severity: "blocking",
      code: "no_segments",
      message: "The episode has no locked performances.",
    });
  }

  for (const segment of manifest.segments) {
    const song = segment.assets.find((asset) => asset.kind === "song_audio");
    if (!song?.url) {
      issues.push({
        severity: "blocking",
        code: "missing_song_audio",
        performance_id: segment.performance_id,
        message: `${segment.band_name} — “${segment.song_title}” has no broadcast audio.`,
      });
    } else if (!song.duration_ms || song.duration_ms <= 0) {
      issues.push({
        severity: "blocking",
        code: "missing_duration",
        performance_id: segment.performance_id,
        message: `${segment.band_name} — “${segment.song_title}” has no measured duration.`,
      });
    }

    if (segment.rights.status !== "cleared") {
      issues.push({
        severity: "blocking",
        code: "rights_not_cleared",
        performance_id: segment.performance_id,
        message: `Rights for “${segment.song_title}” are ${segment.rights.status}.`,
      });
    } else {
      if (
        !segment.rights.owner.trim()
        || !segment.rights.licence.trim()
        || segment.rights.territories.length === 0
      ) {
        issues.push({
          severity: "blocking",
          code: "rights_incomplete",
          performance_id: segment.performance_id,
          message: `The external rights record for “${segment.song_title}” is incomplete.`,
        });
      }
      if (!segment.rights.content_id_allowlisted) {
        issues.push({
          severity: "blocking",
          code: "content_id_not_allowlisted",
          performance_id: segment.performance_id,
          message: `Content ID allowlisting has not been confirmed for “${segment.song_title}”.`,
        });
      }
      if (!segment.rights.youtube_live_permitted) {
        issues.push({
          severity: "blocking",
          code: "youtube_not_permitted",
          performance_id: segment.performance_id,
          message: `YouTube publication/live permission has not been confirmed for “${segment.song_title}”.`,
        });
      }
      if (segment.rights.expires_on && segment.rights.expires_on < evaluatedOn) {
        issues.push({
          severity: "blocking",
          code: "rights_expired",
          performance_id: segment.performance_id,
          message: `The licence for “${segment.song_title}” expired on ${segment.rights.expires_on}.`,
        });
      }
    }

    if (!segment.presenter_intro) {
      issues.push({
        severity: "warning",
        code: "missing_presenter_intro",
        performance_id: segment.performance_id,
        message: `${segment.band_name} has no presenter introduction.`,
      });
    } else {
      const presenter = segment.assets.find((asset) => asset.kind === "presenter_audio");
      const expectedScriptChecksum = manifestChecksum(canonicalise(segment.presenter_intro));
      if (
        !presenter?.url
        || !presenter.duration_ms
        || presenter.duration_ms <= 0
        || !presenter.sha256
        || !presenter.version
        || presenter.script_checksum !== expectedScriptChecksum
      ) {
        issues.push({
          severity: "blocking",
          code: "missing_presenter_audio",
          performance_id: segment.performance_id,
          message: `${segment.band_name} needs a recorded presenter introduction matching the current script before external production.`,
        });
      }
    }
  }

  return issues;
}

export function promoteTotpManifest(
  manifest: TotpEpisodeManifest,
  nextState: TotpProductionState,
  evaluatedOn?: string,
): { manifest: TotpEpisodeManifest; blocked: TotpManifestIssue[] } {
  const issues = validateTotpEpisodeManifest(manifest, evaluatedOn);
  const blocked = issues.filter((issue) => issue.severity === "blocking");
  if (nextState !== "gameplay" && blocked.length > 0) {
    return { manifest, blocked };
  }
  return { manifest: { ...manifest, production_state: nextState }, blocked: [] };
}
