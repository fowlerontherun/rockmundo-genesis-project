import { Activity, Users } from "lucide-react";

import { cn } from "@/lib/utils";

interface PlayerCommunityStatsProps {
  registeredPlayers: number | null;
  registeredLoading?: boolean;
  registeredError?: string | null;
  livePlayers: number;
  livePlayersConnected?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ICON_SIZES: Record<NonNullable<PlayerCommunityStatsProps["size"]>, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

const textSizeMap: Record<NonNullable<PlayerCommunityStatsProps["size"]>, string> = {
  sm: "text-[0.65rem] sm:text-xs",
  md: "text-xs sm:text-sm",
  lg: "text-sm sm:text-base",
};

const PlayerCommunityStats = ({
  registeredPlayers,
  registeredLoading = false,
  registeredError = null,
  livePlayers,
  livePlayersConnected = false,
  size = "md",
  className,
}: PlayerCommunityStatsProps) => {
  const iconSize = ICON_SIZES[size];
  const textSizing = textSizeMap[size];

  const registeredDisplay = registeredLoading && registeredPlayers === null
    ? "..."
    : registeredPlayers !== null
      ? registeredPlayers.toLocaleString()
      : "—";

  const liveDisplay = livePlayersConnected
    ? livePlayers.toLocaleString()
    : "…";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 sm:gap-4 font-oswald tracking-wide uppercase",
        textSizing,
        className,
      )}
    >
      <span className="flex items-center gap-1.5" title={registeredError ?? undefined}>
        <Users style={{ width: iconSize, height: iconSize }} className="opacity-80" />
        <span className="opacity-80">Registered</span>
        <span className="font-semibold tracking-widest">{registeredDisplay}</span>
      </span>
      <span className="hidden sm:inline-block opacity-50">•</span>
      <span className="flex items-center gap-1.5">
        <Activity style={{ width: iconSize, height: iconSize }} className="opacity-80" />
        <span className="opacity-80">Live</span>
        <span className="font-semibold tracking-widest">{liveDisplay}</span>
      </span>
    </div>
  );
};

export default PlayerCommunityStats;
