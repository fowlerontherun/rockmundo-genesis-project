import { canonicalise, manifestChecksum, type TotpEpisodeManifest } from "./episodeManifest";
import type { TotpCaptionCue } from "./broadcastCaptions";

/**
 * Phase 5 — rights, moderation, safety and accessibility hardening.
 *
 * One deterministic screening pass over the frozen running sheet. It answers
 * three questions before an episode can leave the game:
 *   1. has every player in the episode agreed to external use?
 *   2. is every name, title and presenter line safe to publish?
 *   3. do the captions and delivery targets meet accessibility rules?
 *
 * The result is a storable report attached to the master, so any published
 * episode can always prove what was checked and when.
 */

export type TotpComplianceArea = "consent" | "moderation" | "accessibility" | "rights" | "takedown";

export type TotpComplianceSeverity = "blocker" | "warning" | "info";

export interface TotpComplianceFinding {
  code: string;
  area: TotpComplianceArea;
  severity: TotpComplianceSeverity;
  passed: boolean;
  label: string;
  detail: string;
  performance_id: string | null;
}

export interface TotpComplianceReport {
  report_version: 1;
  episode_id: string;
  episode_number: number;
  manifest_checksum: string;
  findings: TotpComplianceFinding[];
  blockers: TotpComplianceFinding[];
  warnings: TotpComplianceFinding[];
  passed: boolean;
  checksum: string;
}

export interface TotpEpisodeConsent {
  performance_id: string;
  band_id: string;
  band_name: string;
  player_members: number;
  consented_members: number;
  consented: boolean;
}

export interface TotpEpisodeTakedown {
  id: string;
  episode_id: string;
  performance_id: string | null;
  action: "remove" | "replace" | "mute";
  reason: string;
  replacement_note: string | null;
  active: boolean;
  created_at: string;
}

/** Accessibility limits used for captions and on-screen reading comfort. */
export const TOTP_CAPTION_LIMITS = {
  maxCharacters: 84,
  minDurationMs: 1_200,
  maxCharactersPerSecond: 21,
} as const;

/** Never publishable: hateful or sexually exploitative language. */
const PROHIBITED_TERMS = [
  "nigger",
  "nigga",
  "faggot",
  "tranny",
  "paki",
  "kike",
  "spic",
  "chink",
  "retard",
  "rape",
  "raping",
  "paedo",
  "pedo",
  "child porn",
  "kill yourself",
  "kys",
];

/** Allowed in game, but flagged for a human before external publication. */
const FLAGGED_TERMS = [
  "fuck",
  "fucking",
  "shit",
  "cunt",
  "bitch",
  "bastard",
  "whore",
  "slut",
  "cocaine",
  "heroin",
  "meth",
  "overdose",
  "suicide",
  "nazi",
];

function matchTerms(text: string, terms: string[]): string[] {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ")} `;
  return terms.filter((term) => haystack.includes(` ${term} `) || haystack.includes(` ${term}s `));
}

export interface TotpModerationHit {
  performance_id: string | null;
  field: "band_name" | "song_title" | "presenter_intro" | "caption";
  level: "prohibited" | "flagged";
  terms: string[];
  excerpt: string;
}

/** Deterministic text screening of every publishable string in the episode. */
export function screenTotpText(
  manifest: TotpEpisodeManifest,
  captions: TotpCaptionCue[] = [],
): TotpModerationHit[] {
  const hits: TotpModerationHit[] = [];

  const inspect = (
    performanceId: string | null,
    field: TotpModerationHit["field"],
    value: string | null | undefined,
  ) => {
    const text = (value ?? "").trim();
    if (!text) return;
    const prohibited = matchTerms(text, PROHIBITED_TERMS);
    if (prohibited.length > 0) {
      hits.push({ performance_id: performanceId, field, level: "prohibited", terms: prohibited, excerpt: text.slice(0, 120) });
      return;
    }
    const flagged = matchTerms(text, FLAGGED_TERMS);
    if (flagged.length > 0) {
      hits.push({ performance_id: performanceId, field, level: "flagged", terms: flagged, excerpt: text.slice(0, 120) });
    }
  };

  for (const segment of manifest.segments) {
    inspect(segment.performance_id, "band_name", segment.band_name);
    inspect(segment.performance_id, "song_title", segment.song_title);
    inspect(segment.performance_id, "presenter_intro", segment.presenter_intro);
  }
  for (const caption of captions) {
    inspect(null, "caption", caption.text);
  }

  return hits;
}

export interface TotpCaptionIssue {
  caption_id: string;
  code: "too_long" | "too_fast" | "too_short";
  detail: string;
}

/** Readability checks on the deterministic caption track. */
export function checkTotpCaptionReadability(captions: TotpCaptionCue[]): TotpCaptionIssue[] {
  const issues: TotpCaptionIssue[] = [];
  for (const caption of captions) {
    const durationMs = Math.max(0, caption.endMs - caption.startMs);
    const length = caption.text.trim().length;
    if (length > TOTP_CAPTION_LIMITS.maxCharacters) {
      issues.push({
        caption_id: caption.id,
        code: "too_long",
        detail: `${length} characters on screen at once (limit ${TOTP_CAPTION_LIMITS.maxCharacters}).`,
      });
    }
    if (durationMs > 0 && durationMs < TOTP_CAPTION_LIMITS.minDurationMs) {
      issues.push({
        caption_id: caption.id,
        code: "too_short",
        detail: `On screen for only ${durationMs}ms.`,
      });
    }
    const perSecond = durationMs > 0 ? (length / durationMs) * 1000 : 0;
    if (perSecond > TOTP_CAPTION_LIMITS.maxCharactersPerSecond) {
      issues.push({
        caption_id: caption.id,
        code: "too_fast",
        detail: `Reads at ${perSecond.toFixed(1)} characters a second (limit ${TOTP_CAPTION_LIMITS.maxCharactersPerSecond}).`,
      });
    }
  }
  return issues.sort((a, b) => a.caption_id.localeCompare(b.caption_id) || a.code.localeCompare(b.code));
}

export interface TotpComplianceInput {
  manifest: TotpEpisodeManifest;
  captions?: TotpCaptionCue[];
  consents?: TotpEpisodeConsent[];
  takedowns?: TotpEpisodeTakedown[];
}

function finding(
  code: string,
  area: TotpComplianceArea,
  severity: TotpComplianceSeverity,
  passed: boolean,
  label: string,
  detail: string,
  performanceId: string | null = null,
): TotpComplianceFinding {
  return { code, area, severity, passed, label, detail, performance_id: performanceId };
}

export function screenTotpEpisode(input: TotpComplianceInput): TotpComplianceReport {
  const { manifest } = input;
  const captions = input.captions ?? [];
  const consents = input.consents ?? [];
  const takedowns = (input.takedowns ?? []).filter((item) => item.active);
  const findings: TotpComplianceFinding[] = [];

  // Consent -------------------------------------------------------------
  const consentByPerformance = new Map(consents.map((entry) => [entry.performance_id, entry]));
  const missingConsent = manifest.segments.filter((segment) => {
    const entry = consentByPerformance.get(segment.performance_id);
    return !entry || !entry.consented;
  });
  findings.push(
    finding(
      "consent_signed",
      "consent",
      "blocker",
      consents.length > 0 && missingConsent.length === 0,
      "Players agreed to external use",
      consents.length === 0
        ? "Player permissions have not been checked for this episode yet."
        : missingConsent.length === 0
          ? "Every act in the episode has permission for external use."
          : `${missingConsent.length} act${missingConsent.length === 1 ? "" : "s"} still need player permission: ${missingConsent
              .map((segment) => segment.band_name)
              .join(", ")}.`,
    ),
  );
  for (const segment of missingConsent) {
    findings.push(
      finding(
        "consent_missing_act",
        "consent",
        "blocker",
        false,
        `${segment.band_name} has no permission`,
        `Remove or replace ${segment.band_name} until every player in the band agrees to external use.`,
        segment.performance_id,
      ),
    );
  }

  // Moderation ----------------------------------------------------------
  const hits = screenTotpText(manifest, captions);
  const prohibited = hits.filter((hit) => hit.level === "prohibited");
  const flagged = hits.filter((hit) => hit.level === "flagged");
  findings.push(
    finding(
      "moderation_clean",
      "moderation",
      "blocker",
      prohibited.length === 0,
      "Nothing unpublishable in the script",
      prohibited.length === 0
        ? "No prohibited language was found in names, titles, presenter links or subtitles."
        : `${prohibited.length} item${prohibited.length === 1 ? "" : "s"} contain language that cannot be published.`,
    ),
  );
  findings.push(
    finding(
      "moderation_review",
      "moderation",
      "warning",
      flagged.length === 0,
      "No wording needing review",
      flagged.length === 0
        ? "No wording was flagged for a human review."
        : `${flagged.length} item${flagged.length === 1 ? "" : "s"} contain strong wording — check it is acceptable for the channel.`,
    ),
  );
  for (const hit of hits) {
    findings.push(
      finding(
        `moderation_${hit.level}_${hit.field}`,
        "moderation",
        hit.level === "prohibited" ? "blocker" : "warning",
        false,
        hit.level === "prohibited" ? "Cannot be published" : "Needs a look",
        `${hit.field.replace("_", " ")}: “${hit.excerpt}” (${hit.terms.join(", ")}).`,
        hit.performance_id,
      ),
    );
  }

  // Accessibility -------------------------------------------------------
  findings.push(
    finding(
      "captions_present",
      "accessibility",
      "blocker",
      captions.length > 0,
      "Subtitles generated",
      captions.length > 0
        ? `${captions.length} subtitle lines were generated from the running sheet.`
        : "No subtitles have been generated from the running sheet.",
    ),
  );

  const captionIssues = checkTotpCaptionReadability(captions);
  findings.push(
    finding(
      "captions_readable",
      "accessibility",
      "warning",
      captionIssues.length === 0,
      "Subtitles comfortable to read",
      captionIssues.length === 0
        ? "Every subtitle stays within the reading limits."
        : `${captionIssues.length} subtitle line${captionIssues.length === 1 ? "" : "s"} are too long or too fast to read.`,
    ),
  );

  const captionedPerformances = manifest.segments.filter((segment) =>
    captions.some((caption) => caption.text.includes(segment.band_name) || caption.text.includes(segment.song_title)),
  );
  findings.push(
    finding(
      "captions_cover_acts",
      "accessibility",
      "warning",
      manifest.segments.length === 0 || captionedPerformances.length === manifest.segments.length,
      "Every act named in the subtitles",
      captionedPerformances.length === manifest.segments.length
        ? "Every act is named on screen and in the subtitles."
        : `${manifest.segments.length - captionedPerformances.length} act${
            manifest.segments.length - captionedPerformances.length === 1 ? " is" : "s are"
          } not named in the subtitles.`,
    ),
  );

  findings.push(
    finding(
      "audio_targets_declared",
      "accessibility",
      "info",
      true,
      "Sound levels checked on export",
      "The master is checked against the −14 LUFS programme level and −1 dBTP peak limit before delivery.",
    ),
  );

  const strobeHeavy = manifest.segments.filter((segment) => /strobe|laser|flash/i.test(segment.stage_key));
  findings.push(
    finding(
      "flashing_safe",
      "accessibility",
      "warning",
      strobeHeavy.length <= 1,
      "Flashing kept within safe limits",
      strobeHeavy.length <= 1
        ? "No more than one act uses heavy flashing lighting."
        : `${strobeHeavy.length} acts use heavy flashing lighting — add a warning card or change a stage.`,
    ),
  );

  // Rights --------------------------------------------------------------
  const unclearedRights = manifest.segments.filter((segment) => segment.rights.status !== "cleared");
  findings.push(
    finding(
      "rights_report",
      "rights",
      "blocker",
      manifest.segments.length > 0 && unclearedRights.length === 0,
      "Music rights recorded",
      unclearedRights.length === 0
        ? "Every track has an owner, licence, territory and online publishing status on record."
        : `${unclearedRights.length} track${unclearedRights.length === 1 ? "" : "s"} have no clear licence.`,
    ),
  );

  // Takedowns -----------------------------------------------------------
  findings.push(
    finding(
      "takedowns_clear",
      "takedown",
      "blocker",
      takedowns.length === 0,
      "No open takedown requests",
      takedowns.length === 0
        ? "There are no open takedown requests against this episode."
        : `${takedowns.length} open takedown request${takedowns.length === 1 ? "" : "s"} must be actioned before publishing.`,
    ),
  );
  for (const takedown of takedowns) {
    findings.push(
      finding(
        `takedown_${takedown.action}`,
        "takedown",
        "blocker",
        false,
        takedown.action === "remove"
          ? "Act must be removed"
          : takedown.action === "replace"
            ? "Act must be replaced"
            : "Act must be muted",
        takedown.reason,
        takedown.performance_id,
      ),
    );
  }

  const blockers = findings.filter((item) => item.severity === "blocker" && !item.passed);
  const warnings = findings.filter((item) => item.severity === "warning" && !item.passed);

  const body = {
    report_version: 1 as const,
    episode_id: manifest.episode_id,
    episode_number: manifest.episode_number,
    manifest_checksum: manifest.checksum,
    findings,
  };

  return {
    ...body,
    blockers,
    warnings,
    passed: blockers.length === 0,
    checksum: manifestChecksum(canonicalise(body)),
  };
}

export const TOTP_COMPLIANCE_AREA_LABELS: Record<TotpComplianceArea, string> = {
  consent: "Player permission",
  moderation: "Content review",
  accessibility: "Accessibility",
  rights: "Music rights",
  takedown: "Takedowns",
};
