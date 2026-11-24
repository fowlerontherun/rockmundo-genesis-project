export type RoomMessageKind = "say" | "me" | "ooc" | "system";
export type InteractionKind = "buy_drink" | "compliment" | "insult" | "flirt" | "offer_jam" | "challenge";

/** Turn typed chat into a message type: "/me waves" = action, "/ooc hi" or "((hi))" = out of character. */
export function parseChatInput(raw: string, mode: "say" | "me" | "ooc" = "say"): { kind: Exclude<RoomMessageKind, "system">; body: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const me = text.match(/^\/me\s+([\s\S]+)$/i);
  if (me) return { kind: "me", body: me[1].trim().slice(0, 500) };
  const ooc = text.match(/^\/ooc\s+([\s\S]+)$/i) ?? text.match(/^\(\(([\s\S]+)\)\)$/);
  if (ooc) return { kind: "ooc", body: ooc[1].trim().slice(0, 500) };
  return { kind: mode, body: text.slice(0, 500) };
}

export const INTERACTIONS: { kind: InteractionKind; label: string; emoji: string; tone: "friendly" | "romance" | "rivalry" | "collab" }[] = [
  { kind: "buy_drink", label: "Buy a drink", emoji: "🍺", tone: "friendly" },
  { kind: "compliment", label: "Compliment", emoji: "👏", tone: "friendly" },
  { kind: "offer_jam", label: "Offer to jam", emoji: "🎸", tone: "collab" },
  { kind: "flirt", label: "Flirt", emoji: "😉", tone: "romance" },
  { kind: "insult", label: "Insult", emoji: "🖕", tone: "rivalry" },
  { kind: "challenge", label: "Challenge", emoji: "⚔️", tone: "rivalry" },
];

export const SOCIAL_XP_PER_INTERACTION = 10;
export const SOCIAL_XP_DAILY_CAP = 100;

const ERRORS: Record<string, string> = {
  slow_down: "Slow down a little before sending again.",
  not_in_room: "You need to be here to talk in this room.",
  cooldown_active: "You've done that to them recently — try again in an hour.",
  target_not_open_romance: "They aren't open to romance roleplay.",
  target_not_open_rivalry: "They aren't open to rivalry roleplay.",
  target_not_open_collab: "They aren't taking collaboration offers.",
  target_not_roleplaying: "They've switched roleplay off.",
  target_unavailable: "That player isn't available.",
  cannot_target_self: "You can't do that to yourself.",
  scene_needs_1_to_5_guests: "Invite between 1 and 5 other players.",
  guest_unavailable: "One of those players can't be invited.",
  character_not_owned: "Switch to your own active character first.",
  scene_ended: "This scene has ended. Open a new scene to continue.",
};
export function friendlyRoleplayError(message: string | undefined): string {
  const key = Object.keys(ERRORS).find((k) => message?.includes(k));
  return key ? ERRORS[key] : "Something went wrong. Please try again.";
}
