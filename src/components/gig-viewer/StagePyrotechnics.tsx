import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

interface StagePyrotechnicsProps {
  songEnergy: 'high' | 'medium' | 'low';
  crowdMood: string;
  isFinale: boolean;
  intensity: number;
  lightingColor: string;
}

// Flame jet positions (left/right of stage)
const FLAME_POSITIONS = [8, 18, 82, 92];

export const StagePyrotechnics = ({ songEnergy, crowdMood, isFinale, intensity, lightingColor }: StagePyrotechnicsProps) => {
  // Pyro jets fire during high energy + ecstatic
  const showPyro = (songEnergy === 'high' && (crowdMood === 'ecstatic' || crowdMood === 'enthusiastic')) || isFinale;

  // Confetti for finale
  const confettiPieces = useMemo(() => {
    if (!isFinale) return [];
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: [`hsl(0,90%,60%)`, `hsl(45,90%,55%)`, `hsl(200,80%,60%)`, `hsl(280,80%,60%)`, `hsl(120,70%,50%)`, `hsl(320,80%,60%)`][i % 6],
      size: 3 + Math.random() * 4,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 3,
      wobble: (Math.random() - 0.5) * 60,
    }));
  }, [isFinale]);

  // Firework bursts for high scores
  const fireworks = useMemo(() => {
    if (!showPyro || isFinale) return [];
    return Array.from({ length: 3 }).map((_, i) => ({
      id: i,
      x: 20 + Math.random() * 60,
      y: 10 + Math.random() * 30,
      delay: i * 1.5 + Math.random(),
      hue: Math.random() * 360,
    }));
  }, [showPyro, isFinale]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[9] overflow-hidden">
      {/* Flame jets */}
      {showPyro && !isFinale && FLAME_POSITIONS.map((pos, i) => (
        <motion.div
          key={`flame-${i}`}
          className="absolute bottom-[2%]"
          style={{ left: `${pos}%`, width: 8 }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scaleY: [0.3, 1, 1.2, 0],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatDelay: 2 + i * 0.5,
            delay: i * 0.3,
          }}
        >
          {/* Flame body */}
          <div className="relative w-full">
            <div
              className="w-full h-8 rounded-t-full"
              style={{
                background: 'linear-gradient(0deg, hsl(30, 100%, 50%) 0%, hsl(45, 100%, 60%) 30%, hsl(50, 100%, 70%) 60%, transparent 100%)',
              }}
            />
            {/* Inner flame */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-6 rounded-t-full"
              style={{
                background: 'linear-gradient(0deg, hsl(45, 100%, 80%) 0%, hsl(50, 100%, 90%) 50%, transparent 100%)',
              }}
            />
          </div>
          {/* Flame glow */}
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-6 rounded-full blur-md"
            style={{ backgroundColor: 'hsl(30, 100%, 50%)', opacity: 0.4 }}
          />
        </motion.div>
      ))}

      {/* Firework bursts */}
      {fireworks.map(fw => (
        <motion.div
          key={`fw-${fw.id}`}
          className="absolute"
          style={{ left: `${fw.x}%`, top: `${fw.y}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1.2, 0],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            repeatDelay: 4,
            delay: fw.delay,
          }}
        >
          {/* Burst rays */}
          {Array.from({ length: 8 }).map((_, r) => (
            <motion.div
              key={r}
              className="absolute"
              style={{
                width: 2,
                height: 12,
                left: '50%',
                top: '50%',
                transformOrigin: 'center bottom',
                transform: `rotate(${r * 45}deg) translateY(-6px)`,
                backgroundColor: `hsl(${fw.hue + r * 15}, 90%, 65%)`,
                boxShadow: `0 0 4px hsl(${fw.hue + r * 15}, 90%, 65%)`,
                borderRadius: 1,
              }}
              animate={{ height: [4, 14, 8], opacity: [1, 1, 0] }}
              transition={{ duration: 0.8, delay: fw.delay + 0.2 }}
            />
          ))}
          {/* Burst center */}
          <div
            className="w-3 h-3 rounded-full absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              backgroundColor: `hsl(${fw.hue}, 80%, 80%)`,
              boxShadow: `0 0 10px hsl(${fw.hue}, 90%, 70%)`,
            }}
          />
        </motion.div>
      ))}

      {/* Finale confetti cannon */}
      <AnimatePresence>
        {isFinale && confettiPieces.map(piece => (
          <motion.div
            key={`conf-${piece.id}`}
            className="absolute"
            style={{
              left: `${piece.x}%`,
              width: piece.size,
              height: piece.size * 0.5,
              backgroundColor: piece.color,
              borderRadius: 1,
            }}
            initial={{ top: '-2%', rotate: 0, opacity: 1 }}
            animate={{
              top: '110%',
              rotate: [0, 360, 720],
              x: [0, piece.wobble, piece.wobble * 0.5],
              opacity: [1, 1, 1, 0.5],
            }}
            transition={{
              duration: piece.duration,
              repeat: Infinity,
              delay: piece.delay,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          />
        ))}
      </AnimatePresence>

      {/* Finale golden shower effect */}
      {isFinale && (
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, hsl(45, 100%, 60%)15 0%, transparent 60%)',
          }}
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* CO2 cannon burst effect */}
      {showPyro && songEnergy === 'high' && (
        <>
          {[10, 90].map((pos, i) => (
            <motion.div
              key={`co2-${i}`}
              className="absolute bottom-[5%]"
              style={{
                left: `${pos}%`,
                width: 20,
                height: 30,
                transform: 'translateX(-50%)',
                background: 'linear-gradient(0deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 100%)',
                filter: 'blur(3px)',
                borderRadius: '50% 50% 0 0',
              }}
              animate={{
                scaleY: [0, 1.5, 0],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                repeatDelay: 5,
                delay: i * 2.5 + 1,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
};
