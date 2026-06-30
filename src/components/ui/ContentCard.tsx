import type { ReactNode, MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ContentCardAction {
  label: string;
  to?: string;
  onClick?: (e: MouseEvent) => void;
  icon?: LucideIcon;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
}

export interface ContentCardBadge {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "muted";
}

export interface ContentCardProps {
  /** Card title (required) */
  title: ReactNode;
  /** Optional subtitle / supporting text under the title */
  subtitle?: ReactNode;
  /** Optional leading icon */
  icon?: LucideIcon;
  /** Optional leading visual that replaces the icon slot (e.g. avatar, cover art) */
  leading?: ReactNode;
  /** Small status pills shown next to the title */
  badges?: ContentCardBadge[];
  /** Primary CTA — shown as a prominent button */
  primaryAction?: ContentCardAction;
  /** Secondary actions — shown as ghost icon buttons */
  secondaryActions?: ContentCardAction[];
  /** Optional body content (meta rows, stats, progress, etc.) */
  children?: ReactNode;
  /** Make the whole card clickable */
  href?: string;
  onClick?: (e: MouseEvent) => void;
  /** Visual density */
  density?: "comfortable" | "compact";
  className?: string;
  /** Optional trailing slot (right side, e.g. price, value) */
  trailing?: ReactNode;
  /** Disable hover/tap feedback (use when card is purely static) */
  static?: boolean;
}

const toneClasses: Record<NonNullable<ContentCardBadge["tone"]>, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  muted: "bg-muted text-muted-foreground border-border",
};

/**
 * Unified RockMundo content card. Use for any list/grid item — songs, gigs,
 * messages, inventory, contracts, charts — to keep visual rhythm consistent.
 *
 * Anatomy:
 *   [icon] Title + badges                          [trailing]
 *          subtitle
 *          {children meta rows}
 *   ────────────────────────────────────────────────────────
 *   [secondary ghost actions]              [PRIMARY ACTION →]
 */
export const ContentCard = ({
  title,
  subtitle,
  icon: Icon,
  leading,
  badges,
  primaryAction,
  secondaryActions,
  children,
  href,
  onClick,
  density = "comfortable",
  className,
  trailing,
  static: isStatic = false,
}: ContentCardProps) => {
  const interactive = !isStatic && (Boolean(href) || Boolean(onClick) || Boolean(primaryAction));
  const padding = density === "compact" ? "p-3 sm:p-4" : "p-4 sm:p-5";

  const renderActionButton = (
    action: ContentCardAction,
    style: "primary" | "secondary"
  ) => {
    const ActionIcon = action.icon;
    const buttonInner = (
      <Button
        type="button"
        size={style === "primary" ? "sm" : "icon"}
        variant={
          style === "primary"
            ? action.variant ?? "default"
            : action.variant ?? "ghost"
        }
        disabled={action.disabled}
        onClick={(e) => {
          e.stopPropagation();
          action.onClick?.(e);
        }}
        className={cn(
          style === "primary" && "gap-1.5 font-medium",
          style === "secondary" && "h-8 w-8"
        )}
        aria-label={style === "secondary" ? action.label : undefined}
      >
        {ActionIcon && (
          <ActionIcon className={cn("h-4 w-4", style === "primary" && "-ml-0.5")} />
        )}
        {style === "primary" && <span className="truncate">{action.label}</span>}
        {style === "primary" && !ActionIcon && <ArrowRight className="h-3.5 w-3.5" />}
      </Button>
    );

    if (action.to && !action.disabled) {
      return (
        <Link
          key={action.label}
          to={action.to}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex"
        >
          {buttonInner}
        </Link>
      );
    }
    return <span key={action.label}>{buttonInner}</span>;
  };

  const inner = (
    <div className={cn("flex flex-col gap-3", padding)}>
      <div className="flex items-start gap-3">
        {(leading || Icon) && (
          <div className="flex-shrink-0">
            {leading ?? (
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                {Icon && <Icon className="h-4 w-4" />}
              </div>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm sm:text-base font-medium leading-tight truncate min-w-0">
              {title}
            </h3>
            {badges?.map((b) => (
              <span
                key={b.label}
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-tight",
                  toneClasses[b.tone ?? "default"]
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>
        {trailing && (
          <div className="flex-shrink-0 text-right text-sm">{trailing}</div>
        )}
      </div>

      {children && <div className="text-sm space-y-1.5">{children}</div>}

      {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <div className="flex items-center gap-1">
            {secondaryActions?.map((a) => renderActionButton(a, "secondary"))}
          </div>
          {primaryAction && (
            <div className="ml-auto">{renderActionButton(primaryAction, "primary")}</div>
          )}
        </div>
      )}
    </div>
  );

  const baseClasses = cn(
    "overflow-hidden border bg-card transition-all duration-200",
    interactive &&
      "hover:border-primary/40 hover:shadow-md active:scale-[0.995] cursor-pointer focus-within:ring-2 focus-within:ring-primary/30",
    className
  );

  if (href) {
    return (
      <Link to={href} onClick={onClick} className="block">
        <Card className={baseClasses}>{inner}</Card>
      </Link>
    );
  }
  if (onClick) {
    return (
      <Card
        className={baseClasses}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(e as unknown as MouseEvent);
          }
        }}
      >
        {inner}
      </Card>
    );
  }
  return <Card className={baseClasses}>{inner}</Card>;
};

export default ContentCard;
