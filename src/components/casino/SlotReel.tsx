import { getSymbolEmoji } from "@/lib/casino/slots";
import type { SlotSymbol } from "@/lib/casino/types";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SlotReelProps {
  symbol: SlotSymbol | null;
  spinning: boolean;
  delay?: number;
}

export function SlotReel({ symbol, spinning, delay = 0 }: SlotReelProps) {
  return (
    <div className="w-24 h-24 rounded-lg border-2 border-primary/40 bg-card/80 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {spinning ? (
          <motion.div
            key="spinning"
            animate={{ y: [0, -40, 0, 40, 0] }}
            transition={{ duration: 0.15, repeat: Infinity, delay }}
            className="text-5xl"
          >
            🎵
          </motion.div>
        ) : symbol ? (
          <motion.div
            key={symbol}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4, delay }}
            className="text-5xl"
          >
            {getSymbolEmoji(symbol)}
          </motion.div>
        ) : (
          <div className="text-5xl opacity-30">❓</div>
        )}
      </AnimatePresence>
    </div>
  );
}
