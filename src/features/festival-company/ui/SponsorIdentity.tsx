import { useState } from "react";

/** Public/admin logo gate. Approval and licensing still require human review.
 * Allow same-origin paths, HTTPS and the canonical seeded base64 monograms;
 * reject executable, insecure, protocol-relative and credentialed URLs. */
export function isSafeSponsorLogoReference(reference: string): boolean {
  if (!reference || reference !== reference.trim()) return false;
  if (/^\/(?!\/)[^\\\s]*$/.test(reference)) return true;
  if (/^data:image\/(?:svg\+xml|png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(reference)) return true;
  try {
    const url = new URL(reference);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password &&
      !/[\s\\]/.test(reference);
  } catch {
    return false;
  }
}

/** A seeded SVG data logo is a useful fallback, not approved brand artwork.
 * Keep it visible while flagging it for the administrator to replace. */
export function sponsorLogoNeedsArtworkReview(reference: string | null | undefined): boolean {
  return !reference || !isSafeSponsorLogoReference(reference) ||
    /^data:image\/svg\+xml;base64,/i.test(reference);
}

/**
 * A failed logo should only hide the *failed URL*. When an organiser corrects
 * the asset, React reuses the same sponsor card and must retry the new URL.
 */
export function SponsorIdentity({
  name,
  logoReference,
  previewTheme,
}: {
  name: string;
  logoReference: string | null;
  previewTheme?: "light" | "dark";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const secureUrl = logoReference && isSafeSponsorLogoReference(logoReference)
    ? logoReference : null;

  return (
    <div className={`flex min-h-16 items-center justify-center rounded-lg border p-3 ${
      previewTheme === "light" ? "bg-white text-slate-900" :
      previewTheme === "dark" ? "bg-slate-950 text-slate-100" : "bg-background"
    }`}>
      {secureUrl && failedUrl !== secureUrl ? (
        <img
          src={secureUrl}
          alt={`${name} logo`}
          loading="lazy"
          className="max-h-16 max-w-full object-contain"
          onError={() => setFailedUrl(secureUrl)}
        />
      ) : (
        <span className="text-center text-lg font-bold">{name}</span>
      )}
    </div>
  );
}
