import { useEffect, useState } from "react";
import { CHRISTMAS_OPT_OUT_KEY, isChristmasSeason } from "./christmas";

const FLAKES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 1.7) % 12,
  duration: 9 + ((i * 5) % 9),
  size: 6 + ((i * 3) % 8),
}));
const BULBS = ["hsl(0 80% 55%)", "hsl(140 65% 40%)", "hsl(45 95% 55%)", "hsl(210 85% 60%)"];

/** Light snowfall, a string of fairy lights and a small toggle. Purely cosmetic. */
export function ChristmasDecorations() {
  const [off, setOff] = useState(() => {
    try { return localStorage.getItem(CHRISTMAS_OPT_OUT_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { off ? localStorage.setItem(CHRISTMAS_OPT_OUT_KEY, "1") : localStorage.removeItem(CHRISTMAS_OPT_OUT_KEY); } catch { /* ignore */ }
  }, [off]);
  if (!isChristmasSeason()) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOff((v) => !v)}
        className="fixed bottom-2 left-2 z-[60] rounded-full border border-border bg-card/90 px-2 py-1 text-[10px] text-foreground shadow"
        aria-label={off ? "Turn Christmas decorations on" : "Turn Christmas decorations off"}
      >
        {off ? "🎄 Festive on" : "❄️ Festive off"}
      </button>
      {!off && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[55] overflow-hidden motion-reduce:hidden">
          <div className="absolute inset-x-0 top-0 flex justify-around">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="xmas-bulb mt-0.5 h-2 w-1.5 rounded-full" style={{ background: BULBS[i % 4], animationDelay: `${(i % 4) * 0.4}s` }} />
            ))}
          </div>
          {FLAKES.map((f, i) => (
            <span key={i} className="xmas-flake absolute -top-4 text-foreground/60"
              style={{ left: `${f.left}%`, fontSize: f.size, animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` }}>❄</span>
          ))}
        </div>
      )}
    </>
  );
}
