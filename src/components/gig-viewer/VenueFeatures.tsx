import { motion } from "framer-motion";
import type { StageThemeConfig } from "./StageThemes";

interface VenueFeaturesProps {
  theme: StageThemeConfig;
  intensity: number;
}

export const VenueFeatures = ({ theme, intensity }: VenueFeaturesProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-[3]">
      {/* Barrier/fence line at top (between stage and crowd) */}
      {theme.hasBarrier && (
        <div className="absolute top-0 left-[3%] right-[3%]">
          {/* Metal barrier */}
          <div className="h-[3px] bg-gradient-to-r from-zinc-600/60 via-zinc-400/80 to-zinc-600/60 rounded-full" />
          {/* Barrier posts */}
          <div className="flex justify-between px-2 -mt-[2px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`post-${i}`} className="w-1 h-2 bg-zinc-500/60 rounded-sm" />
            ))}
          </div>
          {/* Security guards */}
          {theme.securityGuards > 0 && (
            <div className="flex justify-around mt-0.5 px-[10%]">
              {Array.from({ length: Math.min(theme.securityGuards, 6) }).map((_, i) => (
                <div
                  key={`guard-${i}`}
                  className="w-2.5 h-2.5 rounded-full bg-zinc-700 border border-zinc-500/50"
                  title="Security"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photo pit gap for larger venues */}
      {theme.hasPhotoPit && (
        <div className="absolute top-[3%] left-[8%] right-[8%] h-[6%] bg-zinc-900/40 border-b border-zinc-700/20">
          {/* Photographers */}
          {[20, 40, 65, 85].map(pos => (
            <motion.div
              key={`photo-${pos}`}
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-500"
              style={{ left: `${pos}%` }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: pos * 0.02 }}
            >
              {/* Camera flash */}
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-white rounded-full"
                animate={{ opacity: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: pos * 0.05 }}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Sound desk in center-back */}
      {theme.hasSoundDesk && (
        <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2">
          <div className="w-12 h-5 bg-zinc-800 border border-zinc-600/50 rounded-sm relative">
            {/* Console lights */}
            <div className="absolute top-0.5 left-0.5 right-0.5 flex gap-[1px]">
              {[...Array(6)].map((_, i) => (
                <div key={`fader-${i}`} className="flex-1 h-0.5 bg-green-500/40 rounded-full" />
              ))}
            </div>
            {/* Sound engineer */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-zinc-500 border border-zinc-400/30" />
          </div>
          <div className="text-[5px] text-zinc-600 text-center mt-0.5">FOH</div>
        </div>
      )}

      {/* Merch booth on right side */}
      {theme.hasMerchBooth && (
        <div className="absolute bottom-[15%] right-[3%]">
          <div className="w-8 h-5 bg-zinc-800/80 border border-zinc-600/40 rounded-sm relative">
            <div className="text-[5px] text-zinc-500 text-center mt-0.5">MERCH</div>
            {/* Merch person */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-700/60" />
          </div>
        </div>
      )}

      {/* Bar area on left side */}
      {theme.hasBarArea && (
        <div className="absolute bottom-[10%] left-[3%]">
          <div className="w-8 h-6 bg-zinc-800/70 border border-zinc-600/30 rounded-sm relative">
            <div className="text-[5px] text-zinc-500 text-center mt-0.5">BAR</div>
            {/* Bar patrons - not bouncing, just standing */}
            <div className="flex gap-0.5 justify-center mt-0.5">
              {[...Array(3)].map((_, i) => (
                <div key={`patron-${i}`} className="w-1 h-1 rounded-full bg-zinc-500/50" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIP section */}
      {theme.hasVipSection && (
        <div className="absolute top-[12%] right-[3%] w-[12%] h-[30%] border border-amber-600/20 rounded-sm bg-amber-900/5">
          <div className="text-[5px] text-amber-600/40 text-center mt-0.5 font-bold">VIP</div>
          {/* VIP attendees - slightly different appearance */}
          <div className="flex flex-wrap gap-0.5 justify-center mt-1 px-0.5">
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={`vip-${i}`}
                className="w-1.5 h-1.5 rounded-full bg-amber-500/40"
                animate={{ y: [0, -1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
