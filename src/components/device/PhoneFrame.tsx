import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PhoneFrameProps {
  children: ReactNode;
  /** Accessible name for the phone screen region. */
  label: string;
  className?: string;
  screenClassName?: string;
}

/**
 * Purely decorative smartphone presentation for in-game social apps.
 * Below the md breakpoint the bezel disappears and content flows normally
 * (respecting safe areas) so real phones get the full viewport.
 * Dialogs/menus portal to <body>, so the frame never clips them.
 */
export function PhoneFrame({ children, label, className, screenClassName }: PhoneFrameProps) {
  return (
    <div className={cn("md:flex md:justify-center md:py-4", className)}>
      <div
        className={cn(
          "relative w-full",
          "md:w-[414px] md:shrink-0 md:rounded-[3rem] md:bg-foreground/90 md:p-3",
          "md:shadow-[0_30px_60px_-20px_hsl(var(--foreground)/0.45),0_0_0_1px_hsl(var(--border)),inset_0_0_0_2px_hsl(var(--muted-foreground)/0.35)]",
        )}
      >
        {/* Side buttons */}
        <span aria-hidden className="hidden md:block absolute -left-[3px] top-28 h-10 w-[3px] rounded-l bg-foreground/70" />
        <span aria-hidden className="hidden md:block absolute -left-[3px] top-44 h-16 w-[3px] rounded-l bg-foreground/70" />
        <span aria-hidden className="hidden md:block absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-foreground/70" />

        <div className="relative md:overflow-hidden md:rounded-[2.4rem] md:bg-background">
          {/* Dynamic island */}
          <div aria-hidden className="hidden md:flex absolute left-1/2 top-2.5 z-[60] -translate-x-1/2 h-7 w-28 items-center justify-end rounded-full bg-foreground pr-3">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 ring-1 ring-muted-foreground/30" />
          </div>

          <div
            role="region"
            aria-label={label}
            tabIndex={-1}
            className={cn(
              "pb-[env(safe-area-inset-bottom,0px)]",
              "md:h-[min(844px,calc(100dvh-12rem))] md:min-h-[560px] md:overflow-y-auto md:overscroll-contain md:pt-11 md:pb-6",
              "md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden",
              screenClassName,
            )}
          >
            {children}
          </div>

          {/* Home indicator */}
          <div aria-hidden className="hidden md:block pointer-events-none absolute bottom-2 left-1/2 z-[60] h-1.5 w-32 -translate-x-1/2 rounded-full bg-foreground/60" />
        </div>
      </div>
    </div>
  );
}

export default PhoneFrame;
