import { memo } from 'react';
import { motion } from 'framer-motion';

interface CrowdPOVProps {
  intensity: number;
  crowdMood: number;
  venueSize: 'small' | 'medium' | 'large';
  clipVariant: 'C1' | 'C2';
}

export const CrowdPOV = memo(({ intensity, crowdMood, venueSize, clipVariant }: CrowdPOVProps) => {
  const isSmallVenue = clipVariant === 'C1' || venueSize === 'small';
  const crowdCount = isSmallVenue ? { back: 25, mid: 18, front: 12 } : { back: 50, mid: 35, front: 25 };
  const isEnergetic = intensity > 0.5 || crowdMood > 60;
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - dark venue with stage light bleed */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, #040408 0%, #0a0a12 40%, #12121a 100%)',
        }}
      />
      
      {/* Overexposed stage lights - MTV2 aesthetic */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1/2"
        animate={{
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(255,255,255,0.6) 0%, rgba(255,200,100,0.3) 30%, transparent 70%)',
          filter: 'blur(30px)',
        }}
      />
      
      {/* Side stage lights */}
      <motion.div
        className="absolute bottom-0 left-0 w-1/3 h-2/3"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
        style={{
          background: 'radial-gradient(ellipse at bottom left, rgba(255,50,50,0.4) 0%, transparent 60%)',
          filter: 'blur(20px)',
        }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-1/3 h-2/3"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
        style={{
          background: 'radial-gradient(ellipse at bottom right, rgba(50,50,255,0.4) 0%, transparent 60%)',
          filter: 'blur(20px)',
        }}
      />
      
      {/* Back crowd - silhouettes */}
      <div 
        className="absolute left-0 right-0 flex justify-around items-end"
        style={{ top: isSmallVenue ? '15%' : '8%', height: '25%', opacity: 0.5 }}
      >
        {Array.from({ length: crowdCount.back }).map((_, i) => (
          <motion.div
            key={`back-${i}`}
            className="bg-black/80 rounded-t-full"
            animate={{
              y: isEnergetic ? [0, -3, 0] : 0,
            }}
            transition={{
              duration: 0.5 + Math.random() * 0.2,
              repeat: Infinity,
              delay: Math.random() * 0.4,
            }}
            style={{
              width: 6 + Math.random() * 4,
              height: 10 + Math.random() * 8,
            }}
          />
        ))}
      </div>
      
      {/* Middle crowd */}
      <div 
        className="absolute left-0 right-0 flex justify-around items-end"
        style={{ top: isSmallVenue ? '35%' : '25%', height: '30%', opacity: 0.7 }}
      >
        {Array.from({ length: crowdCount.mid }).map((_, i) => {
          const hasHandUp = Math.random() > 0.5 && isEnergetic;
          const hasPhone = Math.random() > 0.88;
          return (
            <motion.div
              key={`mid-${i}`}
              className="relative"
              animate={{
                y: isEnergetic ? [0, -5, 0] : [0, -2, 0],
              }}
              transition={{
                duration: 0.35 + Math.random() * 0.2,
                repeat: Infinity,
                delay: Math.random() * 0.35,
              }}
            >
              {/* Head */}
              <div
                className="bg-black/85 rounded-t-full"
                style={{
                  width: 10 + Math.random() * 6,
                  height: 16 + Math.random() * 10,
                }}
              />
              {/* Arms up */}
              {hasHandUp && (
                <>
                  <motion.div
                    className="absolute -top-10 left-0 w-1.5 h-12 bg-black/75 rounded-full"
                    animate={{ rotate: [-20, 20, -20] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                    style={{ transformOrigin: 'bottom center' }}
                  />
                  <motion.div
                    className="absolute -top-10 right-0 w-1.5 h-12 bg-black/75 rounded-full"
                    animate={{ rotate: [20, -20, 20] }}
                    transition={{ duration: 0.3, repeat: Infinity, delay: 0.1 }}
                    style={{ transformOrigin: 'bottom center' }}
                  />
                </>
              )}
              {/* Phone light */}
              {hasPhone && (
                <motion.div
                  className="absolute -top-14 left-1/2 -translate-x-1/2 w-2 h-3 rounded-sm"
                  animate={{ 
                    opacity: [0.4, 1, 0.4],
                    boxShadow: ['0 0 4px #3b82f6', '0 0 10px #3b82f6', '0 0 4px #3b82f6'],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() * 2 }}
                  style={{ background: '#3b82f6' }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Front crowd - closest, most detailed */}
      <div 
        className="absolute left-0 right-0 flex justify-around items-end"
        style={{ bottom: isSmallVenue ? '8%' : '5%', height: '40%', opacity: 0.9 }}
      >
        {Array.from({ length: crowdCount.front }).map((_, i) => {
          const isExcited = isEnergetic && Math.random() > 0.3;
          return (
            <motion.div
              key={`front-${i}`}
              className="relative"
              animate={{
                y: isExcited ? [0, -12, 0] : [0, -4, 0],
                scale: isExcited ? [1, 1.05, 1] : 1,
              }}
              transition={{
                duration: 0.25 + Math.random() * 0.15,
                repeat: Infinity,
                delay: Math.random() * 0.2,
              }}
            >
              {/* Head - larger for foreground */}
              <div
                className="bg-black/90 rounded-full"
                style={{
                  width: 16 + Math.random() * 10,
                  height: 16 + Math.random() * 10,
                }}
              />
              {/* Reaching hands toward stage */}
              {isExcited && (
                <>
                  <motion.div
                    className="absolute -top-16 left-0 w-2.5 h-18 bg-black/80 rounded-full"
                    animate={{ rotate: [-30, 30, -30] }}
                    transition={{ duration: 0.2, repeat: Infinity }}
                    style={{ transformOrigin: 'bottom center' }}
                  />
                  <motion.div
                    className="absolute -top-16 right-0 w-2.5 h-18 bg-black/80 rounded-full"
                    animate={{ rotate: [30, -30, 30] }}
                    transition={{ duration: 0.2, repeat: Infinity, delay: 0.06 }}
                    style={{ transformOrigin: 'bottom center' }}
                  />
                </>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Scattered phone lights */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: isSmallVenue ? 8 : 20 }).map((_, i) => (
          <motion.div
            key={`phone-${i}`}
            className="absolute w-2 h-2 rounded-full"
            animate={{
              opacity: [0.3, 0.9, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1 + Math.random() * 1,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
            style={{
              top: `${20 + Math.random() * 50}%`,
              left: `${5 + Math.random() * 90}%`,
              background: '#fff',
              filter: 'blur(1px)',
              boxShadow: '0 0 6px rgba(255,255,255,0.8)',
            }}
          />
        ))}
      </div>
      
      {/* Haze/atmosphere */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{
          background: 'linear-gradient(to top, rgba(150,150,180,0.15) 0%, transparent 50%)',
        }}
      />
    </div>
  );
});

CrowdPOV.displayName = 'CrowdPOV';
