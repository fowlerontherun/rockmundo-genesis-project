import type { TotpBroadcastReplay } from "./api";

export type TotpContinuityKind = "opening" | "between" | "closing";

export interface TotpProgrammeRundownItem {
  replayId: string;
  runningOrder: number;
  chartRank: number;
  bandName: string;
  songTitle: string;
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

export function buildTotpProgrammeRundown(replays: TotpBroadcastReplay[]): TotpProgrammeRundownItem[] {
  return orderTotpProgrammeReplays(replays)
    .map((replay) => ({
      replayId: replay.id,
      runningOrder: Number(replay.payload.runningOrder),
      chartRank: Number(replay.payload.song.qualifyingRank),
      bandName: replay.payload.band.name,
      songTitle: replay.payload.song.title,
    }))
    .sort((a, b) => a.chartRank - b.chartRank || a.runningOrder - b.runningOrder || a.replayId.localeCompare(b.replayId));
}

export function buildTotpContinuityCopy(
  kind: TotpContinuityKind,
  replays: TotpBroadcastReplay[],
  currentIndex = 0,
): TotpContinuityCopy {
  const ordered = orderTotpProgrammeReplays(replays);
  const current = ordered[currentIndex] ?? null;
  const next = ordered[currentIndex + 1] ?? null;
  const nextAct = next
    ? {
        replayId: next.id,
        runningOrder: Number(next.payload.runningOrder),
        chartRank: Number(next.payload.song.qualifyingRank),
        bandName: next.payload.band.name,
        songTitle: next.payload.song.title,
      }
    : null;

  if (kind === "opening") {
    return {
      eyebrow: "Tonight on Top of the Pops",
      headline: `${ordered.length} charting ${ordered.length === 1 ? "act" : "acts"} live from London`,
      body: "Every performance tonight earned its place from the locked UK streaming and digital-sales chart snapshot.",
      nextAct: ordered[0]
        ? {
            replayId: ordered[0].id,
            runningOrder: Number(ordered[0].payload.runningOrder),
            chartRank: Number(ordered[0].payload.song.qualifyingRank),
            bandName: ordered[0].payload.band.name,
            songTitle: ordered[0].payload.song.title,
          }
        : null,
    };
  }

  if (kind === "between" && current && nextAct) {
    return {
      eyebrow: "Back to the studio",
      headline: `${current.payload.band.name} — ${current.payload.song.title}`,
      body: `That was this week's #${current.payload.song.qualifyingRank}. Coming up, ${nextAct.bandName} perform ${nextAct.songTitle}, currently #${nextAct.chartRank}.`,
      nextAct,
    };
  }

  const numberOne = ordered.find((replay) => Number(replay.payload.song.qualifyingRank) === 1) ?? null;
  return {
    eyebrow: "That's all from Top of the Pops",
    headline: numberOne
      ? `Tonight's #1: ${numberOne.payload.band.name}`
      : "See you for the next show",
    body: numberOne
      ? `${numberOne.payload.song.title} closes out the programme as the highest-ranked performance of the night.`
      : "The studio lights are going down in London. The next edition will use a fresh locked chart snapshot and a new running order.",
    nextAct: null,
  };
}
