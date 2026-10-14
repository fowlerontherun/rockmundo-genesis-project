import { useState } from "react";

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
  // Canonical fictional brand fallbacks use base64 SVG data URLs. Accept
  // only a small set of image MIME types; never allow arbitrary data, JS,
  // HTTP or protocol-relative URLs in a public <img>.
  const isSafeImage = (url: string) =>
    /^https:\/\//i.test(url) ||
    (/^\/(?!\/)[^\\\s]*$/.test(url)) ||
    /^data:image\/(?:svg\+xml|png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(url);
  const secureUrl = logoReference && isSafeImage(logoReference) ? logoReference : null;

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
