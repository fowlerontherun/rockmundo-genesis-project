export const REFERRAL_SHARE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const ROCKMUNDO_PUBLIC_ORIGIN = "https://rockmundo.uk";

export function buildReferralUrl(code: string, params: Record<string, string | undefined> = {}) {
  const url = new URL("/auth", ROCKMUNDO_PUBLIC_ORIGIN);
  url.searchParams.set("ref", code.trim().toUpperCase());
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

export function referralShareOnCooldown(key: string, now = Date.now()) {
  try {
    if (typeof localStorage === "undefined") return false;
    const last = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(last) && last > 0 && now - last < REFERRAL_SHARE_COOLDOWN_MS;
  } catch { return false; }
}

function markShareCooldown(key?: string) {
  if (!key) return;
  try { localStorage.setItem(key, String(Date.now())); } catch { /* Sharing must succeed even if storage is unavailable. */ }
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
      markShareCooldown(cooldownKey);
      return "shared";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  try {
    if (!navigator.clipboard?.writeText) return "failed";
    await navigator.clipboard.writeText(`${text} ${url}`);
    markShareCooldown(cooldownKey);
    return "copied";
  } catch {
    return "failed";
  }
}
