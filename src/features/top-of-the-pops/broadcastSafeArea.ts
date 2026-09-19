/**
 * Broadcast-safe framing for the Top of the Pops programme output.
 *
 * The programme master is authored at 1920x1080. Overlay graphics must stay
 * inside the action-safe box (93%) and readable text inside the title-safe box
 * (90%) so that the same overlays remain compliant once episodes are exported
 * and published rather than only viewed in-app.
 */
export const TOTP_PROGRAMME_FRAME = Object.freeze({ width: 1920, height: 1080 });

export type TotpSafeAreaKind = "action" | "title";

export interface TotpSafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const SAFE_AREA_RATIO: Record<TotpSafeAreaKind, number> = { action: 0.93, title: 0.9 };

export function totpSafeAreaInsets(kind: TotpSafeAreaKind, frame = TOTP_PROGRAMME_FRAME): TotpSafeAreaInsets {
  const ratio = SAFE_AREA_RATIO[kind];
  const horizontal = Math.round((frame.width * (1 - ratio)) / 2);
  const vertical = Math.round((frame.height * (1 - ratio)) / 2);
  return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
}

/** Percentage insets, so the same numbers work for any preview size. */
export function totpSafeAreaPercent(kind: TotpSafeAreaKind): TotpSafeAreaInsets {
  const ratio = SAFE_AREA_RATIO[kind];
  const inset = Number((((1 - ratio) / 2) * 100).toFixed(3));
  return { top: inset, right: inset, bottom: inset, left: inset };
}

export function totpSafeAreaStyle(kind: TotpSafeAreaKind): Record<string, string> {
  const insets = totpSafeAreaPercent(kind);
  return {
    top: `${insets.top}%`,
    right: `${insets.right}%`,
    bottom: `${insets.bottom}%`,
    left: `${insets.left}%`,
  };
}

export interface TotpOverlayBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True when an overlay box sits fully inside the requested safe area. */
export function isWithinTotpSafeArea(box: TotpOverlayBox, kind: TotpSafeAreaKind, frame = TOTP_PROGRAMME_FRAME): boolean {
  const insets = totpSafeAreaInsets(kind, frame);
  return (
    box.x >= insets.left &&
    box.y >= insets.top &&
    box.x + box.width <= frame.width - insets.right &&
    box.y + box.height <= frame.height - insets.bottom
  );
}
