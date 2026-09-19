import type { TotpBroadcastCue } from "./broadcastTimeline";
import { formatTotpChartGraphic } from "./broadcastTimeline";

export interface TotpCaptionCue {
  id: string;
  startMs: number;
  endMs: number;
  speaker: string | null;
  text: string;
}

export interface TotpCaptionOptions {
  presenterName?: string | null;
  audienceText?: string;
}

/**
 * Deterministic caption track derived from the locked broadcast cues. The same
 * cues drive the on-screen subtitles in-app and the WebVTT sidecar used when an
 * episode is exported, so captions can never drift from the programme.
 */
export function buildTotpCaptionCues(cues: TotpBroadcastCue[], options: TotpCaptionOptions = {}): TotpCaptionCue[] {
  const presenterName = options.presenterName?.trim() || "Presenter";
  const captions: TotpCaptionCue[] = [];

  for (const cue of cues) {
    const startMs = Math.max(0, Math.round(cue.offsetMs));
    const endMs = startMs + Math.max(800, Math.round(cue.durationMs));

    if (cue.type === "presenter" && cue.presenterText?.trim()) {
      captions.push({ id: `caption-${cue.id}`, startMs, endMs, speaker: presenterName, text: cue.presenterText.trim() });
      continue;
    }
    if (cue.type === "graphic" && cue.graphic) {
      const movement = formatTotpChartGraphic(cue.graphic).replace(`#${cue.graphic.chartRank} `, "");
      captions.push({
        id: `caption-${cue.id}`,
        startMs,
        endMs,
        speaker: null,
        text: `[on screen] UK #${cue.graphic.chartRank} ${movement} — ${cue.graphic.artistName}, "${cue.graphic.songTitle}"`,
      });
      continue;
    }
    if (cue.type === "audience") {
      captions.push({
        id: `caption-${cue.id}`,
        startMs,
        endMs,
        speaker: null,
        text: options.audienceText ?? "[studio audience cheering and applauding]",
      });
    }
  }

  return captions.sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
}

export function activeTotpCaption(captions: TotpCaptionCue[], positionMs: number): TotpCaptionCue | null {
  return captions.find((caption) => positionMs >= caption.startMs && positionMs < caption.endMs) ?? null;
}

function formatVttTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

/** WebVTT sidecar for accessibility and later YouTube delivery. */
export function toTotpWebVtt(captions: TotpCaptionCue[]): string {
  const blocks = captions.map((caption) => {
    const line = caption.speaker ? `<v ${caption.speaker}>${caption.text}` : caption.text;
    return `${caption.id}\n${formatVttTimestamp(caption.startMs)} --> ${formatVttTimestamp(caption.endMs)}\n${line}`;
  });
  return ["WEBVTT", "", ...blocks].join("\n\n").trimEnd() + "\n";
}
