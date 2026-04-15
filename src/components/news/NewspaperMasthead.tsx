import { Badge } from "@/components/ui/badge";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { format } from "date-fns";

const TAGLINES = [
  "All the News That Rocks",
  "Your Daily Dose of Rock & Roll",
  "Where Music Meets the World",
  "The Voice of the Music Industry",
  "Amplifying the Truth Since Day 1",
  "Rocking Headlines, Rolling Stories",
  "The Sound of Breaking News",
  "Turning Up the Volume on Truth",
];

const QUOTES = [
  { text: "Music is the universal language of mankind.", author: "Henry Wadsworth Longfellow" },
  { text: "Without music, life would be a mistake.", author: "Friedrich Nietzsche" },
  { text: "Where words fail, music speaks.", author: "Hans Christian Andersen" },
  { text: "Music gives a soul to the universe.", author: "Plato" },
  { text: "One good thing about music, when it hits you, you feel no pain.", author: "Bob Marley" },
  { text: "Rock and roll is here to stay.", author: "Neil Young" },
  { text: "The only truth is music.", author: "Jack Kerouac" },
];

function seededIndex(seed: string, len: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % len;
}

export function NewspaperMasthead() {
  const { data: calendar } = useGameCalendar();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tagline = TAGLINES[seededIndex(todayStr, TAGLINES.length)];
  const quote = QUOTES[seededIndex(todayStr + "q", QUOTES.length)];
  const editionNumber = calendar?.gameDay || Math.floor((Date.now() - new Date("2026-01-01").getTime()) / 86400000);

  return (
    <div className="border-b-4 border-double border-foreground pb-4 mb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border-b border-border pb-1 mb-2">
        <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
        <span>Edition No. {editionNumber}</span>
        <span>
          {calendar && (
            <>{calendar.seasonEmoji} {calendar.season} · Year {calendar.gameYear}</>
          )}
        </span>
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-black tracking-tight leading-none">
          The Rockmundo Times
        </h1>
        <p className="text-xs sm:text-sm italic text-muted-foreground mt-1 font-serif">
          "{tagline}"
        </p>
      </div>

      {/* Bottom bar with quote */}
      <div className="flex items-center justify-center mt-3 pt-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground italic text-center font-serif">
          💬 "{quote.text}" — <span className="not-italic font-medium">{quote.author}</span>
        </p>
      </div>
    </div>
  );
}
