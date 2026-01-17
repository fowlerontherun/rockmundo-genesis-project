import { motion } from "framer-motion";

interface StageSpotlightsProps {
  crowdMood: number;
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
}

// Individual performer spotlight colors
const performerSpotlights = [
  { position: 'left-[20%]', color: 'rgba(249, 115, 22, 0.35)', role: 'guitarist' },
  { position: 'left-1/2 -translate-x-1/2', color: 'rgba(168, 85, 247, 0.4)', role: 'vocalist' },
  { position: 'right-[20%]', color: 'rgba(59, 130, 246, 0.35)', role: 'bassist' },
];

export const StageSpotlights = ({ crowdMood, songSection }: StageSpotlightsProps) => {
  const isHighEnergy = crowdMood > 70;
  const isMediumEnergy = crowdMood > 40;
  const isChorus = songSection === 'chorus';
  const isSolo = songSection === 'solo';
  const isBridge = songSection === 'bridge';
  const isIntro = songSection === 'intro';
  
  // Colors based on song section and energy
  const getSpotlightColor = (index: number) => {
    if (isSolo) return index % 2 === 0 ? 'rgba(255, 100, 100, 0.5)' : 'rgba(255, 200, 100, 0.5)';
    if (isChorus && isHighEnergy) return index % 2 === 0 ? 'rgba(138, 43, 226, 0.5)' : 'rgba(0, 191, 255, 0.5)';
    if (isChorus) return 'rgba(255, 255, 255, 0.35)';
    if (isBridge) return 'rgba(100, 100, 255, 0.35)';
    return 'rgba(255, 200, 100, 0.25)';
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 20 }}>
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
      
      {/* Individual performer spotlights */}
      {performerSpotlights.map((spot, i) => (
        <motion.div
          key={spot.role}
          className={`absolute top-0 ${spot.position}`}
          animate={{
            opacity: isSolo && spot.role === 'guitarist' 
              ? [0.5, 0.8, 0.5] 
              : isChorus 
                ? [0.3, 0.5, 0.3] 
                : [0.2, 0.35, 0.2],
          }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          style={{
            width: '15vw',
            height: '100vh',
            background: `radial-gradient(ellipse at top, ${spot.color} 0%, transparent 60%)`,
          }}
        />
      ))}
      
      {/* Solo spotlight enhancement */}
      {isSolo && (
        <motion.div
          className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-72 h-72 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.25, 0.5, 0.25],
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{
            background: 'radial-gradient(circle, rgba(255, 100, 100, 0.5) 0%, transparent 70%)',
          }}
        />
      )}
      
      {/* Haze/fog effect at stage level */}
      <motion.div
        className="absolute bottom-[15%] left-0 right-0 h-32"
        animate={{
          opacity: isChorus || isSolo ? [0.15, 0.3, 0.15] : 0.1,
        }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{
          background: 'linear-gradient(to top, rgba(255,255,255,0.15) 0%, transparent 100%)',
        }}
      />
      
      {/* Flash effect on high energy moments */}
      {isHighEnergy && isChorus && (
        <motion.div
          className="absolute inset-0 bg-white"
          animate={{
            opacity: [0, 0.15, 0],
          }}
          transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 2 }}
        />
      )}
      
      {/* Color wash overlay based on mood */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: isHighEnergy 
            ? [
                'linear-gradient(135deg, rgba(138, 43, 226, 0.12) 0%, transparent 50%, rgba(0, 191, 255, 0.12) 100%)',
                'linear-gradient(135deg, rgba(0, 191, 255, 0.12) 0%, transparent 50%, rgba(138, 43, 226, 0.12) 100%)',
                'linear-gradient(135deg, rgba(138, 43, 226, 0.12) 0%, transparent 50%, rgba(0, 191, 255, 0.12) 100%)',
              ]
            : isMediumEnergy
              ? 'linear-gradient(135deg, rgba(255, 200, 100, 0.05) 0%, transparent 100%)'
              : 'transparent'
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </div>
  );
};
