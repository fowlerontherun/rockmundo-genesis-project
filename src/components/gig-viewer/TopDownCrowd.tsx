import { useMemo } from "react";
import { motion } from "framer-motion";

interface TopDownCrowdProps {
  attendancePercent: number; // 0-100
  mood: string; // ecstatic, enthusiastic, engaged, mixed, disappointed
  intensity: number; // 0-1, drives animation speed
}

const moodColors: Record<string, { base: string; glow: string }> = {
  ecstatic: { base: 'bg-orange-400', glow: 'shadow-orange-400/40' },
  enthusiastic: { base: 'bg-green-400', glow: 'shadow-green-400/40' },
  engaged: { base: 'bg-blue-400', glow: 'shadow-blue-400/30' },
  mixed: { base: 'bg-yellow-500', glow: 'shadow-yellow-500/30' },
  disappointed: { base: 'bg-red-400', glow: 'shadow-red-400/30' },
};

export const TopDownCrowd = ({ attendancePercent, mood, intensity }: TopDownCrowdProps) => {
  const colors = moodColors[mood] || moodColors.engaged;
  
  // Generate crowd dot positions
  const dots = useMemo(() => {
    const maxDots = 80;
    const count = Math.max(4, Math.floor((attendancePercent / 100) * maxDots));
    const cols = 14;
    const rows = Math.ceil(maxDots / cols);
    
    const result: { x: number; y: number; delay: number; isMosher: boolean }[] = [];
    
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      // Add slight randomness to positions
      const jitterX = (Math.random() - 0.5) * 6;
      const jitterY = (Math.random() - 0.5) * 4;
      const x = 4 + (col / (cols - 1)) * 92 + jitterX;
      const y = 8 + (row / Math.max(rows - 1, 1)) * 80 + jitterY;
      
      // Moshers in center-front for enthusiastic+ moods
      const isCenter = col >= 5 && col <= 9 && row <= 1;
      const isMosher = isCenter && (mood === 'ecstatic' || mood === 'enthusiastic');
      
      result.push({ x, y, delay: Math.random() * 2, isMosher });
    }
    return result;
  }, [attendancePercent, mood]);

  const jumpHeight = mood === 'ecstatic' ? 6 : mood === 'enthusiastic' ? 4 : mood === 'engaged' ? 2 : 0;
  const animDuration = Math.max(0.3, 0.8 - intensity * 0.4);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Floor gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950" />
      
      {/* Mosh pit glow for high energy */}
      {(mood === 'ecstatic' || mood === 'enthusiastic') && (
        <div className="absolute top-0 left-1/4 right-1/4 h-1/3 bg-primary/10 rounded-full blur-xl animate-pulse" />
      )}

      {/* Crowd dots */}
      {dots.map((dot, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${dot.isMosher ? 'w-2.5 h-2.5' : 'w-2 h-2'} ${colors.base} shadow-sm ${colors.glow}`}
          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
          animate={
            jumpHeight > 0
              ? {
                  y: dot.isMosher 
                    ? [0, -(jumpHeight * 2), 0, -jumpHeight, 0] 
                    : [0, -jumpHeight, 0],
                  scale: dot.isMosher ? [1, 1.3, 1] : [1, 1.1, 1],
                }
              : {}
          }
          transition={{
            duration: dot.isMosher ? animDuration * 0.6 : animDuration,
            repeat: Infinity,
            delay: dot.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Wave effect overlay */}
      {mood === 'ecstatic' && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
};
