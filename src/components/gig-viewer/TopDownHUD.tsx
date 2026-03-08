import { Badge } from "@/components/ui/badge";
import { Music, Users, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface TopDownHUDProps {
  songTitle: string;
  songIndex: number;
  totalSongs: number;
  crowdMood: string;
  attendancePercent: number;
  venueName: string;
  attendance: number;
  venueCapacity: number;
  isLive: boolean;
}

const moodConfig: Record<string, { label: string; color: string }> = {
  ecstatic: { label: '🔥 Ecstatic', color: 'text-orange-400' },
  enthusiastic: { label: '🎉 Hyped', color: 'text-green-400' },
  engaged: { label: '👍 Engaged', color: 'text-blue-400' },
  mixed: { label: '😐 Mixed', color: 'text-yellow-400' },
  disappointed: { label: '😞 Flat', color: 'text-red-400' },
};

export const TopDownHUD = ({
  songTitle,
  songIndex,
  totalSongs,
  crowdMood,
  attendancePercent,
  venueName,
  attendance,
  venueCapacity,
  isLive,
}: TopDownHUDProps) => {
  const [minimized, setMinimized] = useState(false);
  const mood = moodConfig[crowdMood] || moodConfig.engaged;

  return (
    <div className="absolute top-2 left-2 right-2 z-20">
      <div
        className="bg-black/80 backdrop-blur-sm rounded-lg border border-primary/20 px-3 py-2 cursor-pointer select-none"
        onClick={() => setMinimized(!minimized)}
      >
        {/* Header row - always visible */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Music className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-white font-medium truncate">
              {songTitle || 'Waiting...'}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              ({songIndex + 1}/{totalSongs})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLive && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 animate-pulse bg-red-600 hover:bg-red-600">
                LIVE
              </Badge>
            )}
            {minimized ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded details */}
        {!minimized && (
          <div className="flex items-center gap-4 mt-1.5 text-[11px] flex-wrap">
            <span className={mood.color}>{mood.label}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" />
              {attendance}/{venueCapacity} ({attendancePercent}%)
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {venueName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
