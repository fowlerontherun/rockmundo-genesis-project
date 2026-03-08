import { motion } from "framer-motion";
import { TopDownMemberPopover } from "./TopDownMemberPopover";

export interface StageMember {
  id: string;
  name: string;
  instrumentRole: string;
  vocalRole?: string | null;
  performanceScore?: number;
  skillContribution?: number;
}

interface TopDownStageProps {
  members: StageMember[];
  intensity: number; // 0-1
  songEnergy: 'high' | 'medium' | 'low';
  lightingColor: string; // hsl color for stage lights
}

// Instrument emoji/icon + position mapping
const INSTRUMENT_CONFIG: Record<string, { emoji: string; col: number; row: number; color: string }> = {
  lead_guitar:   { emoji: '🎸', col: 1, row: 1, color: 'bg-red-500' },
  rhythm_guitar: { emoji: '🎸', col: 0, row: 1, color: 'bg-orange-500' },
  guitar:        { emoji: '🎸', col: 1, row: 1, color: 'bg-red-500' },
  lead_vocals:   { emoji: '🎤', col: 2, row: 0, color: 'bg-purple-500' },
  vocals:        { emoji: '🎤', col: 2, row: 0, color: 'bg-purple-500' },
  bass:          { emoji: '🎸', col: 3, row: 1, color: 'bg-blue-500' },
  drums:         { emoji: '🥁', col: 2, row: 2, color: 'bg-yellow-500' },
  keyboard:      { emoji: '🎹', col: 4, row: 1, color: 'bg-teal-500' },
  keys:          { emoji: '🎹', col: 4, row: 1, color: 'bg-teal-500' },
};

const DEFAULT_CONFIG = { emoji: '🎵', col: 2, row: 1, color: 'bg-muted' };

export const TopDownStage = ({ members, intensity, songEnergy, lightingColor }: TopDownStageProps) => {
  const bobSpeed = songEnergy === 'high' ? 0.4 : songEnergy === 'medium' ? 0.6 : 0.9;
  const bobAmount = songEnergy === 'high' ? 3 : songEnergy === 'medium' ? 2 : 1;

  // Assign positions to avoid overlap
  const usedPositions = new Set<string>();
  const positionedMembers = members.map((m) => {
    const roleKey = m.instrumentRole.toLowerCase().replace(/\s+/g, '_');
    let config = INSTRUMENT_CONFIG[roleKey] || DEFAULT_CONFIG;
    
    // Resolve collisions
    let posKey = `${config.col}-${config.row}`;
    if (usedPositions.has(posKey)) {
      // Try adjacent positions
      for (let offset = 1; offset <= 4; offset++) {
        const altKey = `${config.col + offset}-${config.row}`;
        if (!usedPositions.has(altKey)) {
          config = { ...config, col: config.col + offset };
          posKey = altKey;
          break;
        }
      }
    }
    usedPositions.add(posKey);
    
    return { member: m, config };
  });

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Stage floor */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 via-zinc-850 to-zinc-900" />
      
      {/* Stage wood pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.05) 18px, rgba(255,255,255,0.05) 20px)',
        }}
      />

      {/* Lighting effects */}
      <motion.div
        className="absolute top-0 left-1/4 w-1/2 h-full rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: lightingColor }}
        animate={{ opacity: [0.1, 0.25, 0.1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Spot lights */}
      {songEnergy === 'high' && (
        <>
          <motion.div
            className="absolute top-0 left-[10%] w-16 h-full bg-primary/10 blur-2xl"
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="absolute top-0 right-[10%] w-16 h-full bg-accent/10 blur-2xl"
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.75 }}
          />
        </>
      )}

      {/* Stage edge */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-700 opacity-60" />

      {/* Band members */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: '85%', height: '70%' }}>
          {positionedMembers.map(({ member, config }, idx) => {
            const xPercent = (config.col / 5) * 100 + 2;
            const yPercent = config.row * 33;
            
            return (
              <TopDownMemberPopover key={member.id} member={member}>
                <motion.div
                  className="absolute cursor-pointer group"
                  style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                  animate={{ y: [0, -bobAmount, 0] }}
                  transition={{
                    duration: bobSpeed,
                    repeat: Infinity,
                    delay: idx * 0.15,
                    ease: 'easeInOut',
                  }}
                >
                  {/* Body */}
                  <div className={`w-7 h-9 rounded-md ${config.color} border-2 border-black/40 shadow-lg relative`}
                    style={{ imageRendering: 'pixelated' }}
                  >
                    {/* Head */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-amber-200 border-2 border-black/30" />
                    {/* Instrument icon */}
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] leading-none">
                      {config.emoji}
                    </span>
                  </div>
                  {/* Name label */}
                  <div className="text-[8px] text-white/70 text-center mt-1 whitespace-nowrap group-hover:text-white transition-colors">
                    {member.name.split(' ')[0]}
                  </div>
                </motion.div>
              </TopDownMemberPopover>
            );
          })}
        </div>
      </div>
    </div>
  );
};
