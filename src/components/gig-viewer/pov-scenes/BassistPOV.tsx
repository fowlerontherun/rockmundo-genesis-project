import { memo } from 'react';
import { motion } from 'framer-motion';

interface BassistPOVProps {
  intensity: number;
  songSection: string;
  clipType: string;
  clipVariant?: 'B1'; // B1 = Groove
  bassSkin?: 'default' | 'black' | 'natural' | 'sunburst';
}

export const BassistPOV = memo(({ intensity, songSection, clipType, clipVariant = 'B1', bassSkin = 'default' }: BassistPOVProps) => {
  const isGrooving = intensity > 0.5;
  const isLookingUp = clipType === 'crowd_look';
  const isLookingAtDrummer = clipType === 'stage_scan';
  const isPlucking = intensity > 0.3;
  
  // Bass skin colors
  const bassColors = {
    default: { body: '#1a0808', highlight: '#3a1515' },
    black: { body: '#0a0a0a', highlight: '#2a2a2a' },
    natural: { body: '#8b7355', highlight: '#a08060' },
    sunburst: { body: '#4a2c17', highlight: '#8b6914' },
  };
  const colors = bassColors[bassSkin];
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Background - stage view from bassist position */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, #0a0a15 0%, #121220 50%, #08080e 100%)',
        }}
      />
      
      {/* Overexposed stage lights - MTV2 aesthetic */}
      <motion.div
        className="absolute top-0 left-1/4 w-40 h-40"
        animate={{
          opacity: [0.5, 0.8, 0.5],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(100,150,255,0.3) 40%, transparent 70%)',
          filter: 'blur(15px)',
        }}
      />
      <motion.div
        className="absolute top-8 right-1/3 w-28 h-28"
        animate={{
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
        style={{
          background: 'radial-gradient(circle, rgba(255,200,100,0.6) 0%, transparent 60%)',
          filter: 'blur(12px)',
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
            <div className="w-28 h-18 bg-black/60 rounded-full" /> {/* Hi-hat */}
            <div className="absolute top-10 left-12 w-36 h-24 bg-black/70 rounded" /> {/* Drum set body */}
            <motion.div
              className="absolute -top-5 left-10 w-5 h-20 bg-black/50 rounded"
              animate={{ rotate: [-12, 12, -12] }}
              transition={{ duration: 0.25, repeat: Infinity }}
            /> {/* Stick */}
          </div>
        </motion.div>
      )}
      
      {/* Crowd glimpse when looking up */}
      {isLookingUp && (
        <motion.div
          className="absolute top-12 left-0 right-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
        >
          <div className="flex justify-around">
            {Array.from({ length: 22 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-black/70 rounded-t-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.04 }}
                style={{ width: 12 + Math.random() * 8, height: 22 + Math.random() * 14 }}
              />
            ))}
          </div>
          {/* Reaching hands */}
          <div className="absolute top-0 flex justify-around w-full">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={`hand-${i}`}
                className="w-2 h-12 bg-black/60 rounded-full"
                animate={{ 
                  y: [0, -8, 0],
                  rotate: [-10, 10, -10],
                }}
                transition={{ duration: 0.35, repeat: Infinity, delay: i * 0.08 }}
                style={{ transformOrigin: 'bottom center' }}
              />
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Amp stack to the right */}
      <div className="absolute right-2 top-1/4 bottom-16">
        <div className="w-32 h-full flex flex-col gap-1">
          {/* Amp head */}
          <div
            className="w-full h-14 rounded-t"
            style={{
              background: 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex justify-around pt-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div 
                  key={i} 
                  className="w-2.5 h-2.5 rounded-full"
                  animate={{
                    backgroundColor: isGrooving 
                      ? ['#ff8c00', '#ffaa00', '#ff8c00'] 
                      : '#996600',
                  }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  style={{ boxShadow: '0 0 4px rgba(255,140,0,0.5)' }}
                />
              ))}
            </div>
          </div>
          {/* Cab speakers */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="w-full h-28"
              style={{
                background: 'linear-gradient(to bottom, #1a1a1a 0%, #0a0a0a 100%)',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
              }}
            >
              <div className="grid grid-cols-2 gap-2 p-2 h-full">
                {Array.from({ length: 4 }).map((_, j) => (
                  <motion.div
                    key={j}
                    className="rounded-full"
                    animate={{
                      boxShadow: isGrooving 
                        ? ['0 0 5px rgba(0,0,0,0.5)', '0 0 10px rgba(50,50,50,0.3)', '0 0 5px rgba(0,0,0,0.5)']
                        : '0 0 5px rgba(0,0,0,0.5)',
                    }}
                    transition={{ duration: 0.2, repeat: Infinity }}
                    style={{
                      background: 'radial-gradient(circle, #3a3a3a 0%, #1a1a1a 70%, #0a0a0a 100%)',
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
        className="absolute bottom-0 left-0 right-1/4"
        style={{ height: isLookingUp ? '28%' : '55%' }}
        animate={{
          y: isLookingUp ? 70 : 0,
          rotate: isLookingUp ? 12 : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Bass body edge visible */}
        <div
          className="absolute bottom-0 left-0 w-40 h-28"
          style={{
            background: `linear-gradient(135deg, ${colors.body} 0%, ${colors.highlight} 50%, ${colors.body} 100%)`,
            borderRadius: '0 40% 0 0',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
          }}
        >
          {/* Pickups */}
          <div className="absolute top-8 right-8 w-12 h-3 bg-black/80 rounded">
            <div className="flex justify-around items-center h-full">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-1.5 h-2 bg-gray-600 rounded-full" />
              ))}
            </div>
          </div>
        </div>
        
        {/* Bass neck */}
        <div
          className="absolute bottom-0 left-12 w-20 h-full"
          style={{
            background: 'linear-gradient(to right, #2d1810 0%, #4a2c17 50%, #2d1810 100%)',
            transform: 'perspective(500px) rotateX(50deg) rotate(-22deg)',
            transformOrigin: 'bottom left',
            boxShadow: '0 5px 15px rgba(0,0,0,0.4)',
          }}
        >
          {/* Frets */}
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-1 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300"
              style={{ top: `${(i + 1) * 13}%` }}
            />
          ))}
          
          {/* Bass strings - thicker */}
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-0 bottom-0"
              animate={{
                x: isPlucking ? [0, (Math.random() - 0.5) * 2.5, 0] : 0,
              }}
              transition={{
                duration: 0.06 + i * 0.01,
                repeat: isPlucking ? Infinity : 0,
              }}
              style={{
                left: `${18 + i * 20}%`,
                width: 6 - i * 0.8,
                background: `linear-gradient(to bottom, 
                  rgba(180,180,180,0.9) 0%, 
                  rgba(150,150,150,0.85) 50%, 
                  rgba(130,130,130,0.9) 100%)`,
                boxShadow: '0 0 3px rgba(255,255,255,0.2)',
              }}
            />
          ))}
          
          {/* Fret markers */}
          <div className="absolute w-4 h-4 bg-white/45 rounded-full" style={{ top: '28%', left: '45%' }} />
          <div className="absolute w-4 h-4 bg-white/45 rounded-full" style={{ top: '58%', left: '45%' }} />
        </div>
      </motion.div>
      
      {/* Fretting hand (left) with sleeve and wristband */}
      <motion.div
        className="absolute bottom-44 left-20"
        animate={{
          y: isGrooving ? [0, -4, 0, -3, 0] : [0, -2, 0],
          x: isGrooving ? [0, 8, 0, 12, 0] : [0, 3, 0],
        }}
        transition={{
          duration: isGrooving ? 0.35 : 0.5,
          repeat: Infinity,
        }}
      >
        {/* Jacket sleeve */}
        <div
          className="absolute -left-10 -top-2 w-24 h-18"
          style={{
            background: 'linear-gradient(to right, #151515 0%, #252525 60%, transparent 100%)',
            borderRadius: '0 25% 25% 0',
          }}
        />
        {/* Wristband - leather studded */}
        <div
          className="absolute left-0 top-6 w-12 h-4 rounded"
          style={{
            background: 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)',
            border: '1px solid #444',
          }}
        >
          {/* Studs */}
          <div className="flex justify-around items-center h-full">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            ))}
          </div>
        </div>
        {/* Hand */}
        <div
          className="w-18 h-14"
          style={{
            background: 'linear-gradient(to bottom, #c9a07a 0%, #b8916b 100%)',
            borderRadius: '30% 50% 40% 40%',
            transform: 'rotate(-28deg)',
            boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
          }}
        />
        {/* Fingers on frets */}
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            animate={{
              scaleY: isGrooving ? [1, 0.88, 1] : 1,
            }}
            transition={{
              duration: 0.18,
              repeat: isGrooving ? Infinity : 0,
              delay: i * 0.04,
            }}
            style={{
              width: 10,
              height: 16,
              background: 'linear-gradient(to bottom, #c9a07a 0%, #a8816b 100%)',
              top: 4 + i * 3,
              left: 25 + i * 9,
              transform: 'rotate(-58deg)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        ))}
      </motion.div>
      
      {/* Plucking hand (right) */}
      <motion.div
        className="absolute bottom-28 right-1/3"
        animate={{
          y: isPlucking ? [0, -3, 0, -4, 0] : 0,
          x: isPlucking ? [0, -2, 0, 2, 0] : 0,
        }}
        transition={{
          duration: 0.2,
          repeat: isPlucking ? Infinity : 0,
        }}
      >
        {/* Sleeve */}
        <div
          className="absolute -right-8 -top-2 w-20 h-16"
          style={{
            background: 'linear-gradient(to left, #151515 0%, #252525 50%, transparent 100%)',
            borderRadius: '25% 0 0 25%',
          }}
        />
        {/* Wristband - fabric */}
        <div
          className="absolute right-6 top-4 w-10 h-3 rounded"
          style={{
            background: 'linear-gradient(to bottom, #006600 0%, #004400 100%)',
            border: '1px solid #008800',
          }}
        />
        {/* Hand */}
        <div
          className="w-20 h-12"
          style={{
            background: 'linear-gradient(to bottom, #c9a07a 0%, #b8916b 100%)',
            borderRadius: '45% 45% 35% 35%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        />
        {/* Plucking fingers */}
        <motion.div
          className="absolute -bottom-2 left-4 w-3 h-8 rounded-full"
          animate={{
            y: isPlucking ? [0, 4, 0] : 0,
            rotate: isPlucking ? [-5, 5, -5] : 0,
          }}
          transition={{ duration: 0.15, repeat: isPlucking ? Infinity : 0 }}
          style={{
            background: 'linear-gradient(to bottom, #c9a07a 0%, #a8816b 100%)',
            transformOrigin: 'top center',
          }}
        />
        <motion.div
          className="absolute -bottom-2 left-10 w-3 h-8 rounded-full"
          animate={{
            y: isPlucking ? [0, 4, 0] : 0,
            rotate: isPlucking ? [5, -5, 5] : 0,
          }}
          transition={{ duration: 0.15, repeat: isPlucking ? Infinity : 0, delay: 0.075 }}
          style={{
            background: 'linear-gradient(to bottom, #c9a07a 0%, #a8816b 100%)',
            transformOrigin: 'top center',
          }}
        />
      </motion.div>
      
      {/* Head bob motion indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-10"
        animate={{
          y: isGrooving ? [0, -4, 0] : 0,
        }}
        transition={{
          duration: 0.4,
          repeat: Infinity,
        }}
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)',
        }}
      />
      
      {/* Stage light glow - overexposed */}
      <motion.div
        className="absolute top-0 right-1/4 w-1/2 h-1/2"
        animate={{
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(100,150,255,0.4) 0%, transparent 70%)',
        }}
      />
    </div>
  );
});

BassistPOV.displayName = 'BassistPOV';
