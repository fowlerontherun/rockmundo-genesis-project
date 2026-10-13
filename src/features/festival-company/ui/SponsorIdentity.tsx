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
  const secureUrl = logoReference && /^https:\/\//i.test(logoReference)
    ? logoReference
    : null;

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
