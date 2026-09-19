import type { TotpEpisodeManifest, TotpManifestIssue, TotpProductionState } from "./episodeManifest";
import type { StoredTotpEpisodeManifest } from "./episodeManifestApi";
import type { TotpRenderJob } from "./renderQueueApi";
import type { TotpEpisodePlan } from "./scheduleApi";
import { TOTP_TARGET_RUNTIME_SECONDS, plannedRuntimeSeconds } from "./scheduleWeeks";

/**
 * Phase 3 control room.
 *
 * A single deterministic preflight report, graded by severity, so the show can
 * only move from rehearsal to render to publish when every blocker is clear.
 */

export type TotpPreflightSeverity = "blocker" | "warning" | "info";

export type TotpPreflightArea =
  | "running_sheet"
  | "acts"
  | "audio"
  | "rights"
  | "runtime"
  | "render"
  | "automation";

export interface TotpPreflightCheck {
  code: string;
  area: TotpPreflightArea;
  severity: TotpPreflightSeverity;
  label: string;
  detail: string;
  passed: boolean;
}

export interface TotpPreflightReport {
  checks: TotpPreflightCheck[];
  blockers: TotpPreflightCheck[];
  warnings: TotpPreflightCheck[];
  passedCount: number;
  rehearsalReady: boolean;
  renderReady: boolean;
  publishReady: boolean;
  productionState: TotpProductionState;
}

export interface TotpPreflightInput {
  manifest: TotpEpisodeManifest | null;
  issues?: TotpManifestIssue[];
  stored?: StoredTotpEpisodeManifest | null;
  plan?: TotpEpisodePlan | null;
  renderJobs?: TotpRenderJob[];
  automationHealthy?: boolean | null;
  rehearsalCheckedAt?: string | null;
}

export const TOTP_PREFLIGHT_AREA_LABELS: Record<TotpPreflightArea, string> = {
  running_sheet: "Running sheet",
  acts: "Acts",
  audio: "Sound",
  rights: "Music permissions",
  runtime: "Running time",
  render: "Export",
  automation: "Automation",
};

function check(
  code: string,
  area: TotpPreflightArea,
  severity: TotpPreflightSeverity,
  passed: boolean,
  label: string,
  detail: string,
): TotpPreflightCheck {
  return { code, area, severity, passed, label, detail };
}

export function buildTotpPreflight(input: TotpPreflightInput): TotpPreflightReport {
  const checks: TotpPreflightCheck[] = [];
  const manifest = input.manifest;
  const issues = input.issues ?? [];
  const stored = input.stored ?? null;
  const renderJobs = input.renderJobs ?? [];

  checks.push(
    check(
      "manifest_built",
      "running_sheet",
      "blocker",
      !!manifest,
      "Running sheet built",
      manifest ? "The running sheet has been built from the episode." : "The running sheet has not been built yet.",
    ),
  );

  const segments = manifest?.segments ?? [];
  checks.push(
    check(
      "acts_present",
      "acts",
      "blocker",
      segments.length > 0,
      "Acts booked",
      segments.length > 0
        ? `${segments.length} act${segments.length === 1 ? "" : "s"} are in the running order.`
        : "No acts are in the running order.",
    ),
  );

  checks.push(
    check(
      "acts_minimum",
      "acts",
      "warning",
      segments.length >= 3,
      "At least three acts",
      segments.length >= 3
        ? "The episode has enough acts for a full show."
        : "A broadcast show usually needs three or more acts.",
    ),
  );

  const missingAudio = segments.filter(
    (segment) => !segment.assets.some((asset) => asset.kind === "song_audio" && asset.url),
  );
  checks.push(
    check(
      "song_audio",
      "audio",
      "blocker",
      segments.length > 0 && missingAudio.length === 0,
      "Every act has its song",
      missingAudio.length === 0
        ? "All acts have a playable recording."
        : `${missingAudio.length} act${missingAudio.length === 1 ? "" : "s"} have no playable recording.`,
    ),
  );

  const missingDuration = segments.filter(
    (segment) => !segment.assets.some((asset) => asset.kind === "song_audio" && (asset.duration_ms ?? 0) > 0),
  );
  checks.push(
    check(
      "song_duration",
      "audio",
      "warning",
      missingDuration.length === 0,
      "Song lengths known",
      missingDuration.length === 0
        ? "Every song length is known, so the running time is accurate."
        : `${missingDuration.length} song length${missingDuration.length === 1 ? " is" : "s are"} unknown, so the running time is estimated.`,
    ),
  );

  const missingIntro = segments.filter((segment) => !segment.presenter_intro);
  checks.push(
    check(
      "presenter_links",
      "acts",
      "warning",
      missingIntro.length === 0,
      "Presenter introductions written",
      missingIntro.length === 0
        ? "Every act has a presenter introduction."
        : `${missingIntro.length} act${missingIntro.length === 1 ? "" : "s"} have no presenter introduction.`,
    ),
  );

  const uncleared = segments.filter((segment) => segment.rights.status !== "cleared");
  checks.push(
    check(
      "rights_cleared",
      "rights",
      "blocker",
      segments.length > 0 && uncleared.length === 0,
      "Music cleared for broadcast",
      uncleared.length === 0
        ? "All music in the episode is cleared for broadcast."
        : `${uncleared.length} track${uncleared.length === 1 ? "" : "s"} are not cleared for broadcast.`,
    ),
  );

  const notAllowlisted = segments.filter((segment) => !segment.rights.content_id_allowlisted);
  checks.push(
    check(
      "rights_allowlisted",
      "rights",
      "warning",
      notAllowlisted.length === 0,
      "Cleared for online publishing",
      notAllowlisted.length === 0
        ? "Every track can be published online without a claim."
        : `${notAllowlisted.length} track${notAllowlisted.length === 1 ? "" : "s"} may be blocked when published online.`,
    ),
  );

  const blockingIssues = issues.filter((issue) => issue.severity === "blocking");
  checks.push(
    check(
      "manifest_issues",
      "running_sheet",
      "blocker",
      blockingIssues.length === 0,
      "No outstanding problems",
      blockingIssues.length === 0
        ? "The running sheet reports no blocking problems."
        : blockingIssues.map((issue) => issue.message).join(" "),
    ),
  );

  const inSync = !!manifest && !!stored && stored.checksum === manifest.checksum;
  checks.push(
    check(
      "sheet_saved",
      "running_sheet",
      "blocker",
      inSync,
      "Running sheet saved",
      inSync
        ? "The saved running sheet matches the live episode."
        : stored
          ? "The saved running sheet is out of date — save it again."
          : "The running sheet has not been saved yet.",
    ),
  );

  const runtimeSeconds = Math.round((manifest?.total_runtime_ms ?? 0) / 1000);
  const withinRuntime = runtimeSeconds > 0 && Math.abs(runtimeSeconds - TOTP_TARGET_RUNTIME_SECONDS) <= 5 * 60;
  checks.push(
    check(
      "runtime_target",
      "runtime",
      "warning",
      withinRuntime,
      "Running time close to target",
      runtimeSeconds > 0
        ? `The episode runs about ${Math.round(runtimeSeconds / 60)} minutes against a ${Math.round(TOTP_TARGET_RUNTIME_SECONDS / 60)} minute target.`
        : "The running time cannot be worked out yet.",
    ),
  );

  const planSeconds = input.plan ? plannedRuntimeSeconds(input.plan.segments) : 0;
  checks.push(
    check(
      "plan_present",
      "runtime",
      "info",
      !!input.plan,
      "Planned in advance",
      input.plan
        ? `Planned running sheet notes are attached${planSeconds > 0 ? ` (${Math.round(planSeconds / 60)} minutes planned)` : ""}.`
        : "No advance plan was written for this episode.",
    ),
  );

  const succeeded = renderJobs.find((job) => job.state === "succeeded" && (!manifest || job.manifest_checksum === manifest.checksum));
  const failed = renderJobs.find((job) => job.state === "failed");
  checks.push(
    check(
      "render_master",
      "render",
      "warning",
      !!succeeded,
      "Finished master available",
      succeeded
        ? "A finished master for this running sheet is ready."
        : failed
          ? `The last export failed: ${failed.error_message ?? "no reason given"}.`
          : "No finished master has been produced yet.",
    ),
  );

  const rehearsed = !!input.rehearsalCheckedAt;
  checks.push(
    check(
      "rehearsal_done",
      "render",
      "warning",
      rehearsed,
      "Rehearsal pass logged",
      rehearsed ? "A rehearsal pass has been logged for this episode." : "No rehearsal pass has been logged yet.",
    ),
  );

  if (input.automationHealthy !== null && input.automationHealthy !== undefined) {
    checks.push(
      check(
        "automation_healthy",
        "automation",
        "warning",
        input.automationHealthy,
        "Show automation healthy",
        input.automationHealthy
          ? "Chart updates and episode preparation are running."
          : "Chart updates or episode preparation need attention.",
      ),
    );
  }

  const blockers = checks.filter((item) => item.severity === "blocker" && !item.passed);
  const warnings = checks.filter((item) => item.severity === "warning" && !item.passed);
  const productionState = stored?.production_state ?? "gameplay";

  return {
    checks,
    blockers,
    warnings,
    passedCount: checks.filter((item) => item.passed).length,
    rehearsalReady: segments.length > 0 && missingAudio.length === 0,
    renderReady: blockers.length === 0,
    publishReady: blockers.length === 0 && !!succeeded && rehearsed,
    productionState,
  };
}

export function totpPreflightSeverityLabel(severity: TotpPreflightSeverity): string {
  switch (severity) {
    case "blocker":
      return "Must fix";
    case "warning":
      return "Should fix";
    default:
      return "Note";
  }
}
