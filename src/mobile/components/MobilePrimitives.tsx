import { ReactNode } from "react";
import { AlertTriangle, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { MCard } from "./MCard";
import { SkeletonCard } from "./SkeletonCard";

export const MobilePageShell = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("space-y-4", className)}>{children}</div>
);

export const MobileSectionHeader = ({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) => (
  <header className="flex items-start justify-between gap-3 px-1">
    <div className="min-w-0">
      {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
      <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm leading-snug text-muted-foreground">{description}</p>}
    </div>
    {action}
  </header>
);

export const MobileStatusBadge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) => (
  <span className={cn(
    "inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
    tone === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-600",
    tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
    tone === "info" && "border-primary/30 bg-primary/10 text-primary",
    tone === "neutral" && "border-border bg-muted text-muted-foreground",
  )}>{children}</span>
);

export const MobileSectionCard = ({ title, subtitle, children, action }: { title: string; subtitle?: string; children?: ReactNode; action?: ReactNode }) => (
  <section className="rm-mcard p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const MobileProgressCard = ({ label, value, detail }: { label: string; value: number; detail?: string }) => {
  const safe = Math.max(0, Math.min(100, value));
  return <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
    <div className="flex items-center justify-between text-sm"><span className="font-semibold">{label}</span><span className="tabular-nums text-primary">{Math.round(safe)}%</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${safe}%` }} /></div>
    {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
  </div>;
};

export const MobileEntityCard = ({ title, subtitle, meta, icon, onPress }: { title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; icon?: ReactNode; onPress?: () => void }) => (
  <MCard title={title} subtitle={subtitle} icon={icon} right={meta} chevron={!!onPress} onPress={onPress} className="min-h-[72px]" />
);

export const MobileHorizontalCarousel = ({ children, label }: { children: ReactNode; label: string }) => (
  <div role="region" aria-label={label} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">{children}</div>
);

export const MobileTimeline = ({ children }: { children: ReactNode }) => <ol className="space-y-2">{children}</ol>;
export const MobileTimelineItem = ({ title, detail, badge }: { title: string; detail?: string; badge?: ReactNode }) => (
  <li className="flex gap-3 rounded-xl border border-border bg-background/60 p-3">
    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
    <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{title}</p>{badge}</div>{detail && <p className="text-xs text-muted-foreground">{detail}</p>}</div>
  </li>
);

export const MobileErrorState = ({ title = "Could not load this section", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) => (
  <div role="alert" className="rm-mcard border-destructive/40 p-4 text-center">
    <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-destructive" />
    <p className="font-semibold">{title}</p>
    {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
    {onRetry && <button onClick={onRetry} className="rm-tap mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Retry</button>}
  </div>
);

export const MobileLoadingSkeleton = ({ cards = 3 }: { cards?: number }) => <>{Array.from({ length: cards }).map((_, i) => <SkeletonCard key={i} />)}</>;

export const MobileNotificationCard = MCard;

export const MobileStickyActionBar = ({ children }: { children: ReactNode }) => (
  <div className="sticky bottom-[calc(var(--m-nav-h)+var(--m-safe-b)+8px)] z-20 -mx-1 rounded-2xl border border-border bg-background/95 p-2 shadow-lg backdrop-blur">{children}</div>
);

export const MobileSearchTrigger = ({ label = "Search", onPress }: { label?: string; onPress?: () => void }) => (
  <button onClick={onPress} className="rm-tap flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-left text-sm text-muted-foreground">
    <Search className="h-4 w-4" /><span className="flex-1">{label}</span><ChevronRight className="h-4 w-4" />
  </button>
);
