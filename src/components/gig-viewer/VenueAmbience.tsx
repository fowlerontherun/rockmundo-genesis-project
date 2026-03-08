import { motion } from "framer-motion";
import type { StageThemeConfig } from "./StageThemes";

interface VenueAmbienceProps {
  theme: StageThemeConfig;
  lightingColor: string;
  songEnergy: 'high' | 'medium' | 'low';
}

export const VenueAmbience = ({ theme, lightingColor, songEnergy }: VenueAmbienceProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-[2]">
      {/* Exit signs — all indoor venues */}
      {theme.hasCurtains && (
        <>
          <div className="absolute top-[2%] left-[1%]">
            <div className="px-1 py-0.5 bg-green-700/80 rounded-[1px] border border-green-500/40">
              <span className="text-[4px] font-bold text-green-300 tracking-wider">EXIT</span>
            </div>
          </div>
          <div className="absolute top-[2%] right-[1%]">
            <div className="px-1 py-0.5 bg-green-700/80 rounded-[1px] border border-green-500/40">
              <span className="text-[4px] font-bold text-green-300 tracking-wider">EXIT</span>
            </div>
          </div>
        </>
      )}

      {/* Bar neon sign */}
      {theme.id === 'bar' && (
        <motion.div
          className="absolute top-[5%] right-[6%]"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <div
            className="px-1.5 py-0.5 rounded-sm"
            style={{
              border: '1px solid hsl(35, 80%, 50%)',
              boxShadow: '0 0 6px hsl(35, 80%, 50%), inset 0 0 4px hsl(35, 80%, 40%)',
            }}
          >
            <span className="text-[5px] font-bold" style={{ color: 'hsl(35, 80%, 60%)' }}>
              OPEN MIC
            </span>
          </div>
        </motion.div>
      )}

      {/* Rock club band posters on walls */}
      {theme.id === 'rock_club' && (
        <>
          <div className="absolute top-[8%] left-[5%] w-3 h-4 bg-zinc-700/50 border border-zinc-600/30 rounded-[1px]">
            <div className="w-full h-[60%] bg-red-900/30" />
            <div className="px-0.5 mt-0.5">
              <div className="w-full h-[1px] bg-zinc-500/30" />
              <div className="w-[60%] h-[1px] bg-zinc-500/20 mt-[1px]" />
            </div>
          </div>
          <div className="absolute top-[6%] right-[5%] w-3 h-4 bg-zinc-700/50 border border-zinc-600/30 rounded-[1px]">
            <div className="w-full h-[60%] bg-purple-900/30" />
            <div className="px-0.5 mt-0.5">
              <div className="w-full h-[1px] bg-zinc-500/30" />
            </div>
          </div>
        </>
      )}

      {/* Indie venue string lights */}
      {theme.id === 'indie_venue' && (
        <div className="absolute top-[1%] left-[5%] right-[5%] flex justify-between">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={`bulb-${i}`}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: i % 3 === 0 ? 'hsl(45, 90%, 65%)' : i % 3 === 1 ? 'hsl(0, 80%, 60%)' : 'hsl(200, 70%, 60%)',
                boxShadow: `0 0 3px ${i % 3 === 0 ? 'hsl(45, 90%, 65%)' : i % 3 === 1 ? 'hsl(0, 80%, 60%)' : 'hsl(200, 70%, 60%)'}`,
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
          {/* String line */}
          <svg className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 opacity-20" preserveAspectRatio="none">
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="0.5" />
          </svg>
        </div>
      )}

      {/* Concert hall chandelier-style lights */}
      {theme.id === 'concert_hall' && (
        <div className="absolute top-[2%] left-1/2 -translate-x-1/2 flex gap-8">
          {[0, 1, 2].map(i => (
            <motion.div
              key={`chandelier-${i}`}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: 'hsl(40, 80%, 70%)',
                boxShadow: '0 0 8px hsl(40, 80%, 60%), 0 4px 12px hsl(40, 60%, 40%)',
              }}
              animate={{ opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}
        </div>
      )}

      {/* Stadium firework launcher racks (corners) */}
      {theme.id === 'stadium' && (
        <>
          {[{ left: '2%' }, { right: '2%' }].map((pos, i) => (
            <div
              key={`launcher-${i}`}
              className="absolute bottom-[2%]"
              style={{ ...pos }}
            >
              <div className="flex gap-[1px]">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="w-1 h-3 bg-zinc-600 border border-zinc-500/30 rounded-t-sm" />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Festival ground flags/banners */}
      {theme.id === 'festival_ground' && (
        <>
          {[12, 88].map((pos, i) => (
            <div key={`flag-${i}`} className="absolute top-0" style={{ left: `${pos}%` }}>
              <div className="w-[1px] h-6 bg-zinc-500/40 mx-auto" />
              <motion.div
                className="w-3 h-2 rounded-sm -mt-0.5"
                style={{
                  backgroundColor: i === 0 ? 'hsl(0, 70%, 50%)' : 'hsl(200, 70%, 50%)',
                  opacity: 0.5,
                  transformOrigin: 'left center',
                }}
                animate={{ skewX: [-2, 4, -2] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          ))}
        </>
      )}

      {/* Arena spotlight rigs on ceiling edges */}
      {theme.id === 'arena' && (
        <>
          {[5, 95].map((pos, i) => (
            <div key={`rig-${i}`} className="absolute top-[1%]" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
              <div className="w-4 h-1.5 bg-zinc-700 border border-zinc-600/40 rounded-sm flex items-center justify-center gap-[2px]">
                {[...Array(3)].map((_, j) => (
                  <motion.div
                    key={j}
                    className="w-0.5 h-0.5 rounded-full"
                    style={{ backgroundColor: lightingColor }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: j * 0.2 + i * 0.5 }}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
