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
