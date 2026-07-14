import { ReactNode, useRef, useState, TouchEvent } from "react";
import { cn } from "@/lib/utils";

export interface SwipeTab {
  key: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface SwipeTabsProps {
  tabs: SwipeTab[];
  initial?: string;
}

export const SwipeTabs = ({ tabs, initial }: SwipeTabsProps) => {
  const [active, setActive] = useState(initial ?? tabs[0]?.key);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const idx = Math.max(0, tabs.findIndex((t) => t.key === active));

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && idx < tabs.length - 1) setActive(tabs[idx + 1].key);
      else if (dx > 0 && idx > 0) setActive(tabs[idx - 1].key);
    }
    startX.current = startY.current = null;
  };

  return (
    <div>
      <div className="sticky top-[calc(var(--m-appbar-h))] z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex overflow-x-auto no-scrollbar rm-mobile-scroll">
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={cn(
                  "flex-1 min-w-[80px] py-2.5 px-3 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors",
                  on ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                )}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {t.icon}
                  {t.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="pt-3">
        {tabs[idx]?.content}
      </div>
    </div>
  );
};
