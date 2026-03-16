export interface DikCokOutcomeInput {
  followers: number;
  bandFame: number;
  hasTrendingTag?: boolean;
}

export interface DikCokOutcome {
  views: number;
  hypeGain: number;
  fanGain: number;
  revenue: number;
  velocity: "Niche" | "Stable" | "Trending" | "Exploding";
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const calculateDikCokOutcome = (
  input: DikCokOutcomeInput,
  rng: () => number = Math.random,
): DikCokOutcome => {
  const followers = Math.max(0, input.followers || 0);
  const bandFame = Math.max(0, input.bandFame || 0);

  const followerReach = Math.max(150, followers * (0.18 + rng() * 0.24));
  const fameMultiplier = 1 + clamp(bandFame, 0, 300) / 220;
  const trendMultiplier = input.hasTrendingTag ? 1.2 : 1;
  const noiseMultiplier = 0.85 + rng() * 0.4;
  const discoveryViews = 80 + Math.floor(rng() * 520);

  const views = Math.round(followerReach * fameMultiplier * trendMultiplier * noiseMultiplier + discoveryViews);

  const hypeGain = Math.max(2, Math.round(views * (0.012 + bandFame / 18000)));
  const fanGain = Math.max(1, Math.round(views * (0.004 + bandFame / 45000)));
  const revenue = Math.round(views * (0.0012 + bandFame / 500000) * 100) / 100;

  const velocity: DikCokOutcome["velocity"] =
    views >= 25000 ? "Exploding" :
    views >= 9000 ? "Trending" :
    views >= 2500 ? "Stable" : "Niche";

  return { views, hypeGain, fanGain, revenue, velocity };
};
