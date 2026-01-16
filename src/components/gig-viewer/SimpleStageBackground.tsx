import { motion } from "framer-motion";

interface SimpleStageBackgroundProps {
  crowdMood: number;
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
}

export const SimpleStageBackground = ({ crowdMood, songSection }: SimpleStageBackgroundProps) => {
  const isHighEnergy = crowdMood > 70;
  const isChorus = songSection === 'chorus';
  const isSolo = songSection === 'solo';
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient background */}
      <motion.div 
        className="absolute inset-0"
        animate={{
          background: isHighEnergy 
            ? [
                'linear-gradient(180deg, #1a0a2e 0%, #0d0d0d 50%, #000000 100%)',
                'linear-gradient(180deg, #2d1b4e 0%, #1a0a2e 50%, #000000 100%)',
                'linear-gradient(180deg, #1a0a2e 0%, #0d0d0d 50%, #000000 100%)',
              ]
            : 'linear-gradient(180deg, #0d0d0d 0%, #000000 50%, #000000 100%)'
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Stage floor with perspective */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[35%] bg-gradient-to-t from-zinc-900 via-zinc-800/50 to-transparent"
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
      </div>
      
      {/* Side curtains */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black via-black/80 to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black via-black/80 to-transparent" />
      
      {/* Stage truss silhouette at top */}
      <div className="absolute top-0 left-0 right-0 h-20">
        <div className="absolute inset-x-8 top-4 h-3 bg-zinc-800/60 rounded-sm" />
        <div className="absolute inset-x-12 top-8 h-2 bg-zinc-700/40 rounded-sm" />
        {/* Truss vertical supports */}
        <div className="absolute left-8 top-0 w-2 h-20 bg-zinc-800/40" />
        <div className="absolute right-8 top-0 w-2 h-20 bg-zinc-800/40" />
      </div>
      
      {/* Ambient particles during high energy moments */}
      {(isChorus || isSolo) && isHighEnergy && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary/40 rounded-full"
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
    </div>
  );
};
