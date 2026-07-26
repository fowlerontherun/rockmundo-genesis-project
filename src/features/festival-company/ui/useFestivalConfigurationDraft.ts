import { useEffect, useMemo, useRef, useState } from "react";
import {
  configurationToDraft,
  draftsEqual,
  type FestivalConfiguration,
  type FestivalConfigurationDraft,
} from "../domain/festivalConfiguration";

export function useFestivalConfigurationDraft(
  configuration?: FestivalConfiguration,
) {
  const [draft, setDraft] = useState<FestivalConfigurationDraft | null>(null);
  const [savedDraft, setSavedDraft] =
    useState<FestivalConfigurationDraft | null>(null);
  const version = useRef(1);
  // Synchronisation is intentionally keyed only to a new server configuration;
  // adding savedDraft would overwrite local edits during the state transition.
  useEffect(() => {
    if (!configuration) return;
    const canonical = configurationToDraft(configuration);
    version.current = configuration.configurationVersion;
    setSavedDraft(canonical);
    setDraft((current) =>
      current && savedDraft && !draftsEqual(current, savedDraft)
        ? current
        : canonical,
    );
    // savedDraft is deliberately excluded: only a new canonical response should synchronise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuration]);
  const dirty = useMemo(
    () => Boolean(draft && savedDraft && !draftsEqual(draft, savedDraft)),
    [draft, savedDraft],
  );
  const acceptCanonical = (canonical: FestivalConfiguration) => {
    const next = configurationToDraft(canonical);
    version.current = canonical.configurationVersion;
    setSavedDraft(next);
    setDraft(next);
  };
  return { draft, setDraft, dirty, version, acceptCanonical };
}
