import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

interface AudienceInteractionsProps {
  mood: string;
  songEnergy: 'high' | 'medium' | 'low';
  intensity: number;
  attendancePercent: number;
}

export const AudienceInteractions = ({ mood, songEnergy, intensity, attendancePercent }: AudienceInteractionsProps) => {
  // Clap sync - visible during enthusiastic/ecstatic between songs or during high moments
  const showClapping = mood === 'ecstatic' || mood === 'enthusiastic';

  // Lighter/phone wave positions
  const lighterWave = useMemo(() => {
    if (songEnergy !== 'low' || mood === 'disappointed') return [];
    return Array.from({ length: Math.floor(attendancePercent / 8) }).map((_, i) => ({
      id: i,
      x: 8 + Math.random() * 84,
      y: 15 + Math.random() * 70,
      delay: i * 0.3 + Math.random() * 2,
      isPhone: Math.random() > 0.4,
    }));
  }, [songEnergy, mood, attendancePercent]);

  // Crowd chant indicator
  const showChant = mood === 'ecstatic' && intensity > 0.7;

  // Hand clap emoji rain
  const clapPositions = useMemo(() => {
    if (!showClapping) return [];
    return Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      x: 15 + (i / 5) * 70,
      delay: i * 0.15,
    }));
  }, [showClapping]);

  // Singalong text bubbles
  const showSingalong = mood === 'ecstatic' && songEnergy === 'high';
  const singalongBubbles = useMemo(() => {
    if (!showSingalong) return [];
    return Array.from({ length: 4 }).map((_, i) => ({
      id: i,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 40,
      delay: i * 1.5,
    }));
  }, [showSingalong]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[4] overflow-hidden">
      {/* Lighter / phone flashlight wave during ballads */}
      {lighterWave.map(lighter => (
        <motion.div
          key={`lighter-${lighter.id}`}
          className="absolute"
          style={{ left: `${lighter.x}%`, top: `${lighter.y}%` }}
          animate={{
            rotate: [-5, 5, -5],
            y: [0, -2, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: lighter.delay,
            ease: 'easeInOut',
          }}
        >
          {lighter.isPhone ? (
            // Phone flashlight
            <div className="relative">
              <div className="w-1.5 h-2.5 bg-zinc-700 rounded-[1px] border border-zinc-500/30" />
              <motion.div
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white"
                style={{ boxShadow: '0 0 6px rgba(255,255,255,0.8), 0 -4px 8px rgba(255,255,255,0.3)' }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, delay: lighter.delay }}
              />
            </div>
          ) : (
            // Classic lighter flame
            <div className="relative">
              <div className="w-1 h-2 bg-zinc-600 rounded-sm" />
              <motion.div
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-2.5 rounded-t-full"
                style={{
                  background: 'linear-gradient(0deg, hsl(30, 100%, 50%) 0%, hsl(45, 100%, 70%) 50%, hsl(50, 100%, 90%) 100%)',
                }}
                animate={{ scaleY: [0.8, 1.2, 0.8], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            </div>
          )}
        </motion.div>
      ))}

      {/* Clapping hands indicators */}
      <AnimatePresence>
        {showClapping && clapPositions.map(clap => (
          <motion.div
            key={`clap-${clap.id}`}
            className="absolute text-[8px]"
            style={{ left: `${clap.x}%`, bottom: '5%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0], y: [0, -8, -16] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              repeatDelay: 0.4,
              delay: clap.delay,
            }}
          >
            👏
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Crowd chant visualization */}
      {showChant && (
        <motion.div
          className="absolute top-[5%] left-1/2 -translate-x-1/2 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0.8, 0], scale: [0.8, 1, 1, 0.9] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
        >
          <div
            className="text-[10px] font-black tracking-[0.2em] uppercase text-white/60"
            style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}
          >
            ONE MORE SONG!
          </div>
          {/* Sound wave bars */}
          <div className="flex gap-[1px] justify-center mt-0.5">
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                className="w-[2px] bg-white/30 rounded-full"
                animate={{ height: [2, 4 + Math.random() * 6, 2] }}
                transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.05 }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Singalong bubbles */}
      {singalongBubbles.map(bubble => (
        <motion.div
          key={`sing-${bubble.id}`}
          className="absolute text-[7px] text-white/40 italic"
          style={{ left: `${bubble.x}%`, top: `${bubble.y}%` }}
          animate={{
            opacity: [0, 0.6, 0],
            y: [0, -12],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: bubble.delay,
          }}
        >
          ♫ ♪
        </motion.div>
      ))}

      {/* Arms raised indicators during high energy */}
      {songEnergy === 'high' && (mood === 'ecstatic' || mood === 'enthusiastic') && (
        <>
          {[25, 45, 55, 75].map((pos, i) => (
            <motion.div
              key={`arm-${i}`}
              className="absolute text-[6px]"
              style={{ left: `${pos}%`, top: '10%' }}
              animate={{ y: [0, -3, 0], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
            >
              🙌
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
};
