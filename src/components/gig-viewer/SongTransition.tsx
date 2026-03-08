import { motion, AnimatePresence } from "framer-motion";

interface SongTransitionProps {
  isTransitioning: boolean;
  songTitle: string;
  songIndex: number;
  isEncore: boolean;
  isFinale: boolean;
}

export const SongTransition = ({ isTransitioning, songTitle, songIndex, isEncore, isFinale }: SongTransitionProps) => {
  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          className="absolute inset-0 z-[15] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Dimming overlay */}
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Song title card */}
          <motion.div
            className="relative z-10 text-center"
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {/* Encore banner */}
            {isEncore && (
              <motion.div
                className="text-[10px] font-bold tracking-[0.3em] uppercase text-amber-400 mb-1"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ★ ENCORE ★
              </motion.div>
            )}

            {/* Finale banner */}
            {isFinale && (
              <motion.div
                className="text-[10px] font-bold tracking-[0.3em] uppercase text-red-400 mb-1"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                🔥 FINAL SONG 🔥
              </motion.div>
            )}

            {/* Song number */}
            <div className="text-[8px] text-muted-foreground mb-0.5">
              Song {songIndex + 1}
            </div>

            {/* Song title */}
            <motion.div
              className="text-sm font-black text-white tracking-wide"
              style={{
                textShadow: '0 0 20px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              {songTitle}
            </motion.div>

            {/* Decorative line */}
            <motion.div
              className="mx-auto mt-1 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent"
              initial={{ width: 0 }}
              animate={{ width: 80 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
