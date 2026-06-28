import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * TicketStub — a horizontal card split by a perforated divider, evoking
 * a concert ticket. Use for gigs, events, releases, anything with a
 * "claim / details" pairing.
 */
export const TicketStub = ({
  children,
  stub,
  className,
  onClick,
}: {
  children: ReactNode;
  stub?: ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={cn(
      "relative flex items-stretch border border-fm-border bg-fm-panel rounded-lg overflow-hidden rm-card-hover",
      onClick && "cursor-pointer",
      className,
    )}
  >
    <div className="flex-1 p-3">{children}</div>
    {stub && (
      <>
        <div className="w-px rm-ticket-perf shrink-0" />
        <div className="w-24 shrink-0 bg-fm-panel-2 p-3 flex flex-col items-center justify-center text-center">
          {stub}
        </div>
      </>
    )}
  </div>
);

export default TicketStub;
