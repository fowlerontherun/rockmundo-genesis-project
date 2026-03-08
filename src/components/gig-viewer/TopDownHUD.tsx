import { Badge } from "@/components/ui/badge";
import { Music, Users, MapPin, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

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
  momentum?: number;
  performanceGrade?: string;
  songScores?: { title: string; score: number; played: boolean }[];
}

const moodConfig: Record<string, { label: string; color: string }> = {
  ecstatic: { label: '🔥 Ecstatic', color: 'text-orange-400' },
  enthusiastic: { label: '🎉 Hyped', color: 'text-green-400' },
  engaged: { label: '👍 Engaged', color: 'text-blue-400' },
  mixed: { label: '😐 Mixed', color: 'text-yellow-400' },
  disappointed: { label: '😞 Flat', color: 'text-red-400' },
};

function getGrade(avgScore: number): string {
  if (avgScore >= 22) return 'S';
  if (avgScore >= 19) return 'A';
  if (avgScore >= 15) return 'B';
  if (avgScore >= 11) return 'C';
  return 'D';
}

const gradeColors: Record<string, string> = {
  S: 'text-amber-400',
  A: 'text-green-400',
  B: 'text-blue-400',
  C: 'text-yellow-400',
  D: 'text-red-400',
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
  momentum = 0,
  performanceGrade,
  songScores,
}: TopDownHUDProps) => {
  const [minimized, setMinimized] = useState(false);
  const [showSetlist, setShowSetlist] = useState(false);
  const mood = moodConfig[crowdMood] || moodConfig.engaged;

  const grade = performanceGrade || (songScores && songScores.length > 0
    ? getGrade(songScores.filter(s => s.played).reduce((sum, s) => sum + s.score, 0) / songScores.filter(s => s.played).length)
    : null);

  // Song progress (rough estimation based on index)
  const songProgress = totalSongs > 0 ? ((songIndex + 1) / totalSongs) * 100 : 0;

  return (
    <div className="absolute top-2 left-2 right-2 z-20">
      <div
        className="bg-black/80 backdrop-blur-sm rounded-lg border border-primary/20 px-3 py-2 cursor-pointer select-none"
        onClick={() => setMinimized(!minimized)}
      >
        {/* Header row */}
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
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Performance grade */}
            {grade && (
              <span className={`text-sm font-black ${gradeColors[grade] || 'text-white'}`}>
                {grade}
              </span>
            )}
            {isLive && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 animate-pulse bg-red-600 hover:bg-red-600">
                LIVE
              </Badge>
            )}
            {minimized ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
          </div>
        </div>

        {/* Song progress bar */}
        <div className="mt-1.5 h-[2px] bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary/60 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${songProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Expanded details */}
        {!minimized && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
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

            {/* Momentum meter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Momentum</span>
              <div className="flex items-center gap-0.5">
                {momentum > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                ) : momentum < 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                ) : (
                  <Minus className="h-3 w-3 text-zinc-500" />
                )}
                <div className="flex gap-[1px]">
                  {[-3, -2, -1, 0, 1, 2, 3].map(level => (
                    <div
                      key={level}
                      className={`w-2 h-1.5 rounded-[1px] ${
                        level <= momentum && level > 0 ? 'bg-green-500' :
                        level >= momentum && level < 0 ? 'bg-red-500' :
                        level === 0 && momentum === 0 ? 'bg-zinc-500' :
                        'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Setlist mini-view toggle */}
            {songScores && songScores.length > 0 && (
              <div>
                <button
                  className="text-[9px] text-primary/70 hover:text-primary transition-colors"
                  onClick={(e) => { e.stopPropagation(); setShowSetlist(!showSetlist); }}
                >
                  {showSetlist ? '▼ Hide setlist' : '▶ Show setlist'}
                </button>
                {showSetlist && (
                  <div className="mt-1 space-y-0.5 max-h-20 overflow-y-auto">
                    {songScores.map((song, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-[9px] ${
                          i === songIndex ? 'text-primary font-bold' : song.played ? 'text-zinc-400' : 'text-zinc-600'
                        }`}
                      >
                        <span className="w-3 text-right">{i + 1}.</span>
                        <span className="truncate flex-1">{song.title}</span>
                        {song.played && (
                          <span className={song.score >= 18 ? 'text-green-400' : song.score >= 12 ? 'text-yellow-400' : 'text-red-400'}>
                            {song.score.toFixed(1)}
                          </span>
                        )}
                        {i === songIndex && !song.played && <span className="text-primary animate-pulse">▶</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
