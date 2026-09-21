export type TotpReusablePresenterPhraseCategory =
  | "general"
  | "new_entry"
  | "climber"
  | "returning"
  | "top_ten"
  | "number_one"
  | "continuity";

export interface TotpReusablePresenterPhrase {
  id: string;
  label: string;
  script: string;
  category: TotpReusablePresenterPhraseCategory;
  usage: string;
}

export const TOTP_REUSABLE_PRESENTER_PHRASES: TotpReusablePresenterPhrase[] = [
  { id: "please-welcome", label: "Please welcome", script: "Please welcome", category: "general", usage: "Neutral introduction before the recorded band name." },
  { id: "up-next-its", label: "Up next", script: "Up next, it's", category: "general", usage: "Fast link into the next act." },
  { id: "and-now-its", label: "And now", script: "And now, it's", category: "general", usage: "Simple evergreen studio introduction." },
  { id: "time-for", label: "It's time for", script: "It's time for", category: "general", usage: "Flexible introduction before a band name." },
  { id: "another-hit-from", label: "Another chart hit", script: "Here's another chart hit from", category: "general", usage: "Use for an established charting act." },
  { id: "another-smash-from", label: "Another smash hit", script: "Here's another smash hit from", category: "general", usage: "Higher-energy established-act introduction." },
  { id: "one-you-know-from", label: "One you know", script: "Here's one you know from", category: "general", usage: "Familiar returning song or act." },
  { id: "studio-ready-for", label: "Studio ready", script: "The studio's ready for", category: "general", usage: "Crowd/studio handoff." },

  { id: "latest-entry-from", label: "Latest entry", script: "Here's the latest entry from", category: "new_entry", usage: "For a new chart entry." },
  { id: "brand-new-entry-from", label: "Brand-new entry", script: "A brand-new chart entry from", category: "new_entry", usage: "Alternative new-entry line." },
  { id: "debut-its", label: "TOTP debut", script: "Making their Top of the Pops debut, it's", category: "new_entry", usage: "First-ever Top of the Pops appearance." },

  { id: "climbing-chart-its", label: "Climbing the chart", script: "Climbing the chart this week, it's", category: "climber", usage: "For an act moving upward." },
  { id: "biggest-movers-its", label: "Biggest mover", script: "One of this week's biggest movers, it's", category: "climber", usage: "For a large week-on-week rise." },
  { id: "moving-up-its", label: "Moving up", script: "Moving up this week, it's", category: "climber", usage: "Short upward-movement cue." },

  { id: "back-on-totp-its", label: "Back on TOTP", script: "Back on Top of the Pops, it's", category: "returning", usage: "For a returning act." },
  { id: "returning-studio-its", label: "Returning to studio", script: "Returning to the studio, it's", category: "returning", usage: "Alternative returning-act link." },
  { id: "still-riding-high-its", label: "Still riding high", script: "Still riding high this week, it's", category: "returning", usage: "For an act holding a strong chart position." },

  { id: "straight-top-ten-its", label: "Straight into Top Ten", script: "Straight into the Top Ten, it's", category: "top_ten", usage: "New entry directly inside the Top Ten." },
  { id: "top-ten-this-week-its", label: "Top Ten this week", script: "In the Top Ten this week, it's", category: "top_ten", usage: "Generic Top Ten introduction." },

  { id: "number-one-its", label: "Number one", script: "At number one, it's", category: "number_one", usage: "Use before the recorded band name for the chart topper." },
  { id: "still-number-one-its", label: "Still number one", script: "Still at number one, it's", category: "number_one", usage: "For a non-mover at number one." },

  { id: "one-more-time-for", label: "One more time", script: "One more time for", category: "continuity", usage: "Post-performance crowd link." },
  { id: "make-some-noise-for", label: "Make some noise", script: "Make some noise for", category: "continuity", usage: "High-energy crowd cue." },
  { id: "give-it-up-for", label: "Give it up", script: "Give it up for", category: "continuity", usage: "Post-performance or introduction cue." },
];

export function totpReusablePresenterPhrase(id: string): TotpReusablePresenterPhrase | undefined {
  return TOTP_REUSABLE_PRESENTER_PHRASES.find((phrase) => phrase.id === id);
}

/**
 * Matches an already-authored presenter line back to a reusable phrase.
 * The database remains authoritative for the actual wording; this only
 * identifies whether its prefix can be assembled from the reusable phrase
 * library plus the current recorded band name.
 */
export function matchTotpReusablePresenterPhrase(
  script: string,
  bandName: string,
): TotpReusablePresenterPhrase | null {
  const normalizedScript = script.replace(/\s+/g, " ").trim();
  const normalizedBand = bandName.replace(/\s+/g, " ").trim();
  if (!normalizedScript || !normalizedBand) return null;

  const suffixes = [
    ` ${normalizedBand}!`,
    ` ${normalizedBand}.`,
    ` ${normalizedBand}`,
  ];

  const prefix = suffixes
    .filter((suffix) => normalizedScript.endsWith(suffix))
    .map((suffix) => normalizedScript.slice(0, -suffix.length).trim())
    .find(Boolean);

  if (!prefix) return null;
  return TOTP_REUSABLE_PRESENTER_PHRASES.find(
    (phrase) => phrase.script.replace(/\s+/g, " ").trim() === prefix,
  ) ?? null;
}


export interface TotpPresenterPhraseContext {
  rank: number;
  stableKey: string;
  isNewEntry?: boolean;
  isDebut?: boolean;
  chartMovement?: number | null;
  isReturning?: boolean;
}

function stablePhraseIndex(key: string, length: number): number {
  if (length <= 1) return 0;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % length;
}

function choosePhrase(ids: string[], stableKey: string): TotpReusablePresenterPhrase {
  const choices = ids
    .map(totpReusablePresenterPhrase)
    .filter((phrase): phrase is TotpReusablePresenterPhrase => Boolean(phrase));
  if (!choices.length) {
    const fallback = totpReusablePresenterPhrase("please-welcome");
    if (!fallback) throw new Error("Reusable presenter phrase catalogue is missing its fallback.");
    return fallback;
  }
  return choices[stablePhraseIndex(stableKey, choices.length)];
}

/**
 * Picks a reusable intro deterministically so every viewer and render worker
 * gets the same presenter wording for the same performance.
 *
 * Context-specific phrases are only used when the caller actually knows the
 * chart state. Otherwise selection falls back to wording that is always true.
 */
export function selectTotpReusablePresenterPhrase(
  context: TotpPresenterPhraseContext,
): TotpReusablePresenterPhrase {
  const rank = Math.max(1, Math.min(40, Math.round(context.rank)));
  const key = `${context.stableKey}:${rank}`;

  if (context.isDebut) {
    return choosePhrase(["debut-its"], key);
  }

  if (context.isNewEntry) {
    if (rank <= 10) {
      return choosePhrase(["straight-top-ten-its", "latest-entry-from", "brand-new-entry-from"], key);
    }
    return choosePhrase(["latest-entry-from", "brand-new-entry-from"], key);
  }

  const movement = Number(context.chartMovement ?? 0);
  if (movement >= 10) {
    return choosePhrase(["biggest-movers-its", "climbing-chart-its"], key);
  }
  if (movement > 0) {
    return choosePhrase(["climbing-chart-its", "moving-up-its"], key);
  }

  if (context.isReturning) {
    return choosePhrase(["back-on-totp-its", "returning-studio-its"], key);
  }

  if (rank === 1) {
    return choosePhrase(["number-one-its"], key);
  }

  if (rank <= 10) {
    return choosePhrase(["top-ten-this-week-its", "up-next-its", "and-now-its", "please-welcome"], key);
  }

  return choosePhrase([
    "please-welcome",
    "up-next-its",
    "and-now-its",
    "time-for",
    "another-hit-from",
    "studio-ready-for",
  ], key);
}

export function buildTotpReusablePresenterIntro(
  bandName: string,
  context: TotpPresenterPhraseContext,
): { phrase: TotpReusablePresenterPhrase; script: string } {
  const phrase = selectTotpReusablePresenterPhrase(context);
  return {
    phrase,
    script: `${phrase.script} ${bandName.trim()}!`,
  };
}
