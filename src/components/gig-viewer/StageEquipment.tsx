import { motion } from "framer-motion";
import type { StageThemeConfig } from "./StageThemes";

interface StageEquipmentProps {
  theme: StageThemeConfig;
  songEnergy: 'high' | 'medium' | 'low';
}

export const StageEquipment = ({ theme, songEnergy }: StageEquipmentProps) => {
  const scale = theme.equipmentScale;
  const isLarge = scale === 'large' || scale === 'massive';
  const isMassive = scale === 'massive';

  return (
    <div className="absolute inset-0 pointer-events-none z-[2]">
      {/* Monitor wedges along front of stage */}
      {theme.hasMonitors && (
        <div className="absolute bottom-[8%] left-[10%] right-[10%] flex justify-around">
          {Array.from({ length: isLarge ? 5 : 3 }).map((_, i) => (
            <div
              key={`monitor-${i}`}
              className="relative"
              style={{ width: isLarge ? 14 : 10, height: isLarge ? 8 : 6 }}
            >
              <div
                className="w-full h-full bg-zinc-700 border border-zinc-600"
                style={{
                  clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
                }}
              />
              {/* Monitor screen glow */}
              <div
                className="absolute top-0 left-[20%] right-[20%] h-[40%] bg-green-500/20 rounded-sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Speaker stacks - left side */}
      <div className="absolute left-[1%] top-[15%]" style={{ width: isMassive ? 22 : isLarge ? 16 : scale === 'standard' ? 12 : 8 }}>
        {Array.from({ length: isMassive ? 4 : isLarge ? 3 : scale === 'standard' ? 2 : 1 }).map((_, i) => (
          <div key={`speaker-l-${i}`} className="mb-0.5">
            <div className="w-full aspect-square bg-zinc-800 border border-zinc-600 rounded-sm relative overflow-hidden">
              {/* Speaker cone */}
              <div className="absolute inset-[15%] rounded-full border border-zinc-500 bg-zinc-900" />
              <div className="absolute inset-[35%] rounded-full bg-zinc-700" />
            </div>
          </div>
        ))}
      </div>

      {/* Speaker stacks - right side */}
      <div className="absolute right-[1%] top-[15%]" style={{ width: isMassive ? 22 : isLarge ? 16 : scale === 'standard' ? 12 : 8 }}>
        {Array.from({ length: isMassive ? 4 : isLarge ? 3 : scale === 'standard' ? 2 : 1 }).map((_, i) => (
          <div key={`speaker-r-${i}`} className="mb-0.5">
            <div className="w-full aspect-square bg-zinc-800 border border-zinc-600 rounded-sm relative overflow-hidden">
              <div className="absolute inset-[15%] rounded-full border border-zinc-500 bg-zinc-900" />
              <div className="absolute inset-[35%] rounded-full bg-zinc-700" />
            </div>
          </div>
        ))}
      </div>

      {/* Amp stacks behind guitarist positions */}
      {scale !== 'minimal' && (
        <>
          {/* Left amp */}
          <div className="absolute left-[15%] top-[20%]" style={{ width: isLarge ? 16 : 12 }}>
            <div className="w-full aspect-[3/4] bg-zinc-800 border border-zinc-700 rounded-sm relative overflow-hidden">
              {/* Grille pattern */}
              <div
                className="absolute inset-[8%] opacity-40"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)',
                }}
              />
              {/* Amp logo */}
              <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[60%] h-1 bg-amber-600/40 rounded-full" />
            </div>
          </div>
          {/* Right amp */}
          <div className="absolute right-[15%] top-[20%]" style={{ width: isLarge ? 16 : 12 }}>
            <div className="w-full aspect-[3/4] bg-zinc-800 border border-zinc-700 rounded-sm relative overflow-hidden">
              <div
                className="absolute inset-[8%] opacity-40"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)',
                }}
              />
              <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[60%] h-1 bg-amber-600/40 rounded-full" />
            </div>
          </div>
        </>
      )}

      {/* Drum riser platform */}
      <div
        className="absolute top-[25%] left-1/2 -translate-x-1/2 bg-zinc-700/50 border border-zinc-600/30 rounded-sm"
        style={{
          width: isLarge ? 60 : 44,
          height: isLarge ? 35 : 26,
        }}
      >
        {/* Riser edge highlight */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-zinc-500/30 to-transparent" />
      </div>

      {/* Pedalboards near guitarist feet */}
      {scale !== 'minimal' && (
        <>
          <div className="absolute left-[22%] bottom-[25%] flex gap-[1px]">
            {[...Array(3)].map((_, i) => (
              <div key={`pedal-l-${i}`} className="w-1.5 h-2 bg-zinc-600 rounded-[1px] border border-zinc-500">
                <div className={`w-0.5 h-0.5 rounded-full mx-auto mt-[1px] ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-green-500' : 'bg-blue-500'}`} />
              </div>
            ))}
          </div>
          <div className="absolute right-[22%] bottom-[25%] flex gap-[1px]">
            {[...Array(2)].map((_, i) => (
              <div key={`pedal-r-${i}`} className="w-1.5 h-2 bg-zinc-600 rounded-[1px] border border-zinc-500">
                <div className={`w-0.5 h-0.5 rounded-full mx-auto mt-[1px] ${i === 0 ? 'bg-amber-500' : 'bg-purple-500'}`} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Cable runs */}
      {scale !== 'minimal' && (
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 15 30 Q 25 60 40 75" stroke="currentColor" strokeWidth="0.3" fill="none" className="text-white" />
          <path d="M 85 30 Q 75 55 60 75" stroke="currentColor" strokeWidth="0.3" fill="none" className="text-white" />
          <path d="M 50 35 Q 50 55 50 80" stroke="currentColor" strokeWidth="0.2" fill="none" className="text-white" />
        </svg>
      )}

      {/* Mic stands at vocalist positions */}
      <div className="absolute left-[48%] top-[15%]">
        <div className="w-[2px] h-5 bg-zinc-400 mx-auto" />
        <div className="w-2 h-1 bg-zinc-500 rounded-full -mt-0.5 -ml-[3px]" />
      </div>

      {/* Stage tape marks (X marks) */}
      {isLarge && (
        <>
          {[20, 40, 60, 80].map(pos => (
            <div
              key={`tape-${pos}`}
              className="absolute bottom-[18%] text-[6px] text-yellow-500/20 font-bold"
              style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
            >
              ✕
            </div>
          ))}
        </>
      )}

      {/* LED strip along front edge */}
      {theme.hasLedStrips && (
        <motion.div
          className="absolute bottom-0 left-[5%] right-[5%] h-[2px] rounded-full"
          style={{
            background: songEnergy === 'high'
              ? 'linear-gradient(90deg, hsl(0, 80%, 50%), hsl(60, 80%, 50%), hsl(120, 80%, 50%), hsl(180, 80%, 50%), hsl(240, 80%, 50%), hsl(300, 80%, 50%), hsl(0, 80%, 50%))'
              : songEnergy === 'medium'
                ? 'linear-gradient(90deg, hsl(220, 70%, 40%), hsl(260, 70%, 50%), hsl(220, 70%, 40%))'
                : 'linear-gradient(90deg, hsl(220, 40%, 25%), hsl(240, 40%, 30%), hsl(220, 40%, 25%))',
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: songEnergy === 'high' ? ['0% 0%', '200% 0%'] : ['0% 0%', '100% 0%'],
          }}
          transition={{
            duration: songEnergy === 'high' ? 2 : 4,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}
    </div>
  );
};
