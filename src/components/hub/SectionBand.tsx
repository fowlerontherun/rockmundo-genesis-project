import type { ReactNode } from "react";

/**
 * Section heading band — a thin accent tick + display title with an
 * optional waveform tail to keep the music-sim aesthetic consistent
 * across every hub.
 */
export const SectionBand = ({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <header className="relative flex items-end justify-between border-b border-fm-border pb-2">
      <div className="flex items-center gap-2.5">
        <span className="w-1 h-5 bg-fm-accent rounded-[1px]" />
        <h3 className="font-display text-base md:text-lg tracking-tight text-fm-fg leading-none font-bold uppercase">
          {label}
        </h3>
        <span className="hidden md:block rm-waveform w-16 h-3 opacity-50" aria-hidden />
      </div>
      {typeof count === "number" && (
        <span className="text-[10px] text-fm-fg-muted uppercase tracking-[0.18em] tabular-nums font-semibold">
          {count} ITEMS
        </span>
      )}
    </header>
    {children}
  </section>
);
