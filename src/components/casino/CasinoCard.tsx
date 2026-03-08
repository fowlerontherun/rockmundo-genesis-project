import type { PlayingCard } from "@/lib/casino/types";
import { cn } from "@/lib/utils";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "text-red-500", diamonds: "text-red-500",
  clubs: "text-foreground", spades: "text-foreground",
};

interface CasinoCardProps {
  card: PlayingCard;
  className?: string;
  small?: boolean;
}

export function CasinoCard({ card, className, small }: CasinoCardProps) {
  if (!card.faceUp) {
    return (
      <div className={cn(
        "rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center",
        small ? "w-12 h-16 text-lg" : "w-16 h-22 text-2xl",
        className
      )}>
        <span className="text-primary-foreground font-bold">?</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border border-border bg-card shadow-md flex flex-col items-center justify-between",
      small ? "w-12 h-16 p-0.5 text-xs" : "w-16 h-22 p-1 text-sm",
      className
    )}>
      <div className={cn("self-start font-bold", SUIT_COLORS[card.suit])}>
        {card.rank}
      </div>
      <div className={cn("text-xl", small && "text-base", SUIT_COLORS[card.suit])}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
      <div className={cn("self-end font-bold rotate-180", SUIT_COLORS[card.suit])}>
        {card.rank}
      </div>
    </div>
  );
}
