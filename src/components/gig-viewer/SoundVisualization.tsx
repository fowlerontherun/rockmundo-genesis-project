import { motion } from "framer-motion";
import type { StageThemeConfig } from "./StageThemes";

interface SoundVisualizationProps {
  theme: StageThemeConfig;
  songEnergy: 'high' | 'medium' | 'low';
  lightingColor: string;
  intensity: number;
}

export const SoundVisualization = ({ theme, songEnergy, lightingColor, intensity }: SoundVisualizationProps) => {
  const scale = theme.equipmentScale;
  const isLarge = scale === 'large' || scale === 'massive';
  const isMassive = scale === 'massive';

  // Sound wave rings emanating from speaker stacks
  const waveCount = songEnergy === 'high' ? 4 : songEnergy === 'medium' ? 3 : 2;
  const waveSpeed = songEnergy === 'high' ? 1.2 : songEnergy === 'medium' ? 2 : 3;

  return (
    <div className="absolute inset-0 pointer-events-none z-[3] overflow-hidden">
      {/* Left speaker sound waves */}
      <div
        className="absolute"
        style={{
          left: isMassive ? '3%' : isLarge ? '2.5%' : '2%',
          top: '20%',
        }}
      >
        {Array.from({ length: waveCount }).map((_, i) => (
          <motion.div
            key={`wave-l-${i}`}
            className="absolute rounded-full border"
            style={{
              borderColor: `${lightingColor}`,
              width: 0,
              height: 0,
              left: 0,
              top: 0,
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              width: [0, isLarge ? 60 : 40],
              height: [0, isLarge ? 40 : 30],
              opacity: [0.3, 0],
              borderWidth: [2, 0.5],
            }}
            transition={{
              duration: waveSpeed,
              repeat: Infinity,
              delay: i * (waveSpeed / waveCount),
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      {/* Right speaker sound waves */}
      <div
        className="absolute"
        style={{
          right: isMassive ? '3%' : isLarge ? '2.5%' : '2%',
          top: '20%',
        }}
      >
        {Array.from({ length: waveCount }).map((_, i) => (
          <motion.div
            key={`wave-r-${i}`}
            className="absolute rounded-full border"
            style={{
              borderColor: `${lightingColor}`,
              width: 0,
              height: 0,
              right: 0,
              top: 0,
              transform: 'translate(50%, -50%)',
            }}
            animate={{
              width: [0, isLarge ? 60 : 40],
              height: [0, isLarge ? 40 : 30],
              opacity: [0.3, 0],
              borderWidth: [2, 0.5],
            }}
            transition={{
              duration: waveSpeed,
              repeat: Infinity,
              delay: i * (waveSpeed / waveCount),
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      {/* Bass vibration floor effect for bass-heavy genres */}
      {songEnergy === 'high' && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[8%]"
          style={{
            background: `linear-gradient(0deg, ${lightingColor}08 0%, transparent 100%)`,
          }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* Monitor feedback glow at front of stage */}
      {theme.hasMonitors && songEnergy !== 'low' && (
        <div className="absolute bottom-[6%] left-[12%] right-[12%] flex justify-around">
          {Array.from({ length: isLarge ? 5 : 3 }).map((_, i) => (
            <motion.div
              key={`mon-glow-${i}`}
              className="w-3 h-1.5 rounded-full"
              style={{
                backgroundColor: lightingColor,
                filter: 'blur(2px)',
              }}
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
