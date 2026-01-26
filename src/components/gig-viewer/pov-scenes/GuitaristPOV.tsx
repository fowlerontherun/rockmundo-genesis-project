import { memo } from 'react';
import { motion } from 'framer-motion';

interface GuitaristPOVProps {
  intensity: number;
  songSection: string;
  clipType: string;
}

export const GuitaristPOV = memo(({ intensity, songSection, clipType }: GuitaristPOVProps) => {
  const isSolo = songSection === 'solo' || clipType === 'solo_focus';
  const isLookingUp = clipType === 'crowd_look';
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - blurred stage/crowd */}
      <motion.div
        className="absolute inset-0"
        animate={{
          filter: isLookingUp ? 'blur(0px)' : 'blur(8px)',
        }}
        style={{
          background: 'linear-gradient(to top, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        }}
      />
      
      {/* Crowd silhouettes (visible when looking up) */}
      {isLookingUp && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        >
          <div className="absolute bottom-1/3 left-0 right-0 flex justify-around">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-black/60 rounded-t-full"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }}
                style={{ width: 15 + Math.random() * 10, height: 30 + Math.random() * 20 }}
              />
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Guitar fretboard - lower portion of frame */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: isLookingUp ? '20%' : '45%' }}
        animate={{
          y: isLookingUp ? 50 : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Fretboard base */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #2d1810 0%, #4a2c17 50%, #2d1810 100%)',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'bottom center',
          }}
        >
          {/* Frets */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-0.5 bg-gray-400/80"
              style={{
                left: 0,
                right: 0,
                top: `${(i + 1) * 12}%`,
              }}
            />
          ))}
          
          {/* Strings */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-0 bottom-0 bg-gradient-to-b from-gray-300 to-gray-500"
              animate={{
                x: isSolo ? [0, (Math.random() - 0.5) * 2, 0] : 0,
              }}
              transition={{
                duration: 0.05,
                repeat: isSolo ? Infinity : 0,
              }}
              style={{
                left: `${15 + i * 14}%`,
                width: 3 - i * 0.3,
              }}
            />
          ))}
          
          {/* Fret markers */}
          <div className="absolute w-3 h-3 bg-white/40 rounded-full" style={{ top: '25%', left: '48%' }} />
          <div className="absolute w-3 h-3 bg-white/40 rounded-full" style={{ top: '50%', left: '48%' }} />
          <div className="absolute w-2 h-2 bg-white/40 rounded-full" style={{ top: '72%', left: '35%' }} />
          <div className="absolute w-2 h-2 bg-white/40 rounded-full" style={{ top: '72%', left: '65%' }} />
        </div>
      </motion.div>
      
      {/* Picking hand (right side) */}
      <motion.div
        className="absolute right-8 bottom-32"
        animate={{
          y: isSolo ? [0, -5, 0, -3, 0] : [0, -2, 0],
          rotate: isSolo ? [-5, 5, -5] : [-2, 2, -2],
        }}
        transition={{
          duration: isSolo ? 0.2 : 0.4,
          repeat: Infinity,
        }}
      >
        {/* Hand silhouette */}
        <div
          className="w-24 h-16 rounded-lg"
          style={{
            background: 'linear-gradient(to bottom, #d4a574 0%, #c4956a 100%)',
            borderRadius: '50% 50% 30% 30%',
          }}
        />
        {/* Pick flash on intense moments */}
        {intensity > 0.6 && (
          <motion.div
            className="absolute top-0 right-2 w-3 h-4 bg-orange-400"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.1, repeat: Infinity }}
            style={{ borderRadius: '50% 50% 20% 20%', transform: 'rotate(45deg)' }}
          />
        )}
      </motion.div>
      
      {/* Sleeve (left edge) */}
      <div
        className="absolute left-0 bottom-0 w-20 h-48"
        style={{
          background: 'linear-gradient(to right, #1a1a1a 0%, #2a2a2a 70%, transparent 100%)',
        }}
      />
      
      {/* Spotlight glow from above */}
      <motion.div
        className="absolute top-0 left-1/3 w-1/3 h-1/2"
        animate={{
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(255,200,100,0.3) 0%, transparent 70%)',
        }}
      />
    </div>
  );
});

GuitaristPOV.displayName = 'GuitaristPOV';
