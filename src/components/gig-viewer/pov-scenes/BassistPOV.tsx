import { memo } from 'react';
import { motion } from 'framer-motion';

interface BassistPOVProps {
  intensity: number;
  songSection: string;
  clipType: string;
}

export const BassistPOV = memo(({ intensity, songSection, clipType }: BassistPOVProps) => {
  const isGrooving = intensity > 0.5;
  const isLookingUp = clipType === 'crowd_look';
  const isLookingAtDrummer = clipType === 'stage_scan';
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - stage view from bassist position */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        }}
      />
      
      {/* Drummer visible to the side when looking */}
      {isLookingAtDrummer && (
        <motion.div
          className="absolute top-1/4 right-1/4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
        >
          {/* Drum kit silhouette */}
          <div className="relative">
            <div className="w-24 h-16 bg-black/50 rounded-full" /> {/* Hi-hat */}
            <div className="absolute top-8 left-10 w-32 h-20 bg-black/60 rounded" /> {/* Drum set body */}
            <motion.div
              className="absolute -top-4 left-8 w-4 h-16 bg-black/40 rounded"
              animate={{ rotate: [-10, 10, -10] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            /> {/* Stick */}
          </div>
        </motion.div>
      )}
      
      {/* Crowd glimpse when looking up */}
      {isLookingUp && (
        <motion.div
          className="absolute top-16 left-0 right-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        >
          <div className="flex justify-around">
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-black/60 rounded-t-full"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
                style={{ width: 12 + Math.random() * 8, height: 20 + Math.random() * 15 }}
              />
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Amp stack to the right */}
      <div className="absolute right-4 top-1/3 bottom-20">
        <div className="w-28 h-full flex flex-col gap-1">
          {/* Amp head */}
          <div
            className="w-full h-12 rounded-t"
            style={{
              background: 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)',
            }}
          >
            <div className="flex justify-around pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-amber-500/60" />
              ))}
            </div>
          </div>
          {/* Cab speakers */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="w-full h-24"
              style={{
                background: 'linear-gradient(to bottom, #1a1a1a 0%, #0a0a0a 100%)',
              }}
            >
              <div className="grid grid-cols-2 gap-1 p-2 h-full">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div
                    key={j}
                    className="rounded-full"
                    style={{
                      background: 'radial-gradient(circle, #333 0%, #111 100%)',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Bass guitar - diagonal across frame */}
      <motion.div
        className="absolute bottom-0 left-0 right-1/3"
        style={{ height: isLookingUp ? '25%' : '50%' }}
        animate={{
          y: isLookingUp ? 60 : 0,
          rotate: isLookingUp ? 10 : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Bass neck */}
        <div
          className="absolute bottom-0 left-10 w-16 h-full"
          style={{
            background: 'linear-gradient(to right, #3d2817 0%, #5a3d24 50%, #3d2817 100%)',
            transform: 'perspective(400px) rotateX(55deg) rotate(-25deg)',
            transformOrigin: 'bottom left',
          }}
        >
          {/* Frets */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-0.5 bg-gray-400/70"
              style={{ top: `${(i + 1) * 15}%` }}
            />
          ))}
          
          {/* Strings */}
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-0 bottom-0 bg-gradient-to-b from-gray-300 to-gray-500"
              animate={{
                x: isGrooving ? [0, (Math.random() - 0.5) * 1.5, 0] : 0,
              }}
              transition={{
                duration: 0.08,
                repeat: isGrooving ? Infinity : 0,
              }}
              style={{
                left: `${20 + i * 18}%`,
                width: 4 - i * 0.5,
              }}
            />
          ))}
          
          {/* Fret markers */}
          <div className="absolute w-3 h-3 bg-white/40 rounded-full" style={{ top: '30%', left: '45%' }} />
          <div className="absolute w-3 h-3 bg-white/40 rounded-full" style={{ top: '60%', left: '45%' }} />
        </div>
        
        {/* Bass body edge visible */}
        <div
          className="absolute bottom-0 left-0 w-32 h-24"
          style={{
            background: 'linear-gradient(to top, #1a0a0a 0%, #3a1a1a 100%)',
            borderRadius: '0 30% 0 0',
          }}
        />
      </motion.div>
      
      {/* Fretting hand (left) */}
      <motion.div
        className="absolute bottom-40 left-16"
        animate={{
          y: isGrooving ? [0, -3, 0, -2, 0] : [0, -1, 0],
          x: isGrooving ? [0, 5, 0, 8, 0] : [0, 2, 0],
        }}
        transition={{
          duration: isGrooving ? 0.4 : 0.6,
          repeat: Infinity,
        }}
      >
        <div
          className="w-16 h-12"
          style={{
            background: 'linear-gradient(to bottom, #d4a574 0%, #c4956a 100%)',
            borderRadius: '30% 50% 40% 40%',
            transform: 'rotate(-30deg)',
          }}
        />
        {/* Fingers on frets */}
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-[#c4956a] rounded-full"
            animate={{
              scaleY: isGrooving ? [1, 0.9, 1] : 1,
            }}
            transition={{
              duration: 0.2,
              repeat: isGrooving ? Infinity : 0,
              delay: i * 0.05,
            }}
            style={{
              width: 8,
              height: 14,
              top: 4 + i * 3,
              left: 20 + i * 8,
              transform: 'rotate(-60deg)',
            }}
          />
        ))}
      </motion.div>
      
      {/* Sleeve visible on left */}
      <div
        className="absolute left-0 bottom-0 w-24 h-60"
        style={{
          background: 'linear-gradient(to right, #1a1a1a 0%, #2a2a2a 60%, transparent 100%)',
        }}
      />
      
      {/* Head bob motion indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-8"
        animate={{
          y: isGrooving ? [0, -3, 0] : 0,
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
        }}
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)',
        }}
      />
      
      {/* Stage light glow */}
      <motion.div
        className="absolute top-0 right-1/4 w-1/3 h-1/2"
        animate={{
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 2.5, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(100,150,255,0.3) 0%, transparent 70%)',
        }}
      />
    </div>
  );
});

BassistPOV.displayName = 'BassistPOV';
