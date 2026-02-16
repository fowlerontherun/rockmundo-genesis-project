import { memo } from 'react';
import { motion } from 'framer-motion';
import { Music, Users, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface VideoGigHUDProps {
  venueName: string;
  currentSongTitle?: string;
  currentSongIndex: number;
  totalSongs: number;
  crowdMood: number;
  attendancePercentage: number;
  crowdResponse?: string;
  phase: string;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

export const VideoGigHUD = memo(({
  venueName,
  currentSongTitle,
  currentSongIndex,
  totalSongs,
  crowdMood,
  attendancePercentage,
  crowdResponse,
  phase,
  isMinimized,
  onToggleMinimize,
}: VideoGigHUDProps) => {
  const moodColor = crowdMood > 70 ? 'text-green-400' : crowdMood > 40 ? 'text-yellow-400' : 'text-red-400';
  const moodLabel = crowdMood > 80 ? 'Ecstatic' : crowdMood > 60 ? 'Hyped' : crowdMood > 40 ? 'Engaged' : crowdMood > 20 ? 'Meh' : 'Bored';

  const phaseLabel = {
    backstage: '🎤 Backstage',
    entrance: '🚶 Walking On Stage',
    performance: '🎵 Live',
    between_songs: '⏸ Between Songs',
    exit: '🎬 Finale',
  }[phase] || '🎵 Live';

  return (
    <motion.div
      className="absolute top-4 left-4 right-4 z-40 pointer-events-auto"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      <div 
        className="bg-black/70 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden cursor-pointer"
        onClick={onToggleMinimize}
      >
        {/* Header - always visible */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white/90 text-sm font-semibold">{venueName}</span>
            <Badge variant="outline" className="text-[10px] text-white/60 border-white/20">
              {phaseLabel}
            </Badge>
          </div>
          {isMinimized ? (
            <ChevronDown className="h-4 w-4 text-white/50" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/50" />
          )}
        </div>

        {/* Expanded content */}
        {!isMinimized && (
          <div className="px-4 pb-3 space-y-2 border-t border-white/5 pt-2">
            {/* Current song */}
            {currentSongTitle && (
              <div className="flex items-center gap-2">
                <Music className="h-3.5 w-3.5 text-primary" />
                <span className="text-white/80 text-sm truncate">{currentSongTitle}</span>
                <span className="text-white/40 text-xs ml-auto">{currentSongIndex + 1}/{totalSongs}</span>
              </div>
            )}

            {/* Song progress */}
            <Progress value={totalSongs > 0 ? ((currentSongIndex + 1) / totalSongs) * 100 : 0} className="h-1" />

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-white/50" />
                <span className="text-white/70">{attendancePercentage.toFixed(0)}% full</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className={`h-3 w-3 ${moodColor}`} />
                <span className={moodColor}>{moodLabel}</span>
              </div>
              {crowdResponse && (
                <Badge variant="outline" className="text-[10px] text-white/50 border-white/10">
                  {crowdResponse}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

VideoGigHUD.displayName = 'VideoGigHUD';
