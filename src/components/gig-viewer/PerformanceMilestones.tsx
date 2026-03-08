import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface PerformanceMilestonesProps {
  averageScore: number;
  songsPlayed: number;
  crowdMood: string;
  momentum: number;
}

interface MilestoneEvent {
  id: string;
  text: string;
  icon: string;
  color: string;
}

const MILESTONES = [
  { threshold: 5, text: 'FIVE SONG STREAK!', icon: '🔥', minScore: 15 },
  { threshold: 3, text: 'HAT TRICK!', icon: '🎩', minScore: 18 },
  { threshold: 0, text: 'PERFECT SCORE!', icon: '💎', minScore: 23 },
  { threshold: 0, text: 'FLAWLESS!', icon: '✨', minScore: 20 },
];

export const PerformanceMilestones = ({ averageScore, songsPlayed, crowdMood, momentum }: PerformanceMilestonesProps) => {
  const [activeMilestone, setActiveMilestone] = useState<MilestoneEvent | null>(null);
  const [shownMilestones, setShownMilestones] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check for momentum-based milestones
    if (momentum >= 3 && !shownMilestones.has('max-momentum')) {
      triggerMilestone('max-momentum', 'MAXIMUM HYPE!', '🚀', 'text-amber-400');
    }

    // Score milestones
    if (averageScore >= 22 && songsPlayed >= 3 && !shownMilestones.has('legendary')) {
      triggerMilestone('legendary', 'LEGENDARY PERFORMANCE!', '👑', 'text-amber-300');
    } else if (averageScore >= 18 && songsPlayed >= 2 && !shownMilestones.has('outstanding')) {
      triggerMilestone('outstanding', 'OUTSTANDING!', '⭐', 'text-yellow-400');
    }

    // Ecstatic crowd milestone
    if (crowdMood === 'ecstatic' && !shownMilestones.has('crowd-ecstatic')) {
      triggerMilestone('crowd-ecstatic', 'CROWD GOES WILD!', '🔥', 'text-orange-400');
    }
  }, [averageScore, songsPlayed, momentum, crowdMood]);

  const triggerMilestone = (id: string, text: string, icon: string, color: string) => {
    if (shownMilestones.has(id)) return;
    setShownMilestones(prev => new Set([...prev, id]));
    setActiveMilestone({ id, text, icon, color });
    setTimeout(() => setActiveMilestone(null), 3000);
  };

  return (
    <AnimatePresence>
      {activeMilestone && (
        <motion.div
          className="absolute top-[35%] left-1/2 -translate-x-1/2 z-[18] pointer-events-none"
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.5, type: 'spring', damping: 15 }}
        >
          <div className="text-center">
            {/* Icon burst */}
            <motion.div
              className="text-2xl mb-1"
              animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.6 }}
            >
              {activeMilestone.icon}
            </motion.div>

            {/* Text */}
            <motion.div
              className={`text-xs font-black tracking-[0.2em] uppercase ${activeMilestone.color}`}
              style={{
                textShadow: '0 0 20px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.8)',
              }}
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1, repeat: 2 }}
            >
              {activeMilestone.text}
            </motion.div>

            {/* Sparkle particles around milestone */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-amber-400"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.cos((i / 6) * Math.PI * 2) * 40,
                  y: Math.sin((i / 6) * Math.PI * 2) * 30,
                  opacity: 0,
                  scale: [1, 0],
                }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
