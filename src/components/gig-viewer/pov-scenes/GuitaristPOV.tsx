import { memo } from 'react';
import { motion } from 'framer-motion';

interface GuitaristPOVProps {
  intensity: number;
  songSection: string;
  clipType: string;
  guitarSkin?: 'default' | 'red' | 'black' | 'sunburst' | 'white';
}

export const GuitaristPOV = memo(({ intensity, songSection, clipType, guitarSkin = 'default' }: GuitaristPOVProps) => {
  const isSolo = songSection === 'solo' || clipType === 'solo_focus';
  const isLookingUp = clipType === 'crowd_look';
  const isStrumming = intensity > 0.4;
  
  // Guitar skin colors
  const guitarColors = {
    default: { body: '#2a1810', highlight: '#4a2c17', pickguard: '#1a1a1a' },
    red: { body: '#8b1a1a', highlight: '#c42424', pickguard: '#111' },
    black: { body: '#1a1a1a', highlight: '#333', pickguard: '#0a0a0a' },
    sunburst: { body: '#8b4513', highlight: '#daa520', pickguard: '#1a1a1a' },
    white: { body: '#f5f5f0', highlight: '#fff', pickguard: '#1a1a1a' },
  };
  
  const colors = guitarColors[guitarSkin];
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - blurred stage/crowd with overexposed highlights */}
      <motion.div
        className="absolute inset-0"
        animate={{
          filter: isLookingUp ? 'blur(0px)' : 'blur(12px)',
        }}
        style={{
          background: 'linear-gradient(to top, #0a0a12 0%, #12121e 50%, #08080f 100%)',
        }}
      />
      
      {/* Overexposed stage light hotspots */}
      <motion.div
        className="absolute top-0 right-1/4 w-48 h-48"
        animate={{
          opacity: [0.4, 0.7, 0.4],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,220,150,0.3) 30%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <motion.div
        className="absolute top-10 left-1/3 w-32 h-32"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        style={{
          background: 'radial-gradient(circle, rgba(255,100,100,0.5) 0%, transparent 60%)',
          filter: 'blur(15px)',
        }}
      />
      
      {/* Crowd silhouettes (visible when looking up) */}
      {isLookingUp && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
        >
          <div className="absolute bottom-1/3 left-0 right-0 flex justify-around">
            {Array.from({ length: 25 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-black/70 rounded-t-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.35, repeat: Infinity, delay: i * 0.04 }}
                style={{ width: 12 + Math.random() * 8, height: 25 + Math.random() * 15 }}
              />
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Guitar fretboard - lower portion of frame */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: isLookingUp ? '25%' : '50%' }}
        animate={{
          y: isLookingUp ? 60 : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Guitar body edge visible */}
        <div
          className="absolute bottom-0 right-0 w-48 h-32"
          style={{
            background: `linear-gradient(135deg, ${colors.body} 0%, ${colors.highlight} 50%, ${colors.body} 100%)`,
            borderRadius: '60% 0 0 0',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)',
          }}
        >
          {/* Pickguard */}
          <div
            className="absolute top-4 left-8 w-24 h-20"
            style={{
              background: colors.pickguard,
              borderRadius: '30% 70% 40% 60%',
            }}
          />
          {/* Pickup */}
          <div className="absolute top-10 left-12 w-16 h-4 bg-black/80 rounded">
            <div className="flex justify-around items-center h-full px-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-1 h-2 bg-gray-600 rounded-full" />
              ))}
            </div>
          </div>
          {/* Volume/tone knobs */}
          <div className="absolute bottom-4 right-8 flex gap-3">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 border border-amber-500/50" />
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 border border-amber-500/50" />
          </div>
        </div>
        
        {/* Fretboard base */}
        <div
          className="absolute bottom-8 left-0 right-1/3"
          style={{
            height: '80%',
            background: `linear-gradient(to right, #1a0f08 0%, #2d1810 50%, #1a0f08 100%)`,
            transform: 'perspective(600px) rotateX(55deg) rotate(-15deg)',
            transformOrigin: 'bottom left',
            boxShadow: '0 5px 20px rgba(0,0,0,0.5)',
          }}
        >
          {/* Frets - metal strips */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-1 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300"
              style={{
                left: 0,
                right: 0,
                top: `${(i + 1) * 9}%`,
                boxShadow: '0 1px 2px rgba(255,255,255,0.2)',
              }}
            />
          ))}
          
          {/* Strings - vibrating during play */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-0 bottom-0"
              animate={{
                x: isSolo || isStrumming ? [0, (Math.random() - 0.5) * 3, 0] : 0,
              }}
              transition={{
                duration: 0.04 + i * 0.005,
                repeat: (isSolo || isStrumming) ? Infinity : 0,
              }}
              style={{
                left: `${12 + i * 15}%`,
                width: 4 - i * 0.5,
                background: `linear-gradient(to bottom, 
                  rgba(200,200,200,0.9) 0%, 
                  rgba(180,180,180,0.8) 50%, 
                  rgba(160,160,160,0.9) 100%)`,
                boxShadow: '0 0 2px rgba(255,255,255,0.3)',
              }}
            />
          ))}
          
          {/* Fret markers - dot inlays */}
          <div className="absolute w-4 h-4 bg-white/50 rounded-full" style={{ top: '22%', left: '48%' }} />
          <div className="absolute w-4 h-4 bg-white/50 rounded-full" style={{ top: '45%', left: '48%' }} />
          <div className="absolute w-3 h-3 bg-white/40 rounded-full" style={{ top: '67%', left: '35%' }} />
          <div className="absolute w-3 h-3 bg-white/40 rounded-full" style={{ top: '67%', left: '62%' }} />
        </div>
      </motion.div>
      
      {/* Left hand on fretboard (fretting hand) */}
      <motion.div
        className="absolute bottom-36 left-20"
        animate={{
          y: isSolo ? [0, -8, 0, -5, 0] : [0, -2, 0],
          x: isSolo ? [0, 15, 0, 25, 0] : [0, 5, 0],
        }}
        transition={{
          duration: isSolo ? 0.25 : 0.5,
          repeat: Infinity,
        }}
      >
        {/* Jacket sleeve */}
        <div
          className="absolute -left-8 top-0 w-20 h-16"
          style={{
            background: 'linear-gradient(to right, #1a1a1a 0%, #2a2a2a 70%, transparent 100%)',
            borderRadius: '0 20% 20% 0',
          }}
        />
        {/* Wristband */}
        <div
          className="absolute -left-2 top-8 w-10 h-3 rounded"
          style={{
            background: 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)',
            border: '1px solid #444',
          }}
        />
        {/* Hand */}
        <div
          className="w-20 h-14"
          style={{
            background: 'linear-gradient(to bottom, #c9a07a 0%, #b8916b 100%)',
            borderRadius: '30% 50% 40% 40%',
            transform: 'rotate(-25deg)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        />
        {/* Fingers pressing frets */}
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            animate={{
              scaleY: isSolo ? [1, 0.85, 1] : 1,
            }}
            transition={{
              duration: 0.15,
              repeat: isSolo ? Infinity : 0,
              delay: i * 0.03,
            }}
            style={{
              width: 10,
              height: 18,
              background: 'linear-gradient(to bottom, #c9a07a 0%, #a8816b 100%)',
              top: 2 + i * 4,
              left: 30 + i * 10,
              transform: 'rotate(-55deg)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        ))}
      </motion.div>
      
      {/* Right hand (picking hand) */}
      <motion.div
        className="absolute right-16 bottom-28"
        animate={{
          y: isSolo ? [0, -8, 0, -5, 0] : isStrumming ? [0, -4, 0] : 0,
          rotate: isSolo ? [-8, 8, -8] : isStrumming ? [-4, 4, -4] : 0,
        }}
        transition={{
          duration: isSolo ? 0.12 : 0.25,
          repeat: Infinity,
        }}
      >
        {/* Sleeve visible */}
        <div
          className="absolute -right-6 -top-4 w-24 h-20"
          style={{
            background: 'linear-gradient(to left, #1a1a1a 0%, #2a2a2a 60%, transparent 100%)',
            borderRadius: '20% 0 0 20%',
          }}
        />
        {/* Wristband */}
        <div
          className="absolute right-12 top-4 w-10 h-3 rounded"
          style={{
            background: 'linear-gradient(to bottom, #8b0000 0%, #5a0000 100%)',
            border: '1px solid #aa0000',
          }}
        />
        {/* Hand */}
        <div
          className="w-28 h-18 rounded-lg"
          style={{
            background: 'linear-gradient(to bottom, #c9a07a 0%, #b8916b 100%)',
            borderRadius: '50% 50% 35% 35%',
            boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
          }}
        />
        {/* Pick flash on intense moments */}
        {intensity > 0.5 && (
          <motion.div
            className="absolute -top-1 right-4 w-4 h-5"
            animate={{ 
              opacity: [0.6, 1, 0.6],
              rotate: [40, 50, 40],
            }}
            transition={{ duration: 0.08, repeat: Infinity }}
            style={{ 
              background: 'linear-gradient(135deg, #ff8c00 0%, #ff6600 100%)',
              borderRadius: '50% 50% 20% 20%', 
              boxShadow: '0 0 8px rgba(255,140,0,0.6)',
            }}
          />
        )}
      </motion.div>
      
      {/* Spotlight glow from above - overexposed */}
      <motion.div
        className="absolute top-0 left-1/3 w-1/2 h-2/3"
        animate={{
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(255,220,150,0.5) 0%, rgba(255,200,100,0.2) 30%, transparent 70%)',
        }}
      />
      
      {/* Additional overexposed light burst */}
      <motion.div
        className="absolute top-8 right-8 w-24 h-24"
        animate={{
          opacity: [0.5, 0.8, 0.5],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 0.8, repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 50%)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
});

GuitaristPOV.displayName = 'GuitaristPOV';
