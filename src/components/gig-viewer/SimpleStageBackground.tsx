import { motion } from "framer-motion";

type StageTheme = 'indoor_night' | 'indoor_day' | 'outdoor_festival' | 'club' | 'arena' | 'theater';

interface SimpleStageBackgroundProps {
  crowdMood: number;
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
  stageTheme?: StageTheme;
  isNightShow?: boolean;
}

// Theme-specific color palettes
const themeColors: Record<StageTheme, { bg: string[]; floor: string; accent: string }> = {
  indoor_night: {
    bg: ['#1a0a2e', '#0d0d0d', '#000000'],
    floor: 'from-zinc-900 via-zinc-800/50',
    accent: 'bg-purple-500/20',
  },
  indoor_day: {
    bg: ['#2d3748', '#1a202c', '#0d1117'],
    floor: 'from-gray-700 via-gray-600/50',
    accent: 'bg-amber-500/20',
  },
  outdoor_festival: {
    bg: ['#1e3a5f', '#0f172a', '#000000'],
    floor: 'from-emerald-900/50 via-stone-800/50',
    accent: 'bg-green-500/20',
  },
  club: {
    bg: ['#2d0a4e', '#1a0a2e', '#000000'],
    floor: 'from-purple-950 via-purple-900/50',
    accent: 'bg-pink-500/30',
  },
  arena: {
    bg: ['#0f1729', '#0a0f1a', '#000000'],
    floor: 'from-slate-800 via-slate-700/50',
    accent: 'bg-blue-500/20',
  },
  theater: {
    bg: ['#2c1810', '#1a0f0a', '#000000'],
    floor: 'from-amber-950 via-stone-800/50',
    accent: 'bg-red-500/20',
  },
};

export const SimpleStageBackground = ({ 
  crowdMood, 
  songSection,
  stageTheme = 'indoor_night',
  isNightShow = true,
}: SimpleStageBackgroundProps) => {
  const isHighEnergy = crowdMood > 70;
  const isChorus = songSection === 'chorus';
  const isSolo = songSection === 'solo';
  const colors = themeColors[stageTheme];
  
  // Outdoor festival specific elements
  const isOutdoor = stageTheme === 'outdoor_festival';
  const isArena = stageTheme === 'arena';
  const isClub = stageTheme === 'club';
  const isTheater = stageTheme === 'theater';
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient background - varies by theme */}
      <motion.div 
        className="absolute inset-0"
        animate={{
          background: isHighEnergy 
            ? [
                `linear-gradient(180deg, ${colors.bg[0]} 0%, ${colors.bg[1]} 50%, ${colors.bg[2]} 100%)`,
                `linear-gradient(180deg, ${colors.bg[0]}ee 0%, ${colors.bg[0]} 50%, ${colors.bg[2]} 100%)`,
                `linear-gradient(180deg, ${colors.bg[0]} 0%, ${colors.bg[1]} 50%, ${colors.bg[2]} 100%)`,
              ]
            : `linear-gradient(180deg, ${colors.bg[1]} 0%, ${colors.bg[2]} 50%, ${colors.bg[2]} 100%)`
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Sky/ceiling - only for outdoor and arena */}
      {(isOutdoor || isArena) && (
        <div className="absolute top-0 left-0 right-0 h-[40%]">
          {isNightShow ? (
            <>
              {/* Stars for night shows */}
              <div className="absolute inset-0">
                {Array.from({ length: 30 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-0.5 h-0.5 bg-white rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 60}%`,
                    }}
                    animate={{
                      opacity: [0.3, 0.8, 0.3],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Daytime sky gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-sky-600/20 via-sky-800/10 to-transparent" />
              {/* Sun glow */}
              <motion.div
                className="absolute top-4 right-[20%] w-16 h-16 rounded-full bg-yellow-400/30 blur-xl"
                animate={{ opacity: [0.4, 0.6, 0.4] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
            </>
          )}
        </div>
      )}
      
      {/* Theater curtains */}
      {isTheater && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-red-950 via-red-900/80 to-transparent" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-red-950 via-red-900/80 to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-red-950 via-red-900/50 to-transparent" />
        </>
      )}
      
      {/* Club laser effects */}
      {isClub && isHighEnergy && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-[200%] w-0.5 bg-gradient-to-b from-transparent via-pink-500/60 to-transparent origin-top"
              style={{
                left: `${20 + i * 15}%`,
                top: 0,
              }}
              animate={{
                rotate: [-20, 20, -20],
              }}
              transition={{
                duration: 2 + i * 0.3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}
      
      {/* Stage floor with perspective */}
      <div 
        className={`absolute bottom-0 left-0 right-0 h-[35%] bg-gradient-to-t ${colors.floor} to-transparent`}
        style={{
          transform: 'perspective(500px) rotateX(25deg)',
          transformOrigin: 'bottom center',
        }}
      >
        {/* Floor grid lines for depth */}
        <div className="absolute inset-0 opacity-20">
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i}
              className="absolute left-0 right-0 h-px bg-white/30"
              style={{ 
                top: `${(i + 1) * 12}%`,
                opacity: 0.3 - (i * 0.03),
              }}
            />
          ))}
        </div>
        
        {/* Club floor lights */}
        {isClub && (
          <div className="absolute inset-0 flex justify-around items-center opacity-30">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-8 h-8 rounded-full blur-sm"
                style={{
                  background: `hsl(${(i * 45) % 360}, 80%, 50%)`,
                }}
                animate={{
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Outdoor festival stage structure */}
      {isOutdoor && (
        <>
          {/* Festival stage frame */}
          <div className="absolute top-8 left-4 right-4 h-4 bg-zinc-700/60 rounded-sm" />
          <div className="absolute top-0 left-4 w-3 h-32 bg-zinc-600/40" />
          <div className="absolute top-0 right-4 w-3 h-32 bg-zinc-600/40" />
          {/* LED screen behind stage */}
          <motion.div
            className="absolute top-12 left-[15%] right-[15%] h-[30%] bg-gradient-to-b from-blue-900/30 to-purple-900/20 rounded-lg"
            animate={{
              background: isHighEnergy
                ? [
                    'linear-gradient(45deg, rgba(59,130,246,0.3) 0%, rgba(168,85,247,0.2) 100%)',
                    'linear-gradient(45deg, rgba(168,85,247,0.3) 0%, rgba(239,68,68,0.2) 100%)',
                    'linear-gradient(45deg, rgba(59,130,246,0.3) 0%, rgba(168,85,247,0.2) 100%)',
                  ]
                : 'linear-gradient(45deg, rgba(59,130,246,0.2) 0%, rgba(168,85,247,0.1) 100%)',
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </>
      )}
      
      {/* Side curtains (for non-theater venues) */}
      {!isTheater && !isOutdoor && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black via-black/80 to-transparent" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black via-black/80 to-transparent" />
        </>
      )}
      
      {/* Stage truss silhouette at top (for indoor venues) */}
      {!isOutdoor && !isTheater && (
        <div className="absolute top-0 left-0 right-0 h-20">
          <div className="absolute inset-x-8 top-4 h-3 bg-zinc-800/60 rounded-sm" />
          <div className="absolute inset-x-12 top-8 h-2 bg-zinc-700/40 rounded-sm" />
          {/* Truss vertical supports */}
          <div className="absolute left-8 top-0 w-2 h-20 bg-zinc-800/40" />
          <div className="absolute right-8 top-0 w-2 h-20 bg-zinc-800/40" />
        </div>
      )}
      
      {/* Arena rigging and lights */}
      {isArena && (
        <div className="absolute top-0 left-0 right-0 h-24">
          {/* Center light rig */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 top-2 w-48 h-8 bg-zinc-800/80 rounded"
            animate={{
              boxShadow: isHighEnergy
                ? ['0 10px 40px rgba(255,255,255,0.2)', '0 10px 60px rgba(255,255,255,0.4)', '0 10px 40px rgba(255,255,255,0.2)']
                : '0 10px 30px rgba(255,255,255,0.1)',
            }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          {/* Moving head lights */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-6 w-6 h-6 rounded-full bg-white/20"
              style={{ left: `${15 + i * 14}%` }}
              animate={{
                opacity: isHighEnergy ? [0.3, 0.9, 0.3] : 0.3,
                scale: isChorus ? [1, 1.2, 1] : 1,
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      )}
      
      {/* Ambient particles during high energy moments */}
      {(isChorus || isSolo) && isHighEnergy && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-1 h-1 ${colors.accent} rounded-full`}
              initial={{ 
                x: Math.random() * 100 + '%',
                y: '100%',
                opacity: 0,
              }}
              animate={{
                y: '-20%',
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      )}
      
      {/* Fog/haze effect at bottom */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/5 to-transparent pointer-events-none"
        animate={{
          opacity: isChorus ? [0.3, 0.5, 0.3] : 0.2,
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      
      {/* Venue name indicator */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/40 backdrop-blur-sm rounded-full">
        <span className="text-[10px] text-white/50 uppercase tracking-wider">
          {stageTheme.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
};