import { motion } from "framer-motion";
import { useMemo } from "react";

interface WeatherAtmosphereProps {
  venueType: string | null;
  songEnergy: 'high' | 'medium' | 'low';
  intensity: number;
}

export const WeatherAtmosphere = ({ venueType, songEnergy, intensity }: WeatherAtmosphereProps) => {
  const isOutdoor = venueType === 'outdoor' || venueType === 'festival_ground';
  if (!isOutdoor) return null;

  // Stars for nighttime outdoor/festival
  const stars = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 25, // top quarter only (sky area)
      size: 1 + Math.random() * 1.5,
      delay: Math.random() * 4,
      brightness: 0.3 + Math.random() * 0.7,
    }));
  }, []);

  // Wind streaks for festival
  const windStreaks = useMemo(() => {
    if (venueType !== 'festival_ground') return [];
    return Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      y: 10 + Math.random() * 20,
      delay: Math.random() * 3,
      width: 30 + Math.random() * 40,
    }));
  }, [venueType]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[1]">
      {/* Sky gradient for outdoor venues */}
      <div
        className="absolute top-0 left-0 right-0 h-[25%]"
        style={{
          background: venueType === 'festival_ground'
            ? 'linear-gradient(180deg, hsl(230, 30%, 8%) 0%, hsl(240, 25%, 12%) 50%, hsl(250, 20%, 15%) 100%)'
            : 'linear-gradient(180deg, hsl(220, 35%, 10%) 0%, hsl(230, 25%, 15%) 100%)',
        }}
      />

      {/* Moon for outdoor */}
      {venueType === 'outdoor' && (
        <div className="absolute top-[3%] right-[12%]">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: 'hsl(45, 30%, 85%)',
              boxShadow: '0 0 12px hsl(45, 30%, 70%), 0 0 30px hsl(45, 20%, 60%)',
            }}
          />
        </div>
      )}

      {/* Stars */}
      {stars.map(star => (
        <motion.div
          key={`star-${star.id}`}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            backgroundColor: `rgba(255, 255, 240, ${star.brightness})`,
          }}
          animate={{ opacity: [star.brightness, star.brightness * 0.4, star.brightness] }}
          transition={{
            duration: 2 + Math.random() * 3,
            repeat: Infinity,
            delay: star.delay,
          }}
        />
      ))}

      {/* Wind streaks (festival atmosphere) */}
      {windStreaks.map(streak => (
        <motion.div
          key={`wind-${streak.id}`}
          className="absolute h-[1px]"
          style={{
            top: `${streak.y}%`,
            width: `${streak.width}%`,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            delay: streak.delay,
            ease: 'linear',
          }}
        />
      ))}

      {/* Tree silhouettes for outdoor/festival edges */}
      {venueType === 'festival_ground' && (
        <>
          <div className="absolute bottom-0 left-0 w-[8%] h-[40%]">
            <svg viewBox="0 0 30 60" className="w-full h-full opacity-20" fill="currentColor">
              <polygon points="15,0 0,45 30,45" className="text-green-900" />
              <rect x="12" y="45" width="6" height="15" className="text-amber-900" />
            </svg>
          </div>
          <div className="absolute bottom-0 right-0 w-[6%] h-[35%]">
            <svg viewBox="0 0 30 60" className="w-full h-full opacity-15" fill="currentColor">
              <polygon points="15,5 2,48 28,48" className="text-green-900" />
              <rect x="12" y="48" width="6" height="12" className="text-amber-900" />
            </svg>
          </div>
        </>
      )}

      {/* Grass texture along bottom for outdoor */}
      {venueType === 'outdoor' && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[3%] opacity-30"
          style={{
            background: 'repeating-linear-gradient(90deg, transparent, transparent 3px, hsl(120, 30%, 20%) 3px, hsl(120, 30%, 20%) 4px)',
          }}
        />
      )}

      {/* Haze layer for all outdoor gigs */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[15%]"
        style={{
          background: 'linear-gradient(0deg, rgba(150,150,180,0.08) 0%, transparent 100%)',
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      {/* Distant city glow for outdoor */}
      {venueType === 'outdoor' && (
        <div
          className="absolute top-[20%] left-0 right-0 h-[5%]"
          style={{
            background: 'linear-gradient(0deg, rgba(255, 200, 100, 0.04), transparent)',
          }}
        />
      )}
    </div>
  );
};
