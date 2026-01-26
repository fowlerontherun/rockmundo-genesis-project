import { memo } from 'react';
import { motion } from 'framer-motion';

interface VocalistPOVProps {
  intensity: number;
  songSection: string;
  clipType: string;
  crowdMood: number;
}

export const VocalistPOV = memo(({ intensity, songSection, clipType, crowdMood }: VocalistPOVProps) => {
  const isReaching = clipType === 'crowd_look';
  const isIntro = clipType === 'intro';
  const isOutro = clipType === 'outro';
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - crowd view from center stage */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, #0a0a12 0%, #1a1a28 40%, #252535 100%)',
        }}
      />
      
      {/* Crowd - main view */}
      <div className="absolute inset-0">
        {/* Back crowd (far) */}
        <div className="absolute top-1/4 left-0 right-0 h-24 flex justify-around items-end opacity-40">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={`back-${i}`}
              className="bg-black/60"
              animate={{
                y: crowdMood > 60 ? [0, -2, 0] : 0,
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: Math.random() * 0.5,
              }}
              style={{
                width: 6 + Math.random() * 4,
                height: 12 + Math.random() * 8,
                borderRadius: '50% 50% 0 0',
              }}
            />
          ))}
        </div>
        
        {/* Middle crowd */}
        <div className="absolute top-1/3 left-0 right-0 h-32 flex justify-around items-end opacity-60">
          {Array.from({ length: 30 }).map((_, i) => {
            const hasHandUp = Math.random() > 0.6 && crowdMood > 50;
            const hasPhone = Math.random() > 0.85;
            return (
              <motion.div
                key={`mid-${i}`}
                className="relative"
                animate={{
                  y: crowdMood > 50 ? [0, -4, 0] : [0, -1, 0],
                }}
                transition={{
                  duration: 0.4 + Math.random() * 0.2,
                  repeat: Infinity,
                  delay: Math.random() * 0.4,
                }}
              >
                <div
                  className="bg-black/70 rounded-t-full"
                  style={{
                    width: 10 + Math.random() * 6,
                    height: 18 + Math.random() * 12,
                  }}
                />
                {hasHandUp && (
                  <motion.div
                    className="absolute -top-8 left-1/2 w-1 h-8 bg-black/60 rounded-full"
                    animate={{ rotate: [-15, 15, -15] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                    style={{ transformOrigin: 'bottom center' }}
                  />
                )}
                {hasPhone && (
                  <motion.div
                    className="absolute -top-10 left-1/2 w-2 h-3 bg-blue-400/80"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 2 }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
        
        {/* Front crowd (closest) */}
        <div className="absolute bottom-24 left-0 right-0 h-40 flex justify-around items-end opacity-80">
          {Array.from({ length: 20 }).map((_, i) => {
            const isExcited = crowdMood > 70 && Math.random() > 0.4;
            return (
              <motion.div
                key={`front-${i}`}
                className="relative"
                animate={{
                  y: isExcited ? [0, -8, 0] : [0, -3, 0],
                  scale: isExcited ? [1, 1.05, 1] : 1,
                }}
                transition={{
                  duration: 0.3 + Math.random() * 0.2,
                  repeat: Infinity,
                  delay: Math.random() * 0.3,
                }}
              >
                {/* Head */}
                <div
                  className="bg-black/80 rounded-full"
                  style={{
                    width: 14 + Math.random() * 8,
                    height: 14 + Math.random() * 8,
                  }}
                />
                {/* Reaching hands */}
                {isExcited && (
                  <>
                    <motion.div
                      className="absolute -top-10 left-0 w-1.5 h-12 bg-black/70 rounded-full"
                      animate={{ rotate: [-20, 20, -20] }}
                      transition={{ duration: 0.3, repeat: Infinity }}
                      style={{ transformOrigin: 'bottom center' }}
                    />
                    <motion.div
                      className="absolute -top-10 right-0 w-1.5 h-12 bg-black/70 rounded-full"
                      animate={{ rotate: [20, -20, 20] }}
                      transition={{ duration: 0.3, repeat: Infinity, delay: 0.1 }}
                      style={{ transformOrigin: 'bottom center' }}
                    />
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Phone lights in crowd */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={`light-${i}`}
            className="absolute w-2 h-2 bg-white rounded-full"
            animate={{
              opacity: [0.3, 0.8, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1.5 + Math.random(),
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
            style={{
              top: `${25 + Math.random() * 40}%`,
              left: `${Math.random() * 100}%`,
              filter: 'blur(1px)',
            }}
          />
        ))}
      </div>
      
      {/* Microphone and hand */}
      <motion.div
        className="absolute bottom-16 left-1/2 -translate-x-1/2"
        animate={{
          y: isReaching ? -40 : 0,
          rotate: isReaching ? [-5, 5, -5] : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Hand holding mic */}
        <motion.div
          className="relative"
          animate={{
            x: intensity > 0.7 ? [0, 5, -5, 0] : 0,
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          {/* Hand */}
          <div
            className="w-20 h-14"
            style={{
              background: 'linear-gradient(to top, #d4a574 0%, #c4956a 100%)',
              borderRadius: '50% 50% 40% 40%',
            }}
          />
          {/* Microphone */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2">
            {/* Mic head */}
            <div
              className="w-10 h-14 rounded-t-full"
              style={{
                background: 'linear-gradient(to right, #444 0%, #666 50%, #444 100%)',
              }}
            >
              {/* Grille pattern */}
              <div
                className="w-full h-full rounded-t-full opacity-60"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #333 2px, #333 4px)',
                }}
              />
            </div>
            {/* Mic body */}
            <div
              className="w-6 h-8 mx-auto"
              style={{
                background: 'linear-gradient(to right, #222 0%, #444 50%, #222 100%)',
              }}
            />
          </div>
        </motion.div>
      </motion.div>
      
      {/* Other hand (reaching out when clipType is crowd_look) */}
      {isReaching && (
        <motion.div
          className="absolute bottom-32 left-1/4"
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: -50, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            style={{
              width: 80,
              height: 30,
              background: 'linear-gradient(to left, #d4a574 0%, transparent 100%)',
              borderRadius: '50%',
              transform: 'rotate(-20deg)',
            }}
          />
        </motion.div>
      )}
      
      {/* Stage monitors below */}
      <div className="absolute bottom-0 left-0 right-0 h-20">
        <div className="absolute bottom-4 left-1/4 w-32 h-12 bg-black/80 rounded" />
        <div className="absolute bottom-4 right-1/4 w-32 h-12 bg-black/80 rounded" />
      </div>
      
      {/* Spotlight from above */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-2/3"
        animate={{
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 3, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(255,220,150,0.4) 0%, transparent 70%)',
        }}
      />
      
      {/* Intro specific - walking in from side */}
      {isIntro && (
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2 }}
        />
      )}
      
      {/* Outro specific - confetti and cheering */}
      {isOutro && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Extra excited crowd */}
          <motion.div
            className="absolute inset-0"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        </motion.div>
      )}
    </div>
  );
});

VocalistPOV.displayName = 'VocalistPOV';
