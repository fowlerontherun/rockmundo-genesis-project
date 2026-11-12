export const SURVEY_REWARD = { xp: 1000, ap: 50 };
export const SURVEY_TEXT_LIMIT = 2000;

export const SURVEY_CATEGORY_LABELS: Record<string, string> = {
  player_context: "About Your Play",
  priorities: "Improvement Priorities",
  gameplay: "Gameplay",
  music: "Music & Production",
  social: "Social & Community",
  economy: "Economy & Balance",
  ui: "UI & Experience",
  content: "Content",
  performance: "Performance & Reliability",
  progression: "Progression",
  onboarding: "Getting Started",
  live_events: "Gigs, Tours & Festivals",
  mobile: "Mobile Experience",
  accessibility: "Accessibility",
  releases: "Music Releases",
  bands: "Bands & Collaboration",
  city_life: "City Life",
};

export type SurveyAnswers = Record<string, string | null>;

export function canSkipSurveyQuestion(category: string, questionType: string) {
  return questionType === "free_text" || (category !== "player_context" && category !== "priorities");
}
