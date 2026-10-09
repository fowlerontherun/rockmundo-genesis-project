/** Phase 2 skill quest catalogue.
 * Objective tracking is advisory until server-authoritative event ingestion is enabled.
 * Never award XP or claim quest completion from client events.
 */
export type SkillQuestEventType = "gig_completed" | "songwriting_completed" | "recording_completed" | "instrument_crafted";

export interface SkillQuestDefinition {
  id: string;
  title: string;
  description: string;
  eventType: SkillQuestEventType;
  target: number;
  rewardStatus: "not_configured";
  destination: string;
}

export const SKILL_QUEST_DEFINITIONS: readonly SkillQuestDefinition[] = [
  { id: "first_live_show", title: "Take the stage", description: "Complete a live gig.", eventType: "gig_completed", target: 1, rewardStatus: "not_configured", destination: "/gigs" },
  { id: "first_finished_song", title: "Finish a song", description: "Complete a songwriting project.", eventType: "songwriting_completed", target: 1, rewardStatus: "not_configured", destination: "/songwriting" },
  { id: "first_recording", title: "Record your music", description: "Complete a recording session.", eventType: "recording_completed", target: 1, rewardStatus: "not_configured", destination: "/recording" },
  { id: "first_crafted_instrument", title: "Build an instrument", description: "Finish crafting an instrument.", eventType: "instrument_crafted", target: 1, rewardStatus: "not_configured", destination: "/career/luthier" },
];

export function validateSkillQuestDefinitions(definitions: readonly SkillQuestDefinition[]): boolean {
  const ids = new Set<string>();
  return definitions.every((quest) => {
    if (!quest.id || ids.has(quest.id) || !Number.isSafeInteger(quest.target) || quest.target <= 0 || !quest.destination.startsWith("/")) return false;
    ids.add(quest.id);
    return true;
  });
}
