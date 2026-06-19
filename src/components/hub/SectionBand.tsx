import type { ReactNode } from "react";

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
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 bg-fm-accent" />
        <h3 className="font-bebas text-xl md:text-2xl tracking-wide uppercase text-fm-fg leading-none">
          {label}
        </h3>
      </div>
      {typeof count === "number" && (
        <span className="text-[10px] text-fm-fg-muted uppercase tracking-[0.18em] tabular-nums">
          {count} ITEMS
        </span>
      )}
    </header>
    {children}
  </section>
);
