import type { TotpBroadcastReplay } from "./api";

export type TotpContinuityKind = "opening" | "between" | "closing";

export interface TotpProgrammeRundownItem {
  replayId: string;
  runningOrder: number;
  chartRank: number;
  bandName: string;
  songTitle: string;
  stage: string;
}

export interface TotpContinuityCopy {
  eyebrow: string;
  headline: string;
  body: string;
  nextAct?: TotpProgrammeRundownItem | null;
}

export function orderTotpProgrammeReplays(replays: TotpBroadcastReplay[]): TotpBroadcastReplay[] {
  return [...replays].sort((a, b) => {
    const runningOrder = Number(a.payload.runningOrder) - Number(b.payload.runningOrder);
    return runningOrder !== 0 ? runningOrder : a.id.localeCompare(b.id);
  });
}

function replayRundownInRunningOrder(replays: TotpBroadcastReplay[]): TotpProgrammeRundownItem[] {
  return orderTotpProgrammeReplays(replays).map((replay) => ({
    replayId: replay.id,
    runningOrder: Number(replay.payload.runningOrder),
    chartRank: Number(replay.payload.song.qualifyingRank),
    bandName: replay.payload.band.name,
    songTitle: replay.payload.song.title,
    stage: replay.payload.stage,
  }));
}

export function buildTotpProgrammeRundown(replays: TotpBroadcastReplay[]): TotpProgrammeRundownItem[] {
  return replayRundownInRunningOrder(replays)
    .sort((a, b) => a.chartRank - b.chartRank || a.runningOrder - b.runningOrder || a.replayId.localeCompare(b.replayId));
}

export function buildTotpContinuityCopyFromActs(
  kind: TotpContinuityKind,
  acts: TotpProgrammeRundownItem[],
  currentIndex = 0,
): TotpContinuityCopy {
  const ordered = [...acts].sort(
    (a, b) => a.runningOrder - b.runningOrder || a.replayId.localeCompare(b.replayId),
  );
  const current = ordered[currentIndex] ?? null;
  const nextAct = ordered[currentIndex + 1] ?? null;

  if (kind === "opening") {
    return {
      eyebrow: "Tonight on Top of the Pops!",
      headline: `${ordered.length} charting ${ordered.length === 1 ? "act" : "acts"} — live from London!`,
      body: ordered[0]
        ? `The studio is packed, the cameras are rolling, and we're starting with ${ordered[0].bandName}! Turn it up!`
        : "The studio is packed, the cameras are rolling, and we're ready to go!",
      nextAct: ordered[0] ?? null,
    };
  }

  if (kind === "between" && current && nextAct) {
    return {
      eyebrow: "Back in the studio!",
      headline: `${current.bandName} — what a performance!`,
      body: `What a reaction! That's this week's number ${current.chartRank}. We're heading ${nextAct.stage === current.stage ? "straight back to the same stage" : `across the studio to ${nextAct.stage.replaceAll("_", " ")}`} — next up, another chart hit from ${nextAct.bandName}, currently at number ${nextAct.chartRank}!`,
      nextAct,
    };
  }

  const numberOne = ordered.find((act) => act.chartRank === 1) ?? null;
  return {
    eyebrow: "What a show!",
    headline: numberOne
      ? `Tonight's #1: ${numberOne.bandName}`
      : "See you for the next show",
    body: numberOne
      ? `${numberOne.bandName} are sitting at number one! Thanks for making some noise with us tonight — we'll see you next time!`
      : "Thanks for joining us in London! Keep the music loud and we'll see you on the next Top of the Pops!",
    nextAct: null,
  };
}

export function buildTotpContinuityCopy(
  kind: TotpContinuityKind,
  replays: TotpBroadcastReplay[],
  currentIndex = 0,
): TotpContinuityCopy {
  return buildTotpContinuityCopyFromActs(
    kind,
    replayRundownInRunningOrder(replays),
    currentIndex,
  );
}

export function totpContinuitySpeech(copy: TotpContinuityCopy): string {
  const headline = copy.headline.trim();
  const separator = /[.!?]$/.test(headline) ? " " : ". ";
  return `${headline}${separator}${copy.body.trim()}`.trim();
}
