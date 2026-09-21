export const TOTP_CHART_POSITIONS = Array.from({ length: 40 }, (_, index) => 40 - index);

const POSITION_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
  13: "thirteen",
  14: "fourteen",
  15: "fifteen",
  16: "sixteen",
  17: "seventeen",
  18: "eighteen",
  19: "nineteen",
  20: "twenty",
  21: "twenty-one",
  22: "twenty-two",
  23: "twenty-three",
  24: "twenty-four",
  25: "twenty-five",
  26: "twenty-six",
  27: "twenty-seven",
  28: "twenty-eight",
  29: "twenty-nine",
  30: "thirty",
  31: "thirty-one",
  32: "thirty-two",
  33: "thirty-three",
  34: "thirty-four",
  35: "thirty-five",
  36: "thirty-six",
  37: "thirty-seven",
  38: "thirty-eight",
  39: "thirty-nine",
  40: "forty",
};

export function totpChartPositionScript(rank: number): string {
  const words = POSITION_WORDS[rank];
  if (!words) throw new Error(`Unsupported Top of the Pops chart position: ${rank}`);
  return `At number ${words}.`;
}

export const TOTP_REUSABLE_VOICE_SCRIPT_GUIDE = [
  {
    id: "chart-intro",
    label: "Main chart introduction",
    script: "And now, let's take a look at this week's UK charts.",
    status: "already supported",
  },
  {
    id: "digital-sales-intro",
    label: "Digital Sales chart introduction",
    script: "First up, the Digital Sales Top Forty.",
    status: "recommended",
  },
  {
    id: "streaming-intro",
    label: "Streaming chart introduction",
    script: "And now, the Streaming Top Forty.",
    status: "recommended",
  },
  {
    id: "new-entry",
    label: "New entry cue",
    script: "A new entry this week.",
    status: "optional",
  },
  {
    id: "non-mover",
    label: "Non-mover cue",
    script: "A non-mover this week.",
    status: "optional",
  },
  {
    id: "moving-up",
    label: "Chart climber cue",
    script: "Moving up the chart this week.",
    status: "optional",
  },
  {
    id: "moving-down",
    label: "Chart faller cue",
    script: "Moving down the chart this week.",
    status: "optional",
  },
] as const;
