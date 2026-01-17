import { motion } from "framer-motion";

interface InstrumentSilhouettesProps {
  bandMembers: {
    role: string;
    isPresent: boolean;
  }[];
  intensity: number;
  songSection: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
}

// Role-based glow colors
const roleGlowColors: Record<string, string> = {
  vocalist: 'rgba(168, 85, 247, 0.4)',
  guitarist: 'rgba(249, 115, 22, 0.4)',
  bassist: 'rgba(59, 130, 246, 0.4)',
  drummer: 'rgba(16, 185, 129, 0.4)',
  keyboardist: 'rgba(245, 158, 11, 0.4)',
};

// Microphone Stand SVG
const MicrophoneSilhouette = ({ intensity, isSolo }: { intensity: number; isSolo: boolean }) => (
  <motion.svg
    viewBox="0 0 60 150"
    className="w-12 h-32 opacity-30"
    animate={{
      filter: `drop-shadow(0 0 ${10 + intensity * 15}px ${roleGlowColors.vocalist})`,
    }}
  >
    {/* Mic head */}
    <ellipse cx="30" cy="15" rx="12" ry="18" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    {/* Stand */}
    <rect x="28" y="33" width="4" height="90" fill="#1a1a2e" />
    {/* Base */}
    <ellipse cx="30" cy="130" rx="20" ry="6" fill="#1a1a2e" />
  </motion.svg>
);

// Guitar Amp Stack SVG
const GuitarAmpSilhouette = ({ intensity, isSolo }: { intensity: number; isSolo: boolean }) => (
  <motion.svg
    viewBox="0 0 80 120"
    className="w-20 h-28 opacity-25"
    animate={{
      filter: `drop-shadow(0 0 ${8 + intensity * 12}px ${roleGlowColors.guitarist})`,
      x: isSolo ? [0, 2, -2, 0] : 0,
    }}
    transition={{ duration: 0.1, repeat: isSolo ? Infinity : 0 }}
  >
    {/* Top cab */}
    <rect x="5" y="5" width="70" height="50" rx="3" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    {/* Speaker grille */}
    <rect x="10" y="10" width="60" height="40" rx="2" fill="#0d0d1a" />
    {/* Bottom cab */}
    <rect x="5" y="60" width="70" height="55" rx="3" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    {/* Speaker grille bottom */}
    <rect x="10" y="65" width="60" height="45" rx="2" fill="#0d0d1a" />
    {/* LED indicator */}
    <motion.circle
      cx="70" cy="12"
      r="3"
      fill="#ef4444"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
  </motion.svg>
);

// Bass Amp Cabinet SVG
const BassAmpSilhouette = ({ intensity }: { intensity: number }) => (
  <motion.svg
    viewBox="0 0 90 100"
    className="w-24 h-24 opacity-25"
    animate={{
      filter: `drop-shadow(0 0 ${8 + intensity * 10}px ${roleGlowColors.bassist})`,
    }}
  >
    {/* Main cab */}
    <rect x="5" y="5" width="80" height="90" rx="4" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    {/* Speaker grille */}
    <rect x="10" y="10" width="70" height="80" rx="3" fill="#0d0d1a" />
    {/* Speakers (4x10) */}
    <circle cx="30" cy="30" r="12" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
    <circle cx="60" cy="30" r="12" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
    <circle cx="30" cy="60" r="12" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
    <circle cx="60" cy="60" r="12" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
  </motion.svg>
);

// Drum Kit SVG
const DrumKitSilhouette = ({ intensity, isChorus }: { intensity: number; isChorus: boolean }) => (
  <motion.svg
    viewBox="0 0 180 120"
    className="w-44 h-28 opacity-25"
    animate={{
      filter: `drop-shadow(0 0 ${10 + intensity * 15}px ${roleGlowColors.drummer})`,
    }}
  >
    {/* Kick drum */}
    <ellipse cx="90" cy="80" rx="35" ry="30" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    <ellipse cx="90" cy="80" rx="25" ry="20" fill="#0d0d1a" />
    
    {/* Hi-hat */}
    <ellipse cx="25" cy="40" rx="18" ry="4" fill="#4a4a6e" />
    <rect x="23" y="40" width="4" height="50" fill="#3a3a5e" />
    
    {/* Snare */}
    <ellipse cx="55" cy="65" rx="18" ry="8" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    
    {/* Floor tom */}
    <ellipse cx="140" cy="70" rx="22" ry="12" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    
    {/* Rack toms */}
    <ellipse cx="70" cy="35" rx="16" ry="8" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    <ellipse cx="110" cy="35" rx="16" ry="8" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    
    {/* Cymbals */}
    <motion.ellipse
      cx="155" cy="25"
      rx="22" ry="5"
      fill="#5a5a7e"
      animate={isChorus ? { opacity: [0.6, 1, 0.6] } : {}}
      transition={{ duration: 0.3, repeat: Infinity }}
    />
    <motion.ellipse
      cx="30" cy="20"
      rx="18" ry="4"
      fill="#5a5a7e"
      animate={isChorus ? { opacity: [0.7, 1, 0.7] } : {}}
      transition={{ duration: 0.25, repeat: Infinity, delay: 0.1 }}
    />
  </motion.svg>
);

// Keyboard/Synth SVG
const KeyboardSilhouette = ({ intensity }: { intensity: number }) => (
  <motion.svg
    viewBox="0 0 140 60"
    className="w-36 h-16 opacity-25"
    animate={{
      filter: `drop-shadow(0 0 ${8 + intensity * 12}px ${roleGlowColors.keyboardist})`,
    }}
  >
    {/* Keyboard body */}
    <rect x="5" y="20" width="130" height="35" rx="3" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1" />
    {/* Keys area */}
    <rect x="10" y="30" width="120" height="20" rx="2" fill="#0d0d1a" />
    {/* White keys indication */}
    {Array.from({ length: 12 }).map((_, i) => (
      <rect key={i} x={15 + i * 10} y="32" width="6" height="16" rx="1" fill="#2a2a4e" />
    ))}
    {/* Control panel */}
    <rect x="10" y="22" width="120" height="6" rx="1" fill="#0d0d1a" />
    {/* LEDs */}
    <motion.circle
      cx="20" cy="25"
      r="2"
      fill="#22c55e"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1, repeat: Infinity }}
    />
    {/* Stand legs hint */}
    <rect x="25" y="55" width="4" height="5" fill="#2a2a4e" />
    <rect x="111" y="55" width="4" height="5" fill="#2a2a4e" />
  </motion.svg>
);

export const InstrumentSilhouettes = ({ bandMembers, intensity, songSection }: InstrumentSilhouettesProps) => {
  const isChorus = songSection === 'chorus';
  const isSolo = songSection === 'solo';
  
  const hasVocalist = bandMembers.some(m => m.role === 'vocalist' && m.isPresent);
  const hasGuitarist = bandMembers.some(m => m.role === 'guitarist' && m.isPresent);
  const hasBassist = bandMembers.some(m => m.role === 'bassist' && m.isPresent);
  const hasDrummer = bandMembers.some(m => m.role === 'drummer' && m.isPresent);
  const hasKeyboardist = bandMembers.some(m => m.role === 'keyboardist' && m.isPresent);
  
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
      {/* Drummer equipment (back center) */}
      {hasDrummer && (
        <div className="absolute bottom-[38%] left-1/2 -translate-x-1/2">
          <DrumKitSilhouette intensity={intensity} isChorus={isChorus} />
        </div>
      )}
      
      {/* Keyboardist equipment (back left) */}
      {hasKeyboardist && (
        <div className="absolute bottom-[32%] left-[10%]">
          <KeyboardSilhouette intensity={intensity} />
        </div>
      )}
      
      {/* Guitarist amp (front left) */}
      {hasGuitarist && (
        <div className="absolute bottom-[12%] left-[8%]">
          <GuitarAmpSilhouette intensity={intensity} isSolo={isSolo} />
        </div>
      )}
      
      {/* Vocalist mic stand (front center) - slightly behind vocalist position */}
      {hasVocalist && (
        <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 -ml-8">
          <MicrophoneSilhouette intensity={intensity} isSolo={isSolo} />
        </div>
      )}
      
      {/* Bassist amp (front right) */}
      {hasBassist && (
        <div className="absolute bottom-[12%] right-[8%]">
          <BassAmpSilhouette intensity={intensity} />
        </div>
      )}
      
      {/* Stage monitors (front edge) */}
      <div className="absolute bottom-[5%] left-[20%]">
        <svg viewBox="0 0 50 25" className="w-12 h-6 opacity-20">
          <polygon points="5,25 45,25 40,5 10,5" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
        </svg>
      </div>
      <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2">
        <svg viewBox="0 0 50 25" className="w-12 h-6 opacity-20">
          <polygon points="5,25 45,25 40,5 10,5" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
        </svg>
      </div>
      <div className="absolute bottom-[5%] right-[20%]">
        <svg viewBox="0 0 50 25" className="w-12 h-6 opacity-20">
          <polygon points="5,25 45,25 40,5 10,5" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
};
