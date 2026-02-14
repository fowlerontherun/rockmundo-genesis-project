import { useGameData } from "@/hooks/useGameData";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useUnreadInboxCount } from "@/hooks/useInbox";

export const FloatingAvatarWidget = () => {
  const { profile } = useGameData();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadInboxCount();

  if (!profile) return null;

  const avatarUrl = (profile as any)?.avatar_url ?? undefined;
  const displayName = profile?.display_name || profile?.username || "Player";
  const count = unreadCount || 0;

  return (
    <motion.div
      className="fixed bottom-24 right-4 z-50"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.3 }}
    >
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/inbox")}
        className="relative h-14 w-14 rounded-full ring-2 ring-primary/60 ring-offset-2 ring-offset-background shadow-lg hover:ring-primary transition-all"
      >
        <Avatar className="h-14 w-14">
          <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
          <AvatarFallback className="bg-primary/20 text-primary">
            <User className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </motion.button>
    </motion.div>
  );
};
