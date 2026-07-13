import { ReactNode } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";

export type HubNavigationItem = {
  id: string;
  label: string;
  path: string;
  icon?: LucideIcon;
  description?: string;
  matchPaths?: string[];
  mobileVisible?: boolean;
  badge?: ReactNode;
};

export type HubBreadcrumbItem = {
  label: string;
  path?: string;
};

export type HubAction = {
  label: string;
  path: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "ghost";
  ariaLabel?: string;
};

export type HubLayoutState =
  | { type: "loading"; title?: string; description?: string }
  | { type: "error"; title?: string; description?: string; onRetry?: () => void }
  | { type: "empty"; title?: string; description?: string; action?: ReactNode };

export type HubLayoutProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  overviewPath: string;
  navigation: HubNavigationItem[];
  children: ReactNode;
  actions?: HubAction[];
  breadcrumbs?: HubBreadcrumbItem[];
  status?: ReactNode;
  state?: HubLayoutState;
  className?: string;
  contentClassName?: string;
  navigationLabel?: string;
};

const normalisePath = (path: string) => {
  const [withoutQuery] = path.split("?");
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
};

export const isHubNavigationItemActive = (pathname: string, item: HubNavigationItem) => {
  const current = normalisePath(pathname);
  const paths = [item.path, ...(item.matchPaths ?? [])].map(normalisePath);

  return paths.some((path) => {
    if (current === path) return true;
    if (matchPath({ path: `${path}/*`, end: false }, current)) return true;
    return false;
  });
};

const HubBreadcrumbs = ({ items }: { items: HubBreadcrumbItem[] }) => {
  if (!items.length) return null;

  return (
    <nav aria-label="Hub breadcrumb" className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs text-muted-foreground">
      <Link to="/home" aria-label="Home" className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Home className="h-3.5 w-3.5" aria-hidden />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const content = <span className="truncate max-w-[12rem]">{item.label}</span>;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
            {item.path && !isLast ? (
              <Link to={item.path} className="inline-flex min-w-0 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {content}
              </Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined} className={cn("inline-flex min-w-0", isLast && "font-medium text-foreground")}>
                {content}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export function HubLayout({
  title,
  description,
  icon,
  overviewPath,
  navigation,
  children,
  actions = [],
  breadcrumbs,
  status,
  state,
  className,
  contentClassName,
  navigationLabel,
}: HubLayoutProps) {
  const { pathname } = useLocation();
  const activeItem = navigation.find((item) => isHubNavigationItemActive(pathname, item)) ?? navigation.find((item) => item.path === overviewPath);
  const logicalBreadcrumbs = breadcrumbs ?? [
    { label: title, path: overviewPath },
    ...(activeItem && activeItem.path !== overviewPath ? [{ label: activeItem.label }] : []),
  ];

  const headerActions = actions.length ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button key={action.path} asChild size="sm" variant={action.variant ?? "outline"} aria-label={action.ariaLabel ?? action.label}>
            <Link to={action.path}>
              {Icon && <Icon className="mr-1.5 h-4 w-4" aria-hidden />}
              {action.label}
            </Link>
          </Button>
        );
      })}
    </div>
  ) : undefined;

  const stateContent = state?.type === "loading" ? (
    <PageLoadingState title={state.title ?? `Loading ${title}`} description={state.description} />
  ) : state?.type === "error" ? (
    <PageErrorState title={state.title ?? `${title} could not be loaded`} description={state.description} onRetry={state.onRetry} />
  ) : state?.type === "empty" ? (
    <PageEmptyState title={state.title ?? `No ${title} content`} description={state.description} action={state.action} />
  ) : null;

  return (
    <section className={cn("mx-auto flex w-full max-w-[1600px] flex-col gap-4", className)} aria-labelledby="hub-title">
      <HubBreadcrumbs items={logicalBreadcrumbs} />
      <PageHeader title={title} subtitle={description} icon={icon} actions={headerActions} />
      {status ? <div aria-label={`${title} summary`}>{status}</div> : null}
      <nav aria-label={navigationLabel ?? `${title} pages`} className="rounded-xl border bg-card/70 p-1 shadow-sm">
        <div className="flex gap-1 overflow-x-auto fm-scrollbar-thin" role="list">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isHubNavigationItemActive(pathname, item);
            return (
              <Button key={item.id} asChild variant={active ? "secondary" : "ghost"} size="sm" className={cn("h-10 shrink-0 justify-start gap-2", item.mobileVisible === false && "hidden md:inline-flex")} aria-current={active ? "page" : undefined}>
                <Link to={item.path} aria-label={item.description ? `${item.label}: ${item.description}` : item.label}>
                  {Icon && <Icon className="h-4 w-4" aria-hidden />}
                  <span>{item.label}</span>
                  {item.badge}
                </Link>
              </Button>
            );
          })}
        </div>
      </nav>
      <main className={cn("min-w-0 space-y-4", contentClassName)} aria-busy={state?.type === "loading" ? true : undefined}>
        {stateContent ?? children}
      </main>
    </section>
  );
}

export default HubLayout;
