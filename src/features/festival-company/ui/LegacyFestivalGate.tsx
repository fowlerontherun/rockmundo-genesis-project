import { ReactNode } from "react";
import { useFestivalFeatureFlags } from "../config/featureFlags";
import { FestivalRebuildingScreen } from "./FestivalRebuildingScreen";

interface Props {
  children: ReactNode;
  area?: string;
}

/**
 * Wrap any legacy festival route with this gate.
 * When `legacyFestivalSystemEnabled` is false, users see the rebuilding
 * screen instead of the legacy page. No redirects, no blank screens.
 */
export function LegacyFestivalGate({ children, area }: Props) {
  const { legacyFestivalSystemEnabled } = useFestivalFeatureFlags();
  if (!legacyFestivalSystemEnabled) {
    return <FestivalRebuildingScreen area={area} />;
  }
  return <>{children}</>;
}

export default LegacyFestivalGate;
