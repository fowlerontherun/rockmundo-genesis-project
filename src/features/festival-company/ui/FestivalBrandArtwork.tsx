import { useState } from "react";
import type { FestivalPublicConfirmedAct, FestivalPublicEdition } from "../domain/festivalLaunch";
import { festivalVisualIdentity } from "../domain/festivalVisualIdentity";
import { isSafeSponsorLogoReference } from "./SponsorIdentity";
import { useFestivalArtworkBranding } from "./useFestivalArtworkBranding";

type FestivalBrandArtworkProps = {
  festival: Pick<FestivalPublicEdition, "id" | "name" | "festivalType" | "vibe" | "scale" | "heroImageReference"> & { editionId?: string | null };
  variant?: "card" | "backdrop";
};

/** An organiser's approved-looking URL is only treated as artwork, never as trustworthy data.
 * Invalid and failed URLs fall back to a repeatable, edition-specific procedural poster. */
export function FestivalBrandArtwork({ festival, variant = "card" }: FestivalBrandArtworkProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { palette, motif, typeLabel, vibeLabel, scaleLabel } = festivalVisualIdentity(festival);
  const branding = useFestivalArtworkBranding(festival.editionId);
  const imageUrl = festival.heroImageReference && isSafeSponsorLogoReference(festival.heroImageReference)
    ? festival.heroImageReference : null;
  const backdrop = variant === "backdrop";

  return (
    <div
      aria-hidden="true"
      className={`relative isolate overflow-hidden ${branding.theme ? `festival-theme-${branding.theme} festival-theme-art festival-motif-${branding.motif}` : ""} ${backdrop ? "absolute inset-0" : "h-44"}`}
      style={branding.theme ? undefined : { background: `radial-gradient(ellipse at ${motif === 1 ? "80% 15%" : "15% 25%"}, ${palette.mid} 0%, transparent 65%), linear-gradient(125deg, ${palette.dark} 12%, ${palette.mid} 100%)` }}
    >
      {!branding.theme && <>
        <div className="absolute -left-12 -top-16 h-60 w-60 rotate-12 rounded-full border-[24px] opacity-45" style={{ borderColor: palette.light }} />
        <div className="absolute -bottom-28 right-2 h-56 w-56 rotate-45 border-[22px] opacity-50" style={{ borderColor: palette.accent, borderRadius: motif === 2 ? "12%" : "50%" }} />
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: `repeating-linear-gradient(${motif === 0 ? 120 : 50}deg, transparent 0px, transparent 27px, ${palette.light}33 28px, transparent 30px)` }} />
      </>}
      {imageUrl && imageUrl !== failedUrl && <img
        src={imageUrl}
        alt=""
        loading={backdrop ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setFailedUrl(imageUrl)}
      />}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/10" />
      {!backdrop && <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[.24em]">{typeLabel}{scaleLabel ? ` · ${scaleLabel}` : ""}</p>
        <p className="line-clamp-2 text-2xl font-black leading-tight drop-shadow-md">{festival.name}</p>
        {vibeLabel && <p className="mt-1 text-xs uppercase tracking-wider text-white/85">{vibeLabel}</p>}
      </div>}
    </div>
  );
}

/** Artist-name artwork is deliberately typographic: it does not pretend to be an
 * approved artist photograph or a live-performance snapshot. */
export function FestivalLineupRibbon({ act }: { act: FestivalPublicConfirmedAct }) {
  const { palette, motif } = festivalVisualIdentity({
    id: act.id, festivalType: act.genre, vibe: act.artistType, scale: act.billingPosition,
  });
  return (
    <div aria-hidden="true" className="relative flex min-h-24 items-center overflow-hidden px-5 py-4 text-white"
      style={{ background: `linear-gradient(${motif === 1 ? "115deg" : "145deg"}, ${palette.dark}, ${palette.mid})` }}>
      <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full border-[16px] opacity-50" style={{ borderColor: palette.light }} />
      <div className="relative min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-[.22em]">{act.billingPosition === "headliner" ? "Headline act" : "Confirmed line-up"}</span>
        <p className="mt-1 break-words text-2xl font-black leading-tight drop-shadow">{act.artistName}</p>
        {act.genre && <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/80">{act.genre}</p>}
      </div>
    </div>
  );
}
