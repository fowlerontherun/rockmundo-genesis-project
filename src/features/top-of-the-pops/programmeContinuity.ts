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
  presentation: "main_desk" | "audience_floor" | "side_stage" | "chart_wall" | "camera_walk";
  nextAct?: TotpProgrammeRundownItem | null;
}

function stableContinuityIndex(value: string, length: number): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % Math.max(1, length);
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
    const first = ordered[0] ?? null;
    const variants = first ? [
      {
        eyebrow: "Tonight on Top of the Pops!",
        headline: `${ordered.length} charting ${ordered.length === 1 ? "act" : "acts"} — live from London!`,
        body: `The studio is packed, the cameras are rolling, and we're starting with ${first.bandName}. Turn it up!`,
        presentation: "main_desk" as const,
      },
      {
        eyebrow: "We're live!",
        headline: "London, are you ready?",
        body: `We've got ${ordered.length} charting ${ordered.length === 1 ? "act" : "acts"} in the studio tonight, and ${first.bandName} are first up.`,
        presentation: "audience_floor" as const,
      },
      {
        eyebrow: "Top of the Pops",
        headline: "The charts come to life",
        body: `Welcome to RockMundo Television Centre. Cameras are set, the audience is ready, and ${first.bandName} are waiting in the wings.`,
        presentation: "camera_walk" as const,
      },
      {
        eyebrow: "Live from London",
        headline: "Tonight's biggest chart acts",
        body: `We're taking you around the studio all night. First stop: ${first.stage.replaceAll("_", " ")} for ${first.bandName}.`,
        presentation: "side_stage" as const,
      },
    ] : [{
      eyebrow: "Tonight on Top of the Pops!",
      headline: "Live from London",
      body: "The studio is packed, the cameras are rolling, and we're ready to go!",
      presentation: "main_desk" as const,
    }];
    const chosen = variants[stableContinuityIndex(`opening:${ordered.map((act) => act.replayId).join(":")}`, variants.length)];
    return { ...chosen, nextAct: first };
  }

  if (kind === "between" && current && nextAct) {
    const stageMove = nextAct.stage === current.stage
      ? "straight back to the same stage"
      : `across the studio to ${nextAct.stage.replaceAll("_", " ")}`;
    const variants = [
      {
        eyebrow: "Back in the studio!",
        headline: `${current.bandName} — what a performance!`,
        body: `That's this week's number ${current.chartRank}. We're heading ${stageMove}; next up, ${nextAct.bandName} at number ${nextAct.chartRank}.`,
        presentation: "main_desk" as const,
      },
      {
        eyebrow: "Studio audience",
        headline: "Keep that noise going!",
        body: `A huge reaction for ${current.bandName}. We're moving ${stageMove}, where ${nextAct.bandName} are ready to go.`,
        presentation: "audience_floor" as const,
      },
      {
        eyebrow: "Across the studio",
        headline: `Next: ${nextAct.bandName}`,
        body: `While the floor crew reset after ${current.bandName}, we're heading ${stageMove}. ${nextAct.bandName} are currently number ${nextAct.chartRank}.`,
        presentation: "camera_walk" as const,
      },
      {
        eyebrow: "Chart watch",
        headline: `#${nextAct.chartRank} and live next`,
        body: `${current.bandName} have just brought the studio to life. Coming up now, another charting performance from ${nextAct.bandName}.`,
        presentation: "chart_wall" as const,
      },
      {
        eyebrow: "Side-stage",
        headline: "The next act is ready",
        body: `The applause is still going for ${current.bandName}, but ${nextAct.bandName} are already taking their marks on ${nextAct.stage.replaceAll("_", " ")}.`,
        presentation: "side_stage" as const,
      },
      {
        eyebrow: "Top of the Pops",
        headline: "No time to slow down",
        body: `From number ${current.chartRank} to number ${nextAct.chartRank}: ${nextAct.bandName} are coming up next.`,
        presentation: "audience_floor" as const,
      },
    ];
    const chosen = variants[stableContinuityIndex(`between:${current.replayId}:${nextAct.replayId}`, variants.length)];
    return { ...chosen, nextAct };
  }

  const numberOne = ordered.find((act) => act.chartRank === 1) ?? null;
  const closingVariants = numberOne ? [
    {
      eyebrow: "What a show!",
      headline: `Tonight's #1: ${numberOne.bandName}`,
      body: `${numberOne.bandName} are sitting at number one. Thanks for making some noise with us tonight — we'll see you next time!`,
      presentation: "main_desk" as const,
    },
    {
      eyebrow: "That's your lot!",
      headline: "One more cheer before we go",
      body: `The studio belongs to ${numberOne.bandName} at number one tonight. Thanks for watching Top of the Pops.`,
      presentation: "audience_floor" as const,
    },
    {
      eyebrow: "Chart topper",
      headline: `${numberOne.bandName} finish the night at #1`,
      body: "That's the chart, that's the show, and that's all from London. See you next time.",
      presentation: "chart_wall" as const,
    },
  ] : [
    {
      eyebrow: "What a show!",
      headline: "See you for the next show",
      body: "Thanks for joining us in London. Keep the music loud and we'll see you on the next Top of the Pops!",
      presentation: "main_desk" as const,
    },
    {
      eyebrow: "From London",
      headline: "Goodnight from Top of the Pops",
      body: "The cameras are coming down and the studio is clearing out. We'll do it all again next time.",
      presentation: "camera_walk" as const,
    },
  ];
  const chosen = closingVariants[stableContinuityIndex(`closing:${ordered.map((act) => act.replayId).join(":")}`, closingVariants.length)];
  return { ...chosen, nextAct: null };
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
