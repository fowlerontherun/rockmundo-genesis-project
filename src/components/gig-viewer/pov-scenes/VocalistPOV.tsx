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
  const isIntense = intensity > 0.6;
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - crowd view from center stage */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, #06060a 0%, #12121c 40%, #1e1e2a 100%)',
        }}
      />
      
      {/* Overexposed stage lights - MTV2 high contrast */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-56"
        animate={{
          opacity: [0.5, 0.85, 0.5],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,220,150,0.4) 35%, transparent 70%)',
          filter: 'blur(25px)',
        }}
      />
      <motion.div
        className="absolute top-8 left-8 w-36 h-36"
        animate={{
          opacity: [0.4, 0.65, 0.4],
        }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
        style={{
          background: 'radial-gradient(circle, rgba(255,80,80,0.5) 0%, transparent 60%)',
          filter: 'blur(15px)',
        }}
      />
      <motion.div
        className="absolute top-8 right-8 w-36 h-36"
        animate={{
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0.7 }}
        style={{
          background: 'radial-gradient(circle, rgba(80,80,255,0.5) 0%, transparent 60%)',
          filter: 'blur(15px)',
        }}
      />
      
      {/* Crowd - main view (dark silhouettes with phone lights) */}
      <div className="absolute inset-0">
        {/* Back crowd (far) */}
        <div className="absolute top-1/4 left-0 right-0 h-28 flex justify-around items-end opacity-45">
          {Array.from({ length: 45 }).map((_, i) => (
            <motion.div
              key={`back-${i}`}
              className="bg-black/70"
              animate={{
                y: crowdMood > 60 ? [0, -3, 0] : 0,
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: Math.random() * 0.4,
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
        <div className="absolute top-1/3 left-0 right-0 h-36 flex justify-around items-end opacity-65">
          {Array.from({ length: 35 }).map((_, i) => {
            const hasHandUp = Math.random() > 0.55 && crowdMood > 50;
            const hasPhone = Math.random() > 0.82;
            return (
              <motion.div
                key={`mid-${i}`}
                className="relative"
                animate={{
                  y: crowdMood > 50 ? [0, -5, 0] : [0, -2, 0],
                }}
                transition={{
                  duration: 0.35 + Math.random() * 0.2,
                  repeat: Infinity,
                  delay: Math.random() * 0.35,
                }}
              >
                <div
                  className="bg-black/75 rounded-t-full"
                  style={{
                    width: 10 + Math.random() * 6,
                    height: 18 + Math.random() * 12,
                  }}
                />
                {hasHandUp && (
                  <motion.div
                    className="absolute -top-10 left-1/2 w-1.5 h-10 bg-black/65 rounded-full"
                    animate={{ rotate: [-18, 18, -18] }}
                    transition={{ duration: 0.35, repeat: Infinity }}
                    style={{ transformOrigin: 'bottom center' }}
                  />
                )}
                {hasPhone && (
                  <motion.div
                    className="absolute -top-12 left-1/2 w-2.5 h-4 rounded-sm"
                    animate={{ 
                      opacity: [0.4, 1, 0.4],
                      boxShadow: ['0 0 5px #3b82f6', '0 0 12px #3b82f6', '0 0 5px #3b82f6'],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() * 1.5 }}
                    style={{ background: '#3b82f6' }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
        
        {/* Front crowd (closest) */}
        <div className="absolute bottom-28 left-0 right-0 h-44 flex justify-around items-end opacity-85">
          {Array.from({ length: 22 }).map((_, i) => {
            const isExcited = crowdMood > 70 && Math.random() > 0.35;
            return (
              <motion.div
                key={`front-${i}`}
                className="relative"
                animate={{
                  y: isExcited ? [0, -10, 0] : [0, -4, 0],
                  scale: isExcited ? [1, 1.06, 1] : 1,
                }}
                transition={{
                  duration: 0.25 + Math.random() * 0.15,
                  repeat: Infinity,
                  delay: Math.random() * 0.25,
                }}
              >
                {/* Head */}
                <div
                  className="bg-black/85 rounded-full"
                  style={{
                    width: 14 + Math.random() * 8,
                    height: 14 + Math.random() * 8,
                  }}
                />
                {/* Reaching hands toward stage */}
                {isExcited && (
                  <>
                    <motion.div
                      className="absolute -top-12 left-0 w-2 h-14 bg-black/75 rounded-full"
                      animate={{ rotate: [-25, 25, -25] }}
                      transition={{ duration: 0.25, repeat: Infinity }}
                      style={{ transformOrigin: 'bottom center' }}
                    />
                    <motion.div
                      className="absolute -top-12 right-0 w-2 h-14 bg-black/75 rounded-full"
                      animate={{ rotate: [25, -25, 25] }}
                      transition={{ duration: 0.25, repeat: Infinity, delay: 0.08 }}
                      style={{ transformOrigin: 'bottom center' }}
                    />
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Phone lights scattered in crowd */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={`light-${i}`}
            className="absolute w-2.5 h-2.5 rounded-full"
            animate={{
              opacity: [0.3, 0.9, 0.3],
              scale: [0.8, 1.3, 0.8],
            }}
            transition={{
              duration: 1.2 + Math.random() * 0.8,
              repeat: Infinity,
              delay: Math.random() * 2.5,
            }}
            style={{
              top: `${22 + Math.random() * 42}%`,
              left: `${Math.random() * 100}%`,
              background: '#fff',
              filter: 'blur(2px)',
              boxShadow: '0 0 8px rgba(255,255,255,0.8)',
            }}
          />
        ))}
      </div>
      
      {/* Microphone and hand - CENTER FOCUS */}
      <motion.div
        className="absolute bottom-14 left-1/2 -translate-x-1/2"
        animate={{
          y: isReaching ? -50 : 0,
          rotate: isReaching ? [-6, 6, -6] : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Hand holding mic with visible sleeve */}
        <motion.div
          className="relative"
          animate={{
            x: isIntense ? [0, 6, -6, 0] : 0,
          }}
          transition={{ duration: 0.4, repeat: Infinity }}
        >
          {/* Sleeve/jacket cuff */}
          <div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-28 h-16"
            style={{
              background: 'linear-gradient(to top, #1a1a1a 0%, #2a2a2a 80%, transparent 100%)',
              borderRadius: '0 0 40% 40%',
            }}
          />
          {/* Wristband */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-14 h-4 rounded"
            style={{
              background: 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)',
              border: '1px solid #444',
            }}
          >
            {/* Studs */}
            <div className="flex justify-around items-center h-full">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              ))}
            </div>
          </div>
          
          {/* Hand */}
          <div
            className="w-24 h-16"
            style={{
              background: 'linear-gradient(to top, #c9a07a 0%, #b8916b 100%)',
              borderRadius: '50% 50% 40% 40%',
              boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
            }}
          />
          {/* Thumb visible */}
          <div
            className="absolute top-4 -left-3 w-6 h-10 rounded-full"
            style={{
              background: 'linear-gradient(to right, #c9a07a 0%, #b8916b 100%)',
              transform: 'rotate(-20deg)',
            }}
          />
          
          {/* Microphone */}
          <div className="absolute -top-28 left-1/2 -translate-x-1/2">
            {/* Mic head - detailed grille */}
            <div
              className="w-12 h-16 rounded-t-full"
              style={{
                background: 'linear-gradient(to right, #3a3a3a 0%, #5a5a5a 50%, #3a3a3a 100%)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              {/* Grille pattern */}
              <div
                className="w-full h-full rounded-t-full opacity-70"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #222 2px, #222 4px)',
                }}
              />
              {/* Highlight */}
              <div
                className="absolute top-2 left-2 w-3 h-6 rounded-full opacity-30"
                style={{ background: 'linear-gradient(to bottom, #fff 0%, transparent 100%)' }}
              />
            </div>
            {/* Mic body */}
            <div
              className="w-7 h-10 mx-auto"
              style={{
                background: 'linear-gradient(to right, #1a1a1a 0%, #3a3a3a 50%, #1a1a1a 100%)',
              }}
            />
            {/* Cable visible */}
            <div
              className="w-3 h-6 mx-auto rounded-b-full"
              style={{
                background: '#111',
              }}
            />
          </div>
        </motion.div>
      </motion.div>
      
      {/* Other hand (reaching out when clipType is crowd_look) */}
      {isReaching && (
        <motion.div
          className="absolute bottom-36 left-1/4"
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: -60, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Sleeve */}
          <div
            className="absolute -left-12 top-0 w-20 h-14"
            style={{
              background: 'linear-gradient(to right, #1a1a1a 0%, #2a2a2a 70%, transparent 100%)',
              borderRadius: '0 30% 30% 0',
            }}
          />
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 0.4, repeat: Infinity }}
            style={{
              width: 90,
              height: 35,
              background: 'linear-gradient(to left, #c9a07a 0%, #b8916b 70%, transparent 100%)',
              borderRadius: '50%',
              transform: 'rotate(-22deg)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
          />
          {/* Fingers spread */}
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              animate={{
                y: [0, -8, 0],
              }}
              transition={{ duration: 0.35, repeat: Infinity, delay: i * 0.05 }}
              style={{
                width: 8,
                height: 20,
                background: 'linear-gradient(to top, #c9a07a 0%, #a8816b 100%)',
                top: -15 + i * 2,
                left: 40 + i * 12,
                transform: `rotate(${-30 + i * 10}deg)`,
              }}
            />
          ))}
        </motion.div>
      )}
      
      {/* Stage monitors below */}
      <div className="absolute bottom-0 left-0 right-0 h-24">
        <div className="absolute bottom-4 left-1/4 w-36 h-14 bg-black/85 rounded transform -skew-x-6">
          <div className="absolute top-2 left-2 right-2 h-2 bg-green-500/30 rounded" />
        </div>
        <div className="absolute bottom-4 right-1/4 w-36 h-14 bg-black/85 rounded transform skew-x-6">
          <div className="absolute top-2 left-2 right-2 h-2 bg-green-500/30 rounded" />
        </div>
      </div>
      
      {/* Spotlight from above - overexposed center */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-3/4"
        animate={{
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{ duration: 2.5, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(255,220,150,0.5) 0%, rgba(255,200,100,0.2) 40%, transparent 70%)',
        }}
      />
      
      {/* Intro specific - walking in from side */}
      {isIntro && (
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.5 }}
        />
      )}
      
      {/* Outro specific - confetti and cheering */}
      {isOutro && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Extra excited crowd effect */}
          <motion.div
            className="absolute inset-0"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />
        </motion.div>
      )}
    </div>
  );
});

VocalistPOV.displayName = 'VocalistPOV';
