import { memo } from 'react';
import { motion } from 'framer-motion';

interface KeyboardistPOVProps {
  intensity: number;
  songSection: string;
  clipType: string;
}

export const KeyboardistPOV = memo(({ intensity, songSection, clipType }: KeyboardistPOVProps) => {
  const isPlaying = clipType === 'playing';
  const isLookingUp = clipType === 'crowd_look';
  const isLookingAtBand = clipType === 'stage_scan';
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - side stage view */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, #12121a 0%, #1a1a28 50%, #0f0f18 100%)',
        }}
      />
      
      {/* Band members visible when looking at stage */}
      {isLookingAtBand && (
        <motion.div
          className="absolute top-1/4 left-1/4 right-1/4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        >
          <div className="flex justify-around">
            {/* Vocalist silhouette */}
            <motion.div
              className="w-12 h-28 bg-black/50 rounded-t-full"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            {/* Guitarist silhouette */}
            <motion.div
              className="w-10 h-24 bg-black/40 rounded-t-full"
              animate={{ rotate: [-3, 3, -3] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
            {/* Bassist silhouette */}
            <motion.div
              className="w-10 h-24 bg-black/40 rounded-t-full"
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 0.7, repeat: Infinity }}
            />
          </div>
        </motion.div>
      )}
      
      {/* Crowd visible when looking up */}
      {isLookingUp && (
        <motion.div
          className="absolute top-12 left-0 right-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
        >
          <div className="flex justify-around">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-black/50 rounded-t-full"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.04 }}
                style={{ width: 10 + Math.random() * 6, height: 16 + Math.random() * 10 }}
              />
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Synth/Keyboard - stretching across lower frame */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: isLookingUp ? '30%' : '50%' }}
        animate={{
          y: isLookingUp ? 40 : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Keyboard body */}
        <div
          className="absolute bottom-0 left-4 right-4 h-16"
          style={{
            background: 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)',
            borderRadius: '4px 4px 0 0',
          }}
        >
          {/* Control panel / display */}
          <div className="absolute top-1 left-1/4 right-1/4 h-6 bg-black/80 rounded">
            {/* LED display */}
            <div className="absolute top-1 left-2 right-2 h-4 bg-[#1a3020] rounded-sm overflow-hidden">
              <motion.div
                className="text-[8px] text-green-400 font-mono whitespace-nowrap"
                animate={{ x: [100, -200] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              >
                PATCH 127 - STRINGS + PAD
              </motion.div>
            </div>
          </div>
          
          {/* Knobs and sliders */}
          <div className="absolute top-2 left-4 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-gray-600 border border-gray-500" />
            ))}
          </div>
          <div className="absolute top-2 right-4 flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-1 h-4 bg-gray-500 rounded" />
            ))}
          </div>
        </div>
        
        {/* Keys */}
        <div
          className="absolute bottom-16 left-8 right-8 h-24"
          style={{
            perspective: '300px',
          }}
        >
          <div
            className="w-full h-full flex"
            style={{
              transform: 'rotateX(45deg)',
              transformOrigin: 'bottom center',
            }}
          >
            {/* White keys */}
            {Array.from({ length: 28 }).map((_, i) => {
              const isPressed = isPlaying && Math.random() > 0.85;
              return (
                <motion.div
                  key={`white-${i}`}
                  className="flex-1 h-full border-r border-gray-300"
                  animate={{
                    y: isPressed ? 2 : 0,
                    background: isPressed 
                      ? 'linear-gradient(to bottom, #d0d0d0 0%, #e8e8e8 100%)'
                      : 'linear-gradient(to bottom, #f5f5f5 0%, #ffffff 100%)',
                  }}
                  transition={{ duration: 0.05 }}
                  style={{
                    background: 'linear-gradient(to bottom, #f5f5f5 0%, #ffffff 100%)',
                    borderRadius: '0 0 2px 2px',
                  }}
                />
              );
            })}
            
            {/* Black keys overlay */}
            <div className="absolute top-0 left-0 right-0 h-[60%] flex pointer-events-none">
              {Array.from({ length: 28 }).map((_, i) => {
                // Skip positions where there's no black key (after E and B)
                const keyInOctave = i % 7;
                if (keyInOctave === 2 || keyInOctave === 6) return <div key={`black-${i}`} className="flex-1" />;
                
                const isPressed = isPlaying && Math.random() > 0.9;
                return (
                  <motion.div
                    key={`black-${i}`}
                    className="flex-1 flex justify-end"
                  >
                    <motion.div
                      className="w-[60%] h-full mr-[-30%]"
                      animate={{
                        y: isPressed ? 1 : 0,
                      }}
                      transition={{ duration: 0.05 }}
                      style={{
                        background: isPressed
                          ? 'linear-gradient(to bottom, #1a1a1a 0%, #333 100%)'
                          : 'linear-gradient(to bottom, #222 0%, #111 100%)',
                        borderRadius: '0 0 2px 2px',
                        zIndex: 10,
                      }}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Hands on keys */}
      <motion.div
        className="absolute bottom-32 left-1/3"
        animate={{
          x: isPlaying ? [0, 20, -10, 30, 0] : 0,
          y: isPlaying ? [0, -2, 0, -3, 0] : 0,
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
        }}
      >
        {/* Left hand */}
        <div
          className="w-16 h-10"
          style={{
            background: 'linear-gradient(to bottom, #d4a574 0%, #c4956a 100%)',
            borderRadius: '40% 40% 30% 30%',
            transform: 'rotate(-10deg)',
          }}
        />
      </motion.div>
      
      <motion.div
        className="absolute bottom-32 right-1/3"
        animate={{
          x: isPlaying ? [0, -15, 25, -5, 0] : 0,
          y: isPlaying ? [0, -3, 0, -2, 0] : 0,
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: 0.2,
        }}
      >
        {/* Right hand */}
        <div
          className="w-16 h-10"
          style={{
            background: 'linear-gradient(to bottom, #d4a574 0%, #c4956a 100%)',
            borderRadius: '40% 40% 30% 30%',
            transform: 'rotate(10deg)',
          }}
        />
      </motion.div>
      
      {/* Monitor/screen visible to the side */}
      <div className="absolute right-4 top-1/3 w-20 h-16 bg-black/80 rounded">
        <div className="m-1 h-[calc(100%-8px)] bg-blue-900/30 rounded-sm">
          <motion.div
            className="w-full h-full flex items-center justify-center"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-[6px] text-blue-400 font-mono">SETLIST</div>
          </motion.div>
        </div>
      </div>
      
      {/* Stage monitor below */}
      <div className="absolute bottom-2 left-1/4 w-24 h-10 bg-black/70 rounded transform -skew-x-12" />
      
      {/* Ambient lighting */}
      <motion.div
        className="absolute top-0 left-1/4 w-1/2 h-1/2"
        animate={{
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 3, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(150,100,255,0.3) 0%, transparent 70%)',
        }}
      />
    </div>
  );
});

KeyboardistPOV.displayName = 'KeyboardistPOV';
