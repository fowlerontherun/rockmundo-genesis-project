import { useEffect, useState } from "react";
import { getFestivalBranding } from "../data/festivalBrandingRepository";
import { defaultFestivalBranding, type FestivalBranding } from "../domain/festivalBranding";

/** Optional cosmetic lookup: old editions and failed reads retain the original artwork. */
export function useFestivalArtworkBranding(editionId?: string | null) {
  const [saved, setSaved] = useState<{ editionId: string; value: FestivalBranding } | null>(null);
  useEffect(() => {
    let active = true;
    if (editionId) void getFestivalBranding(editionId).then(value => {
      if (active) setSaved({ editionId, value });
    }).catch(() => { if (active) setSaved(null); });
    return () => { active = false; };
  }, [editionId]);
  return saved && saved.editionId === editionId ? saved.value : defaultFestivalBranding;
}