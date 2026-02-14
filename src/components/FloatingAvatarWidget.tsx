import { useGameData } from "@/hooks/useGameData";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Star, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export const FloatingAvatarWidget = () => {
  const { profile, xpWallet } = useGameData();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (!profile) return null;

  const avatarUrl = (profile as any)?.avatar_url ?? undefined;
  const displayName = profile?.display_name || profile?.username || "Player";
  const level = (profile as any)?.level ?? 1;
  const fame = (profile as any)?.fame ?? 0;

  return (
    <motion.div
      className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.3 }}
    >
      {/* Expanded info panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-xl min-w-[160px]"
          >
            <p className="text-sm font-oswald font-semibold text-foreground truncate max-w-[140px]">
              {displayName}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 text-warning" />
              <span>Lvl {level}</span>
              <span className="text-border">•</span>
              <Zap className="h-3 w-3 text-primary" />
              <span>{fame.toLocaleString()} fame</span>
            </div>
            <button
              onClick={() => navigate("/my-character")}
              className="mt-2 text-[10px] text-primary hover:underline font-medium"
            >
              View Character →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setExpanded(!expanded)}
        className="relative h-14 w-14 rounded-full ring-2 ring-primary/60 ring-offset-2 ring-offset-background shadow-lg hover:ring-primary transition-all"
      >
        <Avatar className="h-14 w-14">
          <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
          <AvatarFallback className="bg-primary/20 text-primary">
            <User className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        {/* Level badge */}
        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow">
          {level}
        </span>
      </motion.button>
    </motion.div>
  );
};
