import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";

export interface CommentaryEntry {
  id: string;
  timestamp: Date;
  type: string;
  message: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

interface TopDownCommentaryProps {
  entries: CommentaryEntry[];
}

const variantStyles: Record<string, string> = {
  success: 'text-green-400',
  warning: 'text-yellow-400',
  destructive: 'text-red-400',
  default: 'text-white/80',
};

const typeIcons: Record<string, string> = {
  arrival: '🎭',
  song_start: '🎸',
  crowd_reaction: '👥',
  special_moment: '⭐',
  finale: '🎆',
};

export const TopDownCommentary = ({ entries }: TopDownCommentaryProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-2 px-3 pointer-events-auto">
        <ScrollArea className="h-24">
          <div className="space-y-1">
            {entries.slice(-8).map((entry) => (
              <p
                key={entry.id}
                className={`text-[11px] leading-tight ${variantStyles[entry.variant || 'default']}`}
              >
                <span className="mr-1">{typeIcons[entry.type] || '📢'}</span>
                {entry.message}
              </p>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
