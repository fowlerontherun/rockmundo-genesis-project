import { motion } from "framer-motion";
import { useMemo } from "react";
import type { StageThemeConfig } from "./StageThemes";

interface StageScreensProps {
  theme: StageThemeConfig;
  lightingColor: string;
  songEnergy: 'high' | 'medium' | 'low';
  songTitle?: string;
  bandName?: string;
  crowdMood?: string;
}

export const StageScreens = ({ theme, lightingColor, songEnergy, songTitle, bandName, crowdMood }: StageScreensProps) => {
  const hasScreen = theme.id === 'arena' || theme.id === 'stadium' || theme.id === 'festival_ground';
  const hasSmallScreen = theme.id === 'concert_hall';

  // Animated bars for the equalizer visualization on screen
  const eqBars = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      maxHeight: 40 + Math.random() * 60,
      delay: i * 0.05,
    }));
  }, []);

  // Scrolling text for side screens
  const sideScreens = theme.id === 'stadium';

  if (!hasScreen && !hasSmallScreen) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[1]">
      {/* Main LED backdrop screen */}
      {hasScreen && (
        <div
          className="absolute left-[8%] right-[8%]"
          style={{
            top: `${100 - theme.stageDepthPercent - 2}%`,
            height: `${100 - theme.stageDepthPercent - 4}%`,
          }}
        >
          {/* Screen frame */}
          <div className="absolute inset-0 border border-zinc-700/40 rounded-sm overflow-hidden bg-black/60">
            {/* Animated gradient background */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 50% 50%, ${lightingColor}20 0%, transparent 70%)`,
              }}
              animate={{
                background: songEnergy === 'high'
                  ? [
                    `radial-gradient(ellipse at 30% 40%, ${lightingColor}25 0%, transparent 70%)`,
                    `radial-gradient(ellipse at 70% 60%, ${lightingColor}25 0%, transparent 70%)`,
                    `radial-gradient(ellipse at 30% 40%, ${lightingColor}25 0%, transparent 70%)`,
                  ]
                  : undefined,
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Equalizer visualization */}
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[1px] px-[10%] h-[60%]">
              {eqBars.map(bar => (
                <motion.div
                  key={bar.id}
                  className="flex-1 rounded-t-[1px]"
                  style={{
                    backgroundColor: lightingColor,
                    opacity: 0.5,
                  }}
                  animate={{
                    height: songEnergy === 'high'
                      ? [`${bar.maxHeight * 0.3}%`, `${bar.maxHeight}%`, `${bar.maxHeight * 0.5}%`]
                      : songEnergy === 'medium'
                        ? [`${bar.maxHeight * 0.2}%`, `${bar.maxHeight * 0.6}%`, `${bar.maxHeight * 0.3}%`]
                        : [`${bar.maxHeight * 0.1}%`, `${bar.maxHeight * 0.3}%`, `${bar.maxHeight * 0.15}%`],
                  }}
                  transition={{
                    duration: songEnergy === 'high' ? 0.3 : 0.6,
                    repeat: Infinity,
                    delay: bar.delay,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            {/* Song title overlay */}
            {songTitle && (
              <motion.div
                className="absolute top-[15%] left-0 right-0 text-center"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <div
                  className="text-[7px] font-bold tracking-[0.15em] uppercase text-white/50"
                  style={{ textShadow: `0 0 8px ${lightingColor}` }}
                >
                  {songTitle}
                </div>
              </motion.div>
            )}

            {/* Band name at top */}
            {bandName && songEnergy !== 'high' && (
              <div className="absolute top-[5%] left-0 right-0 text-center">
                <span
                  className="text-[5px] tracking-[0.2em] uppercase text-white/30"
                  style={{ textShadow: `0 0 4px ${lightingColor}` }}
                >
                  {bandName}
                </span>
              </div>
            )}

            {/* Pixel grid overlay for LED effect */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 3px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 3px)',
              }}
            />

            {/* Scan line effect */}
            <motion.div
              className="absolute left-0 right-0 h-[2px] bg-white/5"
              animate={{ top: ['-5%', '105%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>
      )}

      {/* Smaller side info screens for stadium */}
      {sideScreens && (
        <>
          {/* Left screen */}
          <div
            className="absolute left-[1%] w-[6%] border border-zinc-700/30 rounded-sm overflow-hidden bg-black/50"
            style={{
              top: `${100 - theme.stageDepthPercent}%`,
              height: `${(100 - theme.stageDepthPercent) * 0.6}%`,
            }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: `linear-gradient(180deg, ${lightingColor}15 0%, transparent 100%)` }}
            />
            {/* Scrolling text */}
            <motion.div
              className="absolute whitespace-nowrap text-[4px] text-white/30 font-bold"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
              animate={{ x: ['100%', '-200%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              {bandName ? `★ ${bandName} ★ LIVE ★` : '★ LIVE ★'}
            </motion.div>
          </div>

          {/* Right screen */}
          <div
            className="absolute right-[1%] w-[6%] border border-zinc-700/30 rounded-sm overflow-hidden bg-black/50"
            style={{
              top: `${100 - theme.stageDepthPercent}%`,
              height: `${(100 - theme.stageDepthPercent) * 0.6}%`,
            }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: `linear-gradient(180deg, ${lightingColor}15 0%, transparent 100%)` }}
            />
            <motion.div
              className="absolute whitespace-nowrap text-[4px] text-white/30 font-bold"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
              animate={{ x: ['-200%', '100%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              {songTitle ? `♫ ${songTitle} ♫` : '♫ LIVE ♫'}
            </motion.div>
          </div>
        </>
      )}

      {/* Concert hall small overhead screen */}
      {hasSmallScreen && (
        <div
          className="absolute left-[25%] right-[25%] border border-zinc-600/30 rounded-sm overflow-hidden bg-black/40"
          style={{
            top: `${100 - theme.stageDepthPercent - 1}%`,
            height: `${(100 - theme.stageDepthPercent) * 0.5}%`,
          }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse, ${lightingColor}15 0%, transparent 80%)` }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          {songTitle && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[5px] text-white/40 tracking-wider uppercase">{songTitle}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
