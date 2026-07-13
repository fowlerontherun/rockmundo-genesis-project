import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Home } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { cn } from "@/lib/utils";

export type HubNavItem = {
  id: string;
  label: string;
  path: string;
  icon?: LucideIcon;
  matchPaths?: string[];
  mobile?: boolean;
  end?: boolean;
  badge?: ReactNode;
};

export type HubBreadcrumb = { label: string; path?: string };

const normalizePath = (path: string) => {
  const withoutQuery = path.split("?")[0] || "/";
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
};

export const isHubNavItemActive = (pathname: string, item: HubNavItem) => {
  const current = normalizePath(pathname);
  const candidates = [item.path, ...(item.matchPaths ?? [])].map(normalizePath);
  return candidates.some((candidate) => current === candidate || (!item.end && current.startsWith(`${candidate}/`)));
};

export interface HubLayoutProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  navLabel?: string;
  navItems: HubNavItem[];
  breadcrumbs?: HubBreadcrumb[];
  actions?: ReactNode;
  status?: ReactNode;
  loading?: boolean;
  error?: { title?: string; description?: string; retry?: () => void } | null;
  empty?: { title: string; description?: string } | null;
  children: ReactNode;
  className?: string;
}

/**
 * Shared hub shell for progressively migrated sections.
 * Example: <HubLayout title="Character" navItems={[{ id: "overview", label: "Overview", path: "/character" }]} />.
 */
export function HubLayout({
  title,
  description,
  icon,
  navLabel,
  navItems,
  breadcrumbs,
  actions,
  status,
  loading,
  error,
  empty,
  children,
  className,
}: HubLayoutProps) {
  const { pathname } = useLocation();
  const visibleMobileItems = navItems.filter((item) => item.mobile !== false);
  const content = loading ? (
    <PageLoadingState title={`Loading ${title}`} description="Preparing this hub and its latest activity." />
  ) : error ? (
    <PageErrorState title={error.title ?? `Unable to load ${title}`} description={error.description ?? "Try again in a moment."} onRetry={error.retry} />
  ) : empty ? (
    <PageEmptyState title={empty.title} description={empty.description} />
  ) : children;

  return (
    <FMPageScaffold title={title} subtitle={description} icon={icon} headerActions={actions} className={className}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label={`${title} breadcrumb`} className="-mt-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-muted-foreground">
          <Link to="/dashboard" className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Home className="h-3.5 w-3.5" aria-hidden /> Home
          </Link>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1"><span aria-hidden>/</span>{crumb.path && !isLast ? <Link to={crumb.path} className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{crumb.label}</Link> : <span aria-current={isLast ? "page" : undefined} className={cn(isLast && "font-medium text-foreground")}>{crumb.label}</span>}</span>;
          })}
        </nav>
      )}
      {status && <Card><CardContent className="p-3">{status}</CardContent></Card>}
      <nav aria-label={navLabel ?? `${title} sections`} className="hidden md:flex flex-wrap gap-2">
        {navItems.map((item) => <HubNavLink key={item.id} item={item} active={isHubNavItemActive(pathname, item)} />)}
      </nav>
      <nav aria-label={`${navLabel ?? title} mobile sections`} className="md:hidden -mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 px-1">{visibleMobileItems.map((item) => <HubNavLink key={item.id} item={item} active={isHubNavItemActive(pathname, item)} compact />)}</div>
      </nav>
      <main className="min-w-0" tabIndex={-1}>{content}</main>
    </FMPageScaffold>
  );
}

function HubNavLink({ item, active, compact }: { item: HubNavItem; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  return <Button asChild variant={active ? "secondary" : "outline"} size={compact ? "sm" : "default"} className={cn("gap-2", active && "border-primary text-primary")} aria-current={active ? "page" : undefined}><Link to={item.path}>{Icon && <Icon className="h-4 w-4" aria-hidden />}<span>{item.label}</span>{item.badge}</Link></Button>;
}

export default HubLayout;
