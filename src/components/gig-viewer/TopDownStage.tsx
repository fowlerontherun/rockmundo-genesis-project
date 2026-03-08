import { motion } from "framer-motion";
import { TopDownMemberPopover } from "./TopDownMemberPopover";
import { StageEquipment } from "./StageEquipment";
import { StageLighting } from "./StageLighting";
import { getStageTheme, type StageThemeConfig } from "./StageThemes";
import type { GenreVisualConfig } from "./GenreVisuals";

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
  intensity: number;
  songEnergy: 'high' | 'medium' | 'low';
  lightingColor: string;
  venueType?: string | null;
  genreVisuals?: GenreVisualConfig | null;
  crowdMood?: string;
  showStats?: boolean;
}

// Instrument config with position + animations
const INSTRUMENT_CONFIG: Record<string, {
  emoji: string; col: number; row: number; color: string;
  animType: 'strum' | 'drum' | 'bounce' | 'sway' | 'keys';
  bodyColor: string;
}> = {
  lead_guitar:   { emoji: '🎸', col: 1, row: 1, color: 'bg-red-500', animType: 'strum', bodyColor: '#ef4444' },
  rhythm_guitar: { emoji: '🎸', col: 0, row: 1, color: 'bg-orange-500', animType: 'strum', bodyColor: '#f97316' },
  guitar:        { emoji: '🎸', col: 1, row: 1, color: 'bg-red-500', animType: 'strum', bodyColor: '#ef4444' },
  lead_vocals:   { emoji: '🎤', col: 2, row: 0, color: 'bg-purple-500', animType: 'bounce', bodyColor: '#a855f7' },
  vocals:        { emoji: '🎤', col: 2, row: 0, color: 'bg-purple-500', animType: 'bounce', bodyColor: '#a855f7' },
  bass:          { emoji: '🎸', col: 3, row: 1, color: 'bg-blue-500', animType: 'sway', bodyColor: '#3b82f6' },
  drums:         { emoji: '🥁', col: 2, row: 2, color: 'bg-yellow-500', animType: 'drum', bodyColor: '#eab308' },
  keyboard:      { emoji: '🎹', col: 4, row: 1, color: 'bg-teal-500', animType: 'keys', bodyColor: '#14b8a6' },
  keys:          { emoji: '🎹', col: 4, row: 1, color: 'bg-teal-500', animType: 'keys', bodyColor: '#14b8a6' },
};

type AnimType = 'strum' | 'drum' | 'bounce' | 'sway' | 'keys';
const DEFAULT_CONFIG: { emoji: string; col: number; row: number; color: string; animType: AnimType; bodyColor: string } = { emoji: '🎵', col: 2, row: 1, color: 'bg-muted', animType: 'sway', bodyColor: '#6b7280' };

// Member sprite component with detailed pixel art
const MemberSprite = ({ member, config, idx, songEnergy, bobSpeed, bobAmount, showStats }: {
  member: StageMember;
  config: typeof DEFAULT_CONFIG;
  idx: number;
  songEnergy: 'high' | 'medium' | 'low';
  bobSpeed: number;
  bobAmount: number;
  showStats?: boolean;
}) => {
  const xPercent = (config.col / 5) * 100 + 2;
  const yPercent = config.row * 33;
  const score = member.performanceScore || 0;
  const isHighPerformer = score >= 18;
  const isVocalist = config.animType === 'bounce';

  // Instrument-specific arm animations
  const armAnimation = (() => {
    switch (config.animType) {
      case 'strum':
        return {
          rightArm: { rotate: songEnergy === 'high' ? [-20, 20, -20] : [-10, 10, -10] },
          leftArm: {},
          duration: songEnergy === 'high' ? 0.25 : 0.4,
        };
      case 'drum':
        return {
          rightArm: { rotate: [-15, 25, -15] },
          leftArm: { rotate: [15, -25, 15] },
          duration: songEnergy === 'high' ? 0.2 : 0.35,
        };
      case 'keys':
        return {
          rightArm: { x: [-1, 1, -1] },
          leftArm: { x: [1, -1, 1] },
          duration: 0.5,
        };
      case 'sway':
        return {
          rightArm: {},
          leftArm: {},
          duration: 0.8,
        };
      case 'bounce':
        return {
          rightArm: { rotate: songEnergy === 'high' ? [-5, 15, -5] : [0, 5, 0] },
          leftArm: {},
          duration: 0.5,
        };
      default:
        return { rightArm: {}, leftArm: {}, duration: 0.6 };
    }
  })();

  return (
    <TopDownMemberPopover member={member}>
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
        {/* Performance glow ring */}
        {isHighPerformer && (
          <motion.div
            className="absolute -inset-1.5 rounded-full opacity-40"
            style={{
              background: `radial-gradient(circle, ${config.bodyColor}60 0%, transparent 70%)`,
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {/* Detailed sprite body */}
        <div className="relative" style={{ width: 28, height: 36 }}>
          {/* Head */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-black/30"
            style={{ width: 14, height: 14, top: -2, backgroundColor: '#fbbf24' }}
          >
            {/* Eyes */}
            <div className="absolute top-[5px] left-[3px] w-[2px] h-[2px] rounded-full bg-black/60" />
            <div className="absolute top-[5px] right-[3px] w-[2px] h-[2px] rounded-full bg-black/60" />
          </div>

          {/* Torso */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-t-sm border border-black/30"
            style={{
              width: 18, height: 14, top: 10,
              backgroundColor: config.bodyColor,
              imageRendering: 'pixelated',
            }}
          />

          {/* Left arm */}
          <motion.div
            className="absolute rounded-sm"
            style={{
              width: 5, height: 10, top: 11, left: 1,
              backgroundColor: config.bodyColor,
              transformOrigin: 'top center',
              borderLeft: '1px solid rgba(0,0,0,0.2)',
            }}
            animate={armAnimation.leftArm}
            transition={{ duration: armAnimation.duration, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.1 }}
          />

          {/* Right arm */}
          <motion.div
            className="absolute rounded-sm"
            style={{
              width: 5, height: 10, top: 11, right: 1,
              backgroundColor: config.bodyColor,
              transformOrigin: 'top center',
              borderRight: '1px solid rgba(0,0,0,0.2)',
            }}
            animate={armAnimation.rightArm}
            transition={{ duration: armAnimation.duration, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.1 + 0.1 }}
          />

          {/* Legs */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-[2px]">
            <div className="w-[6px] h-[8px] bg-zinc-800 rounded-b-sm border border-black/20" />
            <div className="w-[6px] h-[8px] bg-zinc-800 rounded-b-sm border border-black/20" />
          </div>

          {/* Instrument icon */}
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] leading-none z-10">
            {config.emoji}
          </span>
        </div>

        {/* Floating vocal notes for vocalist */}
        {isVocalist && songEnergy !== 'low' && (
          <motion.span
            className="absolute -top-4 left-1/2 text-[8px] text-purple-300"
            animate={{ y: [0, -8, -16], opacity: [1, 0.8, 0], x: [-2, 2, -2] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.3 }}
          >
            ♪
          </motion.span>
        )}

        {/* Stats overlay */}
        {showStats && member.performanceScore !== undefined && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 rounded px-1 py-0.5 whitespace-nowrap">
            <span className={`text-[7px] font-bold ${score >= 18 ? 'text-green-400' : score >= 12 ? 'text-yellow-400' : 'text-red-400'}`}>
              {score.toFixed(1)}
            </span>
          </div>
        )}

        {/* Name label */}
        <div className="text-[8px] text-white/70 text-center mt-0.5 whitespace-nowrap group-hover:text-white transition-colors">
          {member.name.split(' ')[0]}
        </div>
      </motion.div>
    </TopDownMemberPopover>
  );
};

export const TopDownStage = ({ members, intensity, songEnergy, lightingColor, venueType, genreVisuals, crowdMood, showStats }: TopDownStageProps) => {
  const theme = getStageTheme(venueType);
  const bobSpeed = songEnergy === 'high' ? 0.4 : songEnergy === 'medium' ? 0.6 : 0.9;
  const bobAmount = songEnergy === 'high' ? 4 : songEnergy === 'medium' ? 2.5 : 1;

  // Assign positions avoiding overlap
  const usedPositions = new Set<string>();
  const positionedMembers = members.map((m) => {
    const roleKey = m.instrumentRole.toLowerCase().replace(/\s+/g, '_');
    let config = INSTRUMENT_CONFIG[roleKey] || DEFAULT_CONFIG;

    let posKey = `${config.col}-${config.row}`;
    if (usedPositions.has(posKey)) {
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
      {/* Stage floor with theme */}
      <div className="absolute inset-0" style={{ background: theme.floorGradient }} />

      {/* Floor pattern */}
      {theme.floorPattern && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: theme.floorPattern,
            opacity: theme.floorPatternOpacity,
          }}
        />
      )}

      {/* Backdrop wall */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: `${100 - theme.stageDepthPercent}%`,
          background: theme.backdropGradient,
        }}
      >
        {theme.backdropPattern && (
          <div className="absolute inset-0" style={{ backgroundImage: theme.backdropPattern, opacity: 0.5 }} />
        )}

        {/* LED screen effect for arena/stadium */}
        {(theme.id === 'arena' || theme.id === 'stadium') && (
          <motion.div
            className="absolute inset-[8%] rounded-sm overflow-hidden"
            style={{
              background: theme.backdropPattern ? undefined : `radial-gradient(ellipse, ${lightingColor}15 0%, transparent 70%)`,
            }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        )}
      </div>

      {/* Side curtains */}
      {theme.hasCurtains && (
        <>
          <div
            className="absolute top-0 bottom-0 left-0 w-[4%]"
            style={{
              backgroundColor: theme.sideWallColor,
              borderRight: theme.sideWallBorder,
            }}
          >
            {theme.curtainStyle === 'fabric' && (
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'repeating-linear-gradient(180deg, transparent, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 8px)',
              }} />
            )}
          </div>
          <div
            className="absolute top-0 bottom-0 right-0 w-[4%]"
            style={{
              backgroundColor: theme.sideWallColor,
              borderLeft: theme.sideWallBorder,
            }}
          >
            {theme.curtainStyle === 'fabric' && (
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'repeating-linear-gradient(180deg, transparent, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 8px)',
              }} />
            )}
          </div>
        </>
      )}

      {/* Ambient glow */}
      <motion.div
        className="absolute top-0 left-1/4 w-1/2 h-full rounded-full blur-3xl"
        style={{
          backgroundColor: theme.ambientGlowColor,
          opacity: theme.ambientGlowOpacity,
        }}
        animate={{ opacity: [theme.ambientGlowOpacity * 0.5, theme.ambientGlowOpacity, theme.ambientGlowOpacity * 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Bass pulse border effect (genre-driven) */}
      {genreVisuals?.bassPulse && songEnergy !== 'low' && (
        <motion.div
          className="absolute inset-0 border-2 rounded-sm pointer-events-none z-[8]"
          style={{ borderColor: lightingColor }}
          animate={{ opacity: [0, 0.4, 0], scale: [1, 1.005, 1] }}
          transition={{
            duration: songEnergy === 'high' ? 0.5 : 0.8,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      )}

      {/* Stage equipment layer */}
      <StageEquipment theme={theme} songEnergy={songEnergy} />

      {/* Lighting layer */}
      <StageLighting
        theme={theme}
        lightingColor={lightingColor}
        songEnergy={songEnergy}
        crowdMood={crowdMood || 'engaged'}
        intensity={intensity}
      />

      {/* Stage edge */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: theme.stageEdgeHeight,
          background: theme.stageEdgeGradient,
        }}
      />

      {/* Band members layer */}
      <div className="absolute inset-0 flex items-center justify-center z-[6]">
        <div className="relative" style={{ width: '85%', height: '70%' }}>
          {positionedMembers.map(({ member, config }, idx) => (
            <MemberSprite
              key={member.id}
              member={member}
              config={config}
              idx={idx}
              songEnergy={songEnergy}
              bobSpeed={bobSpeed}
              bobAmount={bobAmount}
              showStats={showStats}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
