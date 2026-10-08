export const REFERRAL_SHARE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function buildReferralUrl(code: string, params: Record<string, string | undefined> = {}) {
  const origin = typeof window === "undefined" ? "https://rockmundo.uk" : window.location.origin;
  const url = new URL("/auth", origin);
  url.searchParams.set("ref", code.trim().toUpperCase());
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

export function referralShareOnCooldown(key: string, now = Date.now()) {
  if (typeof localStorage === "undefined") return false;
  const last = Number(localStorage.getItem(key) || 0);
  return Number.isFinite(last) && last > 0 && now - last < REFERRAL_SHARE_COOLDOWN_MS;
}

export type ReferralShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareReferral({
  title,
  text,
  url,
  cooldownKey,
}: {
  title: string;
  text: string;
  url: string;
  cooldownKey?: string;
}): Promise<ReferralShareResult> {
  if (cooldownKey && referralShareOnCooldown(cooldownKey)) return "cancelled";

  if (typeof navigator === "undefined") return "failed";
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      if (cooldownKey && typeof localStorage !== "undefined") localStorage.setItem(cooldownKey, String(Date.now()));
      return "shared";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  try {
    if (!navigator.clipboard?.writeText) return "failed";
    await navigator.clipboard.writeText(`${text} ${url}`);
    if (cooldownKey) localStorage.setItem(cooldownKey, String(Date.now()));
    return "copied";
  } catch {
    return "failed";
  }
}
