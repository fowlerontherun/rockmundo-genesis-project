import type { MinigameAttemptResult, MinigameSimulationInput } from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface MixChannel {
  name: string;
  targetLevel: number;
  tolerance: number;
}

const MIX_CHANNELS: MixChannel[] = [
  { name: "Vocals", targetLevel: 0.76, tolerance: 0.05 },
  { name: "Lead Guitar", targetLevel: 0.7, tolerance: 0.08 },
  { name: "Rhythm Guitar", targetLevel: 0.64, tolerance: 0.07 },
  { name: "Bass", targetLevel: 0.58, tolerance: 0.06 },
  { name: "Drums", targetLevel: 0.82, tolerance: 0.05 },
  { name: "Synth", targetLevel: 0.6, tolerance: 0.09 },
];

const generateChannelTargets = (
  difficulty: number,
  rng: () => number,
): MixChannel[] =>
  MIX_CHANNELS.map((channel) => ({
    ...channel,
    targetLevel: clamp(
      channel.targetLevel + (rng() - 0.5) * 0.08 * (1 + difficulty * 0.05),
      0.35,
      0.95,
    ),
    tolerance: clamp(
      channel.tolerance - difficulty * 0.005 + (rng() - 0.5) * 0.01,
      0.03,
      0.1,
    ),
  }));

interface ChannelEvaluation {
  channel: MixChannel;
  setLevel: number;
  withinRange: boolean;
  variance: number;
}

const evaluateChannel = (
  channel: MixChannel,
  skillLevel: number,
  focus: number,
  rng: () => number,
): ChannelEvaluation => {
  const precision = clamp((skillLevel + focus) / 20, 0.2, 1.35);
  const noise = (rng() - 0.5) * (0.25 - precision * 0.1);
  const adjustment = channel.targetLevel + noise;
  const finalLevel = clamp(adjustment, 0.2, 1);
  const variance = Math.abs(finalLevel - channel.targetLevel);

  return {
    channel,
    setLevel: finalLevel,
    withinRange: variance <= channel.tolerance * (1 + (1 - precision) * 0.4),
    variance,
  };
};

export const simulateSoundcheckMix = (
  input: MinigameSimulationInput,
): MinigameAttemptResult => {
  const rng = input.rng ?? Math.random;
  const channels = generateChannelTargets(input.difficulty, rng);
  const skillLevel = input.skillLevel ?? 5;
  const focus = input.focus ?? 5;

  const evaluations = channels.map((channel) =>
    evaluateChannel(channel, skillLevel, focus, rng),
  );

  const perfectMixes = evaluations.filter((evaluation) => evaluation.withinRange)
    .length;
  const accuracy =
    evaluations.reduce((sum, evaluation) => sum + (1 - evaluation.variance), 0) /
    evaluations.length;

  const combo = Math.round(
    perfectMixes * (1 + (skillLevel + focus) / 18) * (accuracy + 0.5),
  );
  const score = Math.round(
    perfectMixes * 280 + accuracy * 220 + input.difficulty * 90 + combo * 4,
  );
  const xpGained = Math.round(
    32 + input.difficulty * 6 + perfectMixes * 10 + accuracy * 40,
  );
  const cashReward = Math.round(
    20 + perfectMixes * 9 + accuracy * 18 + input.difficulty * 4,
  );
  const success = perfectMixes >= Math.ceil(channels.length * 0.5);

  return {
    minigameType: "soundcheck",
    difficulty: input.difficulty,
    score,
    accuracy: Number(clamp(accuracy, 0, 1).toFixed(2)),
    combo,
    xpGained,
    cashReward,
    success,
    durationSeconds: Math.round(55 + input.difficulty * 6),
    details: {
      channels: evaluations,
      perfectMixes,
    },
  };
};
