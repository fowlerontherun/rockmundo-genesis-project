/** Master switch for Christmas cosmetics. Set to false to turn decorations off everywhere. */
export const CHRISTMAS_DECORATIONS_ENABLED = true;
/** Decorations show automatically only inside this window (UK time; end exclusive). */
export const CHRISTMAS_STARTS_AT = "2026-11-20T00:00:00Z";
export const CHRISTMAS_ENDS_AT = "2027-01-07T00:00:00Z";
export const CHRISTMAS_OPT_OUT_KEY = "rockmundo:christmas-decorations-off";

export function isChristmasSeason(at: Date = new Date(), enabled = CHRISTMAS_DECORATIONS_ENABLED): boolean {
  if (!enabled) return false;
  const t = at.getTime();
  return t >= Date.parse(CHRISTMAS_STARTS_AT) && t < Date.parse(CHRISTMAS_ENDS_AT);
}
