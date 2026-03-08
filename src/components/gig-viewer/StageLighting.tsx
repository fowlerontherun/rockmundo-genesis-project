import { motion } from "framer-motion";
import type { StageThemeConfig } from "./StageThemes";

interface StageLightingProps {
  theme: StageThemeConfig;
  lightingColor: string;
  songEnergy: 'high' | 'medium' | 'low';
  crowdMood: string;
  intensity: number;
}

export const StageLighting = ({ theme, lightingColor, songEnergy, crowdMood, intensity }: StageLightingProps) => {
  const spotCount = theme.spotlightCount;

  return (
    <div className="absolute inset-0 pointer-events-none z-[5]">
      {/* Spotlight cones from above */}
      {Array.from({ length: spotCount }).map((_, i) => {
        const xPos = ((i + 1) / (spotCount + 1)) * 100;
        const delay = i * 0.3;
        const hueShift = i * 30;

        return (
          <motion.div
            key={`spot-${i}`}
            className="absolute top-0"
            style={{
              left: `${xPos}%`,
              width: songEnergy === 'high' ? 40 : 30,
              height: '100%',
              transform: 'translateX(-50%)',
              background: `conic-gradient(from 170deg at 50% 0%, transparent 0deg, ${lightingColor}15 5deg, ${lightingColor}08 20deg, transparent 35deg)`,
            }}
            animate={
              songEnergy === 'high'
                ? { rotate: [-8, 8, -8], opacity: [0.6, 1, 0.6] }
                : songEnergy === 'medium'
                  ? { opacity: [0.4, 0.7, 0.4] }
                  : { opacity: [0.2, 0.35, 0.2] }
            }
            transition={{
              duration: songEnergy === 'high' ? 1.5 : 3,
              repeat: Infinity,
              delay,
              ease: 'easeInOut',
            }}
          />
        );
      })}

      {/* Moving head beams */}
      {theme.hasMovingHeads && (
        <>
          {[15, 85].map((xPos, i) => (
            <motion.div
              key={`mover-${i}`}
              className="absolute top-0"
              style={{
                left: `${xPos}%`,
                width: 3,
                height: '90%',
                transformOrigin: 'top center',
                background: `linear-gradient(180deg, ${lightingColor}40 0%, ${lightingColor}05 100%)`,
                borderRadius: '0 0 50% 50%',
              }}
              animate={{
                rotate: songEnergy === 'high' ? [-30, 30, -30] : [-15, 15, -15],
              }}
              transition={{
                duration: songEnergy === 'high' ? 2 : 4,
                repeat: Infinity,
                delay: i * 1.2,
                ease: 'easeInOut',
              }}
            />
          ))}
          {/* Center mover */}
          <motion.div
            className="absolute top-0 left-1/2"
            style={{
              width: 4,
              height: '85%',
              transformOrigin: 'top center',
              background: `linear-gradient(180deg, hsl(180, 80%, 60%)30 0%, transparent 100%)`,
              borderRadius: '0 0 50% 50%',
            }}
            animate={{ rotate: [-20, 20, -20] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      {/* Laser beams */}
      {theme.hasLasers && songEnergy === 'high' && (
        <>
          {[25, 50, 75].map((xPos, i) => (
            <motion.div
              key={`laser-${i}`}
              className="absolute top-0"
              style={{
                left: `${xPos}%`,
                width: 1,
                height: '100%',
                transformOrigin: 'top center',
                background: i === 1
                  ? 'linear-gradient(180deg, hsl(120, 100%, 50%)60, transparent)'
                  : 'linear-gradient(180deg, hsl(0, 100%, 50%)40, transparent)',
              }}
              animate={{ rotate: [-45, 45, -45] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: i * 0.6,
                ease: 'easeInOut',
              }}
            />
          ))}
        </>
      )}

      {/* Strobe effect for ecstatic mood */}
      {crowdMood === 'ecstatic' && songEnergy === 'high' && (
        <motion.div
          className="absolute inset-0 bg-white"
          animate={{ opacity: [0, 0, 0.15, 0, 0, 0, 0.1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}

      {/* Wash light overlay */}
      <motion.div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${lightingColor}12 0%, transparent 70%)`,
        }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Fog machine effect */}
      {theme.hasFogMachine && (songEnergy === 'high' || songEnergy === 'medium') && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[30%]"
          style={{
            background: 'linear-gradient(0deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
          }}
          animate={{
            opacity: [0.3, 0.7, 0.3],
            y: [0, -5, 0],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Overhead truss outline for large venues */}
      {(theme.equipmentScale === 'large' || theme.equipmentScale === 'massive') && (
        <div className="absolute top-0 left-[5%] right-[5%] h-[3px] flex justify-between">
          <div className="w-full h-full bg-zinc-700/30" />
          {/* Truss fixtures */}
          {Array.from({ length: theme.equipmentScale === 'massive' ? 8 : 5 }).map((_, i) => (
            <div
              key={`truss-${i}`}
              className="absolute top-0 w-1 h-1 bg-zinc-500/40 rounded-full"
              style={{ left: `${((i + 1) / (theme.equipmentScale === 'massive' ? 9 : 6)) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
