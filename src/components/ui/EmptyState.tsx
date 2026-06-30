import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spec §2.6 — dashed border, accent icon chip, headline + reason + one action.
 */
export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-[12px] border border-dashed border-fm-border bg-fm-panel/30 px-6 py-8 flex flex-col items-center text-center gap-3",
      className,
    )}
  >
    <div
      className="h-12 w-12 rounded-full grid place-items-center"
      style={{
        background: "hsl(var(--fm-accent) / 0.15)",
        color: "hsl(var(--fm-accent))",
      }}
    >
      <Icon className="h-5 w-5" />
    </div>
    <div className="text-[13px] font-medium text-fm-fg">{title}</div>
    {description && (
      <div className="text-[12px] text-fm-fg-muted max-w-md leading-relaxed">
        {description}
      </div>
    )}
    {action && <div className="mt-1">{action}</div>}
  </div>
);

export default EmptyState;
