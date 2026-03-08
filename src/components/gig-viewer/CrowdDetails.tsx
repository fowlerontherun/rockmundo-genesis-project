import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { GenreVisualConfig } from './GenreVisuals';

interface CrowdDetailsProps {
  attendancePercent: number;
  mood: string;
  intensity: number;
  genreVisuals: GenreVisualConfig;
  songEnergy: 'high' | 'medium' | 'low';
}

/**
 * CrowdDetails - Additional crowd visual elements
 * Includes signs, banners, merch in crowd, security, photographers
 */
export const CrowdDetails = ({
  attendancePercent,
  mood,
  intensity,
  genreVisuals,
  songEnergy,
}: CrowdDetailsProps) => {
  const isHighEnergy = mood === 'ecstatic' || mood === 'enthusiastic';
  const showCrowdSurfer = isHighEnergy && genreVisuals.enableCirclePit;
  const showBandSigns = attendancePercent > 50;
  const showSecurityGuards = attendancePercent > 60;
  const showPhotographers = attendancePercent > 40;
  const showBeachBalls = mood === 'ecstatic' && songEnergy === 'high';

  // Generate crowd-held signs
  const signs = useMemo(() => {
    if (!showBandSigns) return [];
    const count = Math.floor(attendancePercent / 25);
    return Array.from({ length: count }, (_, i) => ({
      id: `sign-${i}`,
      left: 15 + Math.random() * 70,
      top: 30 + Math.random() * 40,
      text: ['WE ❤️ U', '🤘🔥', 'MARRY ME', '♪♫♪', '!!'][i % 5],
      rotation: (Math.random() - 0.5) * 20,
    }));
  }, [attendancePercent, showBandSigns]);

  // Security guard positions
  const securityPositions = useMemo(() => {
    if (!showSecurityGuards) return [];
    return [
      { id: 'sec-1', left: 5, top: 15 },
      { id: 'sec-2', left: 95, top: 15 },
      { id: 'sec-3', left: 50, top: 12 },
    ];
  }, [showSecurityGuards]);

  // Photographer positions (in pit)
  const photographerPositions = useMemo(() => {
    if (!showPhotographers) return [];
    return [
      { id: 'photo-1', left: 20, top: 8 },
      { id: 'photo-2', left: 80, top: 8 },
      { id: 'photo-3', left: 50, top: 6 },
    ];
  }, [showPhotographers]);

  // Beach balls (festival vibes)
  const beachBalls = useMemo(() => {
    if (!showBeachBalls) return [];
    return Array.from({ length: 3 }, (_, i) => ({
      id: `ball-${i}`,
      left: 25 + i * 25,
      top: 40 + Math.random() * 20,
      size: 8 + Math.random() * 4,
      hue: Math.random() * 360,
    }));
  }, [showBeachBalls]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[15]">
      {/* Security guards */}
      {securityPositions.map(sec => (
        <motion.div
          key={sec.id}
          className="absolute w-3 h-4 rounded-sm flex flex-col items-center"
          style={{ left: `${sec.left}%`, top: `${sec.top}%` }}
          animate={{ y: [0, -1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* Security vest */}
          <div className="w-3 h-3 bg-yellow-500 rounded-sm border border-yellow-600">
            <div className="text-[4px] text-center font-bold text-black">S</div>
          </div>
          {/* Head */}
          <div className="w-2 h-2 bg-amber-700 rounded-full -mt-3" />
        </motion.div>
      ))}

      {/* Photographers */}
      {photographerPositions.map(photo => (
        <motion.div
          key={photo.id}
          className="absolute flex flex-col items-center"
          style={{ left: `${photo.left}%`, top: `${photo.top}%` }}
        >
          {/* Camera flash */}
          <motion.div
            className="absolute w-4 h-4 bg-white rounded-full"
            style={{ filter: 'blur(4px)' }}
            animate={{
              opacity: [0, 0, 0, 1, 0],
              scale: [0.5, 0.5, 0.5, 1.5, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
          {/* Photographer body */}
          <div className="w-2 h-3 bg-zinc-800 rounded-sm" />
          {/* Camera */}
          <div className="w-2 h-1 bg-zinc-600 rounded-sm -mt-2 transform rotate-12" />
        </motion.div>
      ))}

      {/* Crowd-held signs */}
      {signs.map(sign => (
        <motion.div
          key={sign.id}
          className="absolute px-1 py-0.5 bg-white rounded text-[6px] font-bold text-black shadow-lg"
          style={{
            left: `${sign.left}%`,
            top: `${sign.top}%`,
            transform: `rotate(${sign.rotation}deg)`,
          }}
          animate={{
            y: isHighEnergy ? [-2, 2, -2] : [0, -1, 0],
            rotate: [sign.rotation - 5, sign.rotation + 5, sign.rotation - 5],
          }}
          transition={{
            duration: isHighEnergy ? 0.5 : 2,
            repeat: Infinity,
          }}
        >
          {sign.text}
        </motion.div>
      ))}

      {/* Beach balls */}
      {beachBalls.map(ball => (
        <motion.div
          key={ball.id}
          className="absolute rounded-full"
          style={{
            left: `${ball.left}%`,
            top: `${ball.top}%`,
            width: ball.size,
            height: ball.size,
            background: `conic-gradient(
              hsl(${ball.hue}, 80%, 60%) 0deg,
              hsl(${ball.hue + 120}, 80%, 60%) 120deg,
              hsl(${ball.hue + 240}, 80%, 60%) 240deg,
              hsl(${ball.hue}, 80%, 60%) 360deg
            )`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
          animate={{
            x: [-20, 20, -20],
            y: [-5, 5, -5],
            rotate: [0, 360],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* Crowd surfer (metal/punk) */}
      {showCrowdSurfer && (
        <motion.div
          className="absolute"
          style={{ top: '35%' }}
          initial={{ left: '-10%' }}
          animate={{ left: '110%' }}
          transition={{
            duration: 8,
            repeat: Infinity,
            repeatDelay: 15,
            ease: 'linear',
          }}
        >
          {/* Person being crowd surfed */}
          <div className="relative">
            <div className="w-6 h-2 bg-zinc-700 rounded-full transform rotate-12" />
            <div className="absolute -left-1 top-0 w-2 h-2 bg-amber-600 rounded-full" />
            {/* Raised arms */}
            <motion.div
              className="absolute -top-2 left-1 w-1 h-3 bg-amber-500 rounded-full origin-bottom"
              animate={{ rotate: [-20, 20, -20] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
          </div>
        </motion.div>
      )}

      {/* Band merchandise in crowd (t-shirts visible) */}
      <div className="absolute bottom-[20%] left-[10%] right-[10%] flex justify-around opacity-60">
        {Array.from({ length: Math.ceil(attendancePercent / 20) }).map((_, i) => (
          <motion.div
            key={`merch-${i}`}
            className="w-2 h-2 rounded-sm"
            style={{
              background: `hsl(${genreVisuals.primaryHue}, 70%, ${30 + Math.random() * 20}%)`,
            }}
            animate={{
              y: isHighEnergy ? [0, -3, 0] : [0, -1, 0],
            }}
            transition={{
              duration: isHighEnergy ? 0.4 : 1.5,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>

      {/* Crowd wristbands/glow sticks (EDM) */}
      {genreVisuals.lightingStyle === 'strobe' && (
        <div className="absolute bottom-[30%] left-[15%] right-[15%]">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`glow-${i}`}
              className="absolute w-1 h-3 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: `hsl(${Math.random() * 360}, 100%, 60%)`,
                boxShadow: `0 0 8px hsl(${Math.random() * 360}, 100%, 60%)`,
              }}
              animate={{
                opacity: [0.3, 1, 0.3],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      )}

      {/* Front row pressed against barrier */}
      <div className="absolute top-[8%] left-[10%] right-[10%] flex justify-center gap-1">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={`front-${i}`}
            className="w-2 h-3 rounded-t-full bg-zinc-600"
            animate={{
              y: isHighEnergy ? [-1, 1, -1] : [0],
              scale: isHighEnergy ? [1, 1.1, 1] : [1],
            }}
            transition={{
              duration: 0.3,
              repeat: Infinity,
              delay: i * 0.05,
            }}
          >
            {/* Raised arms for front row */}
            {isHighEnergy && (
              <motion.div
                className="absolute -top-2 left-1/2 w-0.5 h-2 bg-amber-500 rounded-full"
                animate={{ rotate: [-15, 15, -15] }}
                transition={{ duration: 0.2, repeat: Infinity }}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
