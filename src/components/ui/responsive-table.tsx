import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps any <Table> to guarantee horizontal scroll on narrow viewports
 * and applies mobile-friendly text sizing.
 */
export function ResponsiveTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0",
        "[&_table]:min-w-[480px] [&_table]:text-xs md:[&_table]:text-sm",
        "[&_th]:px-2 [&_td]:px-2 md:[&_th]:px-4 md:[&_td]:px-4",
        "[&_th]:py-2 [&_td]:py-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
