import { motion } from "framer-motion";
import { Flame, Sparkles, Zap } from "lucide-react";

interface JamSessionMoodMeterProps {
  mood: number; // 0-100
  synergy: number; // 0-100
}

export const JamSessionMoodMeter = ({ mood, synergy }: JamSessionMoodMeterProps) => {
  const getMoodLabel = () => {
    if (mood >= 80) return { label: "On Fire! 🔥", color: "text-orange-500" };
    if (mood >= 60) return { label: "Vibing", color: "text-green-500" };
    if (mood >= 40) return { label: "Warming Up", color: "text-yellow-500" };
    if (mood >= 20) return { label: "Getting Started", color: "text-blue-500" };
    return { label: "Cold", color: "text-muted-foreground" };
  };

  const moodInfo = getMoodLabel();

  return (
    <div className="space-y-3 p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Session Vibe</span>
        <span className={`text-sm font-bold ${moodInfo.color}`}>{moodInfo.label}</span>
      </div>
      
      {/* Mood Bar */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-green-500 to-orange-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${mood}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {mood >= 70 && (
          <motion.div
            className="absolute right-2 top-1/2 -translate-y-1/2"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            <Flame className="h-4 w-4 text-orange-400" />
          </motion.div>
        )}
      </div>

      {/* Synergy Indicator */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <span className="text-xs text-muted-foreground">Skill Synergy</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${synergy}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs font-medium">{synergy}%</span>
      </div>

      {synergy >= 80 && (
        <div className="flex items-center gap-1 text-xs text-purple-500">
          <Zap className="h-3 w-3" />
          Perfect synergy! XP bonus active
        </div>
      )}
    </div>
  );
};
