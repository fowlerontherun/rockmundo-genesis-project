import { trackShareAnalyticsEvent } from "./analytics";

const DAY = 24 * 60 * 60 * 1000;

export type SharePromptTier = "exceptional" | "significant";

export function sharePromptKey(kind: string, sourceId: string) {
  return `rockmundo_share_prompt:${kind}:${sourceId}`;
}

export function shouldOfferSharePrompt(kind: string, sourceId: string, tier: SharePromptTier = "exceptional", now = Date.now()) {
  if (typeof localStorage === "undefined") return true;
  const last = Number(localStorage.getItem(sharePromptKey(kind, sourceId)) || 0);
  const cooldown = tier === "exceptional" ? 30 * DAY : 7 * DAY;
  return !last || now - last >= cooldown;
}

export function markSharePromptSeen(kind: string, sourceId: string, now = Date.now()) {
  if (typeof localStorage !== "undefined") localStorage.setItem(sharePromptKey(kind, sourceId), String(now));
  trackShareAnalyticsEvent("share_prompt_viewed", { momentType: kind, channel: "prompt" });
}
