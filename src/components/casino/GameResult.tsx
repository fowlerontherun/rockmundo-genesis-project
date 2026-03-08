import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GameResultProps {
  result: "win" | "lose" | "push" | "blackjack" | "bust" | "jackpot";
  amount: number;
  message?: string;
}

const resultConfig = {
  win: { label: "WIN!", color: "bg-green-600 text-white", emoji: "🎉" },
  blackjack: { label: "BLACKJACK!", color: "bg-yellow-500 text-black", emoji: "🃏" },
  jackpot: { label: "JACKPOT!", color: "bg-yellow-400 text-black", emoji: "💎" },
  push: { label: "PUSH", color: "bg-muted text-muted-foreground", emoji: "🤝" },
  lose: { label: "LOSE", color: "bg-destructive text-destructive-foreground", emoji: "😔" },
  bust: { label: "BUST!", color: "bg-destructive text-destructive-foreground", emoji: "💥" },
};

export function GameResult({ result, amount, message }: GameResultProps) {
  const config = resultConfig[result];

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-2 py-4"
    >
      <div className="text-4xl">{config.emoji}</div>
      <Badge className={cn("text-lg px-4 py-1", config.color)}>
        {config.label}
      </Badge>
      {amount !== 0 && (
        <p className={cn(
          "text-xl font-bold",
          amount > 0 ? "text-green-500" : "text-destructive"
        )}>
          {amount > 0 ? `+$${amount.toLocaleString()}` : `-$${Math.abs(amount).toLocaleString()}`}
        </p>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </motion.div>
  );
}
