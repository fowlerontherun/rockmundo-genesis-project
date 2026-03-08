import { useMemo } from "react";
import { motion } from "framer-motion";
import type { GenreVisualConfig } from "./GenreVisuals";

interface TopDownCrowdProps {
  attendancePercent: number;
  mood: string;
  intensity: number;
  genreVisuals?: GenreVisualConfig | null;
  songEnergy?: 'high' | 'medium' | 'low';
}

const moodColors: Record<string, { base: string; glow: string }> = {
  ecstatic: { base: 'bg-orange-400', glow: 'shadow-orange-400/40' },
  enthusiastic: { base: 'bg-green-400', glow: 'shadow-green-400/40' },
  engaged: { base: 'bg-blue-400', glow: 'shadow-blue-400/30' },
  mixed: { base: 'bg-yellow-500', glow: 'shadow-yellow-500/30' },
  disappointed: { base: 'bg-red-400', glow: 'shadow-red-400/30' },
};

export const TopDownCrowd = ({ attendancePercent, mood, intensity, genreVisuals, songEnergy }: TopDownCrowdProps) => {
  const colors = moodColors[mood] || moodColors.engaged;
  const gv = genreVisuals;

  const dots = useMemo(() => {
    const maxDots = 100;
    const count = Math.max(4, Math.floor((attendancePercent / 100) * maxDots));
    const cols = 16;
    const rows = Math.ceil(maxDots / cols);

    const result: {
      x: number; y: number; delay: number; isMosher: boolean;
      size: 'small' | 'medium' | 'large'; zone: 'front' | 'mid' | 'back';
      isPhoneLight: boolean;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const jitterX = (Math.random() - 0.5) * 5;
      const jitterY = (Math.random() - 0.5) * 4;
      const x = 4 + (col / (cols - 1)) * 92 + jitterX;
      const y = 8 + (row / Math.max(rows - 1, 1)) * 80 + jitterY;

      const zone: 'front' | 'mid' | 'back' = row <= 1 ? 'front' : row <= 3 ? 'mid' : 'back';
      const size = zone === 'front' ? 'large' : zone === 'mid' ? 'medium' : 'small';

      const isCenter = col >= 5 && col <= 11 && row <= 1;
      const isMosher = isCenter && (mood === 'ecstatic' || mood === 'enthusiastic') &&
        (gv?.crowdStyle === 'mosh' || gv?.enableCirclePit || false);

      // Phone flashlights during ballads or when genre config says so
      const isPhoneLight = (gv?.enablePhoneLights || false) &&
        (songEnergy === 'low' || mood === 'engaged') &&
        Math.random() < 0.3;

      result.push({ x, y, delay: Math.random() * 2, isMosher, size, zone, isPhoneLight });
    }
    return result;
  }, [attendancePercent, mood, gv?.crowdStyle, gv?.enableCirclePit, gv?.enablePhoneLights, songEnergy]);

  const jumpHeight = mood === 'ecstatic' ? 7 : mood === 'enthusiastic' ? 5 : mood === 'engaged' ? 2 : 0;
  const animDuration = Math.max(0.3, 0.8 - intensity * 0.4);
  const crowdMod = gv?.crowdIntensityMod || 1;

  // Circle pit dots
  const circlePitDots = useMemo(() => {
    if (!gv?.enableCirclePit || mood !== 'ecstatic') return [];
    return Array.from({ length: 10 }).map((_, i) => ({
      angle: (i / 10) * Math.PI * 2,
      delay: i * 0.1,
    }));
  }, [gv?.enableCirclePit, mood]);

  // Crowd surfer
  const showCrowdSurfer = gv?.enableCrowdSurfer && mood === 'ecstatic' && songEnergy === 'high';

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Floor gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950" />

      {/* Mosh pit glow */}
      {(mood === 'ecstatic' || mood === 'enthusiastic') && (
        <div className="absolute top-0 left-1/4 right-1/4 h-1/3 bg-primary/10 rounded-full blur-xl animate-pulse" />
      )}

      {/* Circle pit */}
      {circlePitDots.length > 0 && (
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2" style={{ width: 60, height: 60 }}>
          {circlePitDots.map((dot, i) => (
            <motion.div
              key={`pit-${i}`}
              className="absolute w-2 h-2 rounded-full bg-orange-500"
              style={{
                left: '50%',
                top: '50%',
              }}
              animate={{
                x: [Math.cos(dot.angle) * 25, Math.cos(dot.angle + Math.PI) * 25, Math.cos(dot.angle + Math.PI * 2) * 25],
                y: [Math.sin(dot.angle) * 20, Math.sin(dot.angle + Math.PI) * 20, Math.sin(dot.angle + Math.PI * 2) * 20],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
          {/* Pit center empty space */}
          <div className="absolute inset-[25%] rounded-full bg-zinc-900/50" />
        </div>
      )}

      {/* Crowd dots */}
      {dots.map((dot, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${
            dot.isPhoneLight ? 'bg-white' :
            dot.isMosher ? 'w-2.5 h-2.5' : ''
          } ${!dot.isPhoneLight ? colors.base : ''} shadow-sm ${colors.glow}`}
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.isPhoneLight ? 3 :
              dot.size === 'large' ? 10 : dot.size === 'medium' ? 8 : 6,
            height: dot.isPhoneLight ? 3 :
              dot.size === 'large' ? 10 : dot.size === 'medium' ? 8 : 6,
          }}
          animate={
            dot.isPhoneLight
              ? { opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }
              : jumpHeight > 0
                ? {
                    y: dot.isMosher
                      ? [0, -(jumpHeight * 2 * crowdMod), 0, -(jumpHeight * crowdMod), 0]
                      : dot.zone === 'front'
                        ? [0, -(jumpHeight * crowdMod), 0]
                        : dot.zone === 'mid'
                          ? [0, -(jumpHeight * 0.6 * crowdMod), 0]
                          : [0, -(jumpHeight * 0.3 * crowdMod), 0],
                    scale: dot.isMosher ? [1, 1.3, 1] : [1, 1.05, 1],
                  }
                : {}
          }
          transition={{
            duration: dot.isPhoneLight ? 3 :
              dot.isMosher ? animDuration * 0.6 : animDuration,
            repeat: Infinity,
            delay: dot.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Crowd surfer */}
      {showCrowdSurfer && (
        <motion.div
          className="absolute top-[5%] w-3 h-3 bg-amber-400 rounded-full shadow-lg shadow-amber-400/50 z-10"
          animate={{ x: ['10%', '90%'], y: [0, -3, 0, -2, 0, -4, 0] }}
          transition={{
            x: { duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'linear' },
            y: { duration: 0.8, repeat: Infinity },
          }}
          style={{ left: '5%' }}
        />
      )}

      {/* Sequential wave effect for engaged mood */}
      {mood === 'engaged' && !gv?.enableCirclePit && (
        <motion.div
          className="absolute left-0 right-0 h-full"
          style={{
            background: 'linear-gradient(180deg, transparent, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%, transparent)',
          }}
          animate={{ y: ['-20%', '120%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Wave effect overlay for ecstatic */}
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
