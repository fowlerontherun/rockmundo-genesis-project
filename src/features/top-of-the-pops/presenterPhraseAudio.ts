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
  { id: "here-we-go-with", label: "Here we go", script: "Here we go with", category: "general", usage: "Upbeat neutral introduction." },
  { id: "coming-live-from", label: "Coming live", script: "Coming live from our studio, it's", category: "general", usage: "Television-style live handoff." },
  { id: "take-it-away", label: "Take it away", script: "Take it away", category: "general", usage: "Very short introduction before the band name." },
  { id: "next-on-stage", label: "Next on stage", script: "Next on stage, it's", category: "general", usage: "Stage-change introduction." },
  { id: "welcome-back", label: "Welcome back", script: "Welcome back", category: "general", usage: "Friendly returning-act introduction." },
  { id: "crowd-ready-for", label: "Crowd ready", script: "The crowd are ready for", category: "general", usage: "Audience-led introduction." },
  { id: "live-tonight", label: "Live tonight", script: "Live tonight, it's", category: "general", usage: "Simple live-show introduction." },

  { id: "latest-entry-from", label: "Latest entry", script: "Here's the latest entry from", category: "new_entry", usage: "For a new chart entry." },
  { id: "brand-new-entry-from", label: "Brand-new entry", script: "A brand-new chart entry from", category: "new_entry", usage: "Alternative new-entry line." },
  { id: "new-this-week", label: "New this week", script: "New to the chart this week, it's", category: "new_entry", usage: "New-entry alternative." },
  { id: "first-time-charting", label: "First chart appearance", script: "Making their first chart appearance, it's", category: "new_entry", usage: "First chart appearance." },
  { id: "fresh-into-chart", label: "Fresh into chart", script: "Fresh into the chart this week, it's", category: "new_entry", usage: "Energetic new-entry line." },
  { id: "debut-its", label: "TOTP debut", script: "Making their Top of the Pops debut, it's", category: "new_entry", usage: "First-ever Top of the Pops appearance." },

  { id: "climbing-chart-its", label: "Climbing the chart", script: "Climbing the chart this week, it's", category: "climber", usage: "For an act moving upward." },
  { id: "biggest-movers-its", label: "Biggest mover", script: "One of this week's biggest movers, it's", category: "climber", usage: "For a large week-on-week rise." },
  { id: "moving-up-its", label: "Moving up", script: "Moving up this week, it's", category: "climber", usage: "Short upward-movement cue." },
  { id: "still-climbing", label: "Still climbing", script: "Still climbing the chart, it's", category: "climber", usage: "Repeat-climber variation." },
  { id: "charging-up-chart", label: "Charging upward", script: "Charging up the chart this week, it's", category: "climber", usage: "High-energy chart climb." },
  { id: "on-the-rise", label: "On the rise", script: "On the rise this week, it's", category: "climber", usage: "Compact climb introduction." },

  { id: "back-on-totp-its", label: "Back on TOTP", script: "Back on Top of the Pops, it's", category: "returning", usage: "For a returning act." },
  { id: "returning-studio-its", label: "Returning to studio", script: "Returning to the studio, it's", category: "returning", usage: "Alternative returning-act link." },
  { id: "still-riding-high-its", label: "Still riding high", script: "Still riding high this week, it's", category: "returning", usage: "For an act holding a strong chart position." },
  { id: "back-again", label: "Back again", script: "Back again this week, it's", category: "returning", usage: "Short returning-act line." },
  { id: "another-week-for", label: "Another week", script: "Another week on the show for", category: "returning", usage: "Repeat appearance variation." },
  { id: "welcome-back-to-stage", label: "Welcome back to stage", script: "Welcome back to the Top of the Pops stage", category: "returning", usage: "Warm return introduction." },

  { id: "straight-top-ten-its", label: "Straight into Top Ten", script: "Straight into the Top Ten, it's", category: "top_ten", usage: "New entry directly inside the Top Ten." },
  { id: "top-ten-this-week-its", label: "Top Ten this week", script: "In the Top Ten this week, it's", category: "top_ten", usage: "Generic Top Ten introduction." },
  { id: "inside-top-ten", label: "Inside Top Ten", script: "Inside the Top Ten tonight, it's", category: "top_ten", usage: "Top Ten variation." },
  { id: "one-of-biggest", label: "One of the biggest", script: "One of the biggest records in the country, from", category: "top_ten", usage: "Strong chart-position variation." },
  { id: "top-ten-hit-from", label: "Top Ten hit", script: "Here's a Top Ten hit from", category: "top_ten", usage: "Top Ten band-led cue." },

  { id: "number-one-its", label: "Number one", script: "At number one, it's", category: "number_one", usage: "Use before the recorded band name for the chart topper." },
  { id: "still-number-one-its", label: "Still number one", script: "Still at number one, it's", category: "number_one", usage: "For a non-mover at number one." },
  { id: "top-of-chart", label: "Top of chart", script: "Right at the top of the chart, it's", category: "number_one", usage: "Number-one variation." },
  { id: "country-number-one", label: "Country's number one", script: "The country's number one act this week is", category: "number_one", usage: "Number-one announcement." },
  { id: "number-one-again", label: "Number one again", script: "Number one again this week, it's", category: "number_one", usage: "Repeat chart-topper variation." },

  { id: "one-more-time-for", label: "One more time", script: "One more time for", category: "continuity", usage: "Post-performance crowd link." },
  { id: "make-some-noise-for", label: "Make some noise", script: "Make some noise for", category: "continuity", usage: "High-energy crowd cue." },
  { id: "give-it-up-for", label: "Give it up", script: "Give it up for", category: "continuity", usage: "Post-performance or introduction cue." },
  { id: "what-a-performance-from", label: "What a performance", script: "What a performance from", category: "continuity", usage: "Post-performance reaction." },
  { id: "another-big-hand-for", label: "Big hand", script: "Another big hand for", category: "continuity", usage: "Applause-led post-performance link." },
  { id: "hear-it-for", label: "Let's hear it", script: "Let's hear it for", category: "continuity", usage: "Classic crowd response line." },
  { id: "that-was", label: "That was", script: "That was", category: "continuity", usage: "Short post-performance band-name link." },
  { id: "fantastic-stuff-from", label: "Fantastic stuff", script: "Fantastic stuff from", category: "continuity", usage: "High-energy post-performance line." },
  { id: "stay-with-us-after", label: "Stay with us", script: "Stay with us after", category: "continuity", usage: "Bridge into the next programme beat." },
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
    return choosePhrase(["debut-its", "first-time-charting", "new-this-week"], key);
  }

  if (context.isNewEntry) {
    if (rank <= 10) {
      return choosePhrase(["straight-top-ten-its", "latest-entry-from", "brand-new-entry-from", "new-this-week", "fresh-into-chart"], key);
    }
    return choosePhrase(["latest-entry-from", "brand-new-entry-from", "new-this-week", "fresh-into-chart"], key);
  }

  const movement = Number(context.chartMovement ?? 0);
  if (movement >= 10) {
    return choosePhrase(["biggest-movers-its", "climbing-chart-its", "charging-up-chart", "still-climbing"], key);
  }
  if (movement > 0) {
    return choosePhrase(["climbing-chart-its", "moving-up-its", "still-climbing", "on-the-rise"], key);
  }

  if (context.isReturning) {
    return choosePhrase(["back-on-totp-its", "returning-studio-its", "back-again", "another-week-for", "welcome-back-to-stage"], key);
  }

  if (rank === 1) {
    return choosePhrase(["number-one-its", "top-of-chart", "country-number-one", "number-one-again"], key);
  }

  if (rank <= 10) {
    return choosePhrase(["top-ten-this-week-its", "inside-top-ten", "one-of-biggest", "top-ten-hit-from", "up-next-its", "and-now-its", "please-welcome"], key);
  }

  return choosePhrase([
    "please-welcome",
    "up-next-its",
    "and-now-its",
    "time-for",
    "another-hit-from",
    "studio-ready-for",
    "here-we-go-with",
    "coming-live-from",
    "take-it-away",
    "next-on-stage",
    "crowd-ready-for",
    "live-tonight",
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
