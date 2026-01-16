import { motion } from "framer-motion";

interface StageSpotlightsProps {
  crowdMood: number;
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
}

export const StageSpotlights = ({ crowdMood, songSection }: StageSpotlightsProps) => {
  const isHighEnergy = crowdMood > 70;
  const isChorus = songSection === 'chorus';
  const isSolo = songSection === 'solo';
  const isBridge = songSection === 'bridge';
  
  // Colors based on song section and energy
  const getSpotlightColor = (index: number) => {
    if (isSolo) return index % 2 === 0 ? 'rgba(255, 100, 100, 0.4)' : 'rgba(255, 200, 100, 0.4)';
    if (isChorus && isHighEnergy) return index % 2 === 0 ? 'rgba(138, 43, 226, 0.5)' : 'rgba(0, 191, 255, 0.5)';
    if (isChorus) return 'rgba(255, 255, 255, 0.3)';
    if (isBridge) return 'rgba(100, 100, 255, 0.3)';
    return 'rgba(255, 200, 100, 0.2)';
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Center spotlight on vocalist */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2"
        animate={{
          opacity: songSection === 'solo' ? 0.3 : [0.4, 0.6, 0.4],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          width: '30vw',
          height: '100vh',
          background: `radial-gradient(ellipse at top, ${getSpotlightColor(0)} 0%, transparent 70%)`,
        }}
      />
      
      {/* Left spotlight */}
      <motion.div
        className="absolute top-0 left-[20%]"
        animate={{
          opacity: isSolo ? [0.5, 0.7, 0.5] : 0.3,
          x: isChorus ? ['-10%', '10%', '-10%'] : 0,
        }}
        transition={{ duration: isChorus ? 3 : 2, repeat: Infinity }}
        style={{
          width: '20vw',
          height: '100vh',
          background: `radial-gradient(ellipse at top, ${getSpotlightColor(1)} 0%, transparent 60%)`,
        }}
      />
      
      {/* Right spotlight */}
      <motion.div
        className="absolute top-0 right-[20%]"
        animate={{
          opacity: isSolo ? [0.5, 0.7, 0.5] : 0.3,
          x: isChorus ? ['10%', '-10%', '10%'] : 0,
        }}
        transition={{ duration: isChorus ? 3 : 2, repeat: Infinity, delay: 0.5 }}
        style={{
          width: '20vw',
          height: '100vh',
          background: `radial-gradient(ellipse at top, ${getSpotlightColor(2)} 0%, transparent 60%)`,
        }}
      />
      
      {/* Scanning beam effect during chorus */}
      {isChorus && isHighEnergy && (
        <>
          <motion.div
            className="absolute top-0 h-full w-4"
            animate={{
              left: ['-5%', '105%'],
              opacity: [0, 0.3, 0.3, 0],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
            }}
          />
          <motion.div
            className="absolute top-0 h-full w-4"
            animate={{
              right: ['-5%', '105%'],
              opacity: [0, 0.3, 0.3, 0],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 2 }}
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(138, 43, 226, 0.3), transparent)',
            }}
          />
        </>
      )}
      
      {/* Solo spotlight enhancement */}
      {isSolo && (
        <motion.div
          className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-64 h-64 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{
            background: 'radial-gradient(circle, rgba(255, 100, 100, 0.4) 0%, transparent 70%)',
          }}
        />
      )}
      
      {/* Color wash overlay based on mood */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: isHighEnergy 
            ? [
                'linear-gradient(135deg, rgba(138, 43, 226, 0.1) 0%, transparent 50%, rgba(0, 191, 255, 0.1) 100%)',
                'linear-gradient(135deg, rgba(0, 191, 255, 0.1) 0%, transparent 50%, rgba(138, 43, 226, 0.1) 100%)',
                'linear-gradient(135deg, rgba(138, 43, 226, 0.1) 0%, transparent 50%, rgba(0, 191, 255, 0.1) 100%)',
              ]
            : 'transparent'
        }}
        transition={{ duration: 5, repeat: Infinity }}
      />
    </div>
  );
};
