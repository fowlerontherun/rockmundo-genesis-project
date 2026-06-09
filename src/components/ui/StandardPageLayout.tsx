import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StandardPageLayoutProps {
  /** 1. Page header */
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  backTo?: string;
  backLabel?: string;
  headerActions?: ReactNode;

  /** 2. Key stats summary bar (StatCard grid / inline metrics). Optional. */
  stats?: ReactNode;

  /** 3. Primary content card (main slot) */
  children: ReactNode;
  /**
   * Render the primary content directly without wrapping it in a Card.
   * Use when the children themselves contain Cards / Tabs that shouldn't be
   * double-bordered.
   */
  bareContent?: boolean;
  primaryClassName?: string;

  /** 4. Secondary actions section (tertiary buttons, related links). Optional. */
  secondaryActions?: ReactNode;
  secondaryTitle?: string;

  /** PageLayout passthroughs */
  wide?: boolean;
  className?: string;
}

/**
 * Unified RockMundo page template.
 *
 * Vertical structure:
 *   1. Header
 *   2. Stats bar
 *   3. Primary content card
 *   4. Secondary actions
 *   (5. Persistent bottom navigation lives in <Layout />)
 */
export const StandardPageLayout = ({
  title,
  subtitle,
  icon,
  backTo,
  backLabel,
  headerActions,
  stats,
  children,
  bareContent = false,
  primaryClassName,
  secondaryActions,
  secondaryTitle,
  wide,
  className,
}: StandardPageLayoutProps) => {
  return (
    <PageLayout wide={wide} className={className}>
      {/* 1. Header */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        backTo={backTo}
        backLabel={backLabel}
        actions={headerActions}
      />

      {/* 2. Stats bar */}
      {stats && (
        <section aria-label="Key stats" className="rounded-sm border border-fm-border bg-fm-panel-2 p-3">
          {stats}
        </section>
      )}

      {/* 3. Primary content */}
      {bareContent ? (
        <section aria-label="Main content" className={cn("space-y-4", primaryClassName)}>
          {children}
        </section>
      ) : (
        <Card className={cn("bg-fm-panel border-fm-border rounded-sm", primaryClassName)}>
          <CardContent className="p-4 space-y-4">{children}</CardContent>
        </Card>
      )}

      {/* 4. Secondary actions */}
      {secondaryActions && (
        <section
          aria-label={secondaryTitle ?? "Secondary actions"}
          className="rounded-lg border border-dashed bg-muted/30 p-3 sm:p-4 space-y-2"
        >
          {secondaryTitle && (
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {secondaryTitle}
            </h2>
          )}
          <div className="flex flex-wrap gap-2">{secondaryActions}</div>
        </section>
      )}
    </PageLayout>
  );
};

export default StandardPageLayout;
