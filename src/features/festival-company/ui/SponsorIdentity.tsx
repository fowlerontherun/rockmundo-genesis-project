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

/**
 * A failed logo should only hide the *failed URL*. When an organiser corrects
 * the asset, React reuses the same sponsor card and must retry the new URL.
 */
export function SponsorIdentity({
  name,
  logoReference,
}: {
  name: string;
  logoReference: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const secureUrl = logoReference && isSafeSponsorLogoReference(logoReference)
    ? logoReference : null;

  return (
    <div className="flex min-h-16 items-center justify-center rounded-lg border bg-background p-3">
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
