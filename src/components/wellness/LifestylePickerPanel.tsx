import { useMemo } from "react";
import { Check, Lock, Sparkles, Shield, Wine, Dumbbell, Briefcase, Palette, Crown, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useLifestyleCatalog,
  usePlayerLifestyle,
  useSwitchLifestyle,
  type LifestyleCatalogEntry,
} from "@/hooks/useWellnessLifestyle";

const ICONS: Record<string, JSX.Element> = {
  scale: <Scale className="h-5 w-5" />,
  shield: <Shield className="h-5 w-5" />,
  wine: <Wine className="h-5 w-5" />,
  dumbbell: <Dumbbell className="h-5 w-5" />,
  briefcase: <Briefcase className="h-5 w-5" />,
  palette: <Palette className="h-5 w-5" />,
  sparkles: <Sparkles className="h-5 w-5" />,
  crown: <Crown className="h-5 w-5" />,
};

const ACCENT: Record<string, string> = {
  primary: "border-primary/40 bg-primary/5",
  success: "border-emerald-500/40 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  info: "border-sky-500/40 bg-sky-500/5",
};

function fmtCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Ready";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

const LifestylePickerPanel = () => {
  const { data: catalog, isLoading: loadingCatalog } = useLifestyleCatalog();
  const { data: current, isLoading: loadingCurrent } = usePlayerLifestyle();
  const switchLifestyle = useSwitchLifestyle();

  const activeSlug = current?.lifestyle_slug ?? null;
  const cooldownActive = current ? new Date(current.switch_available_at).getTime() > Date.now() : false;
  const activeEntry = useMemo(
    () => catalog?.find((c) => c.slug === activeSlug) ?? null,
    [catalog, activeSlug],
  );

  const loading = loadingCatalog || loadingCurrent;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Lifestyle
          </CardTitle>
          {current && (
            <Badge variant="outline" className="text-xs">
              {cooldownActive ? `Switch in ${fmtCountdown(current.switch_available_at)}` : "Switch ready"}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {activeEntry
            ? `Current: ${activeEntry.name} — ${activeEntry.tagline}. Switching applies a 7-day cooldown.`
            : "Pick a lifestyle to unlock passive bonuses. First pick is free; further switches have a 7-day cooldown."}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalog?.map((entry) => (
              <LifestyleCard
                key={entry.slug}
                entry={entry}
                isActive={entry.slug === activeSlug}
                locked={!!activeSlug && entry.slug !== activeSlug && cooldownActive}
                onPick={() => switchLifestyle.mutate(entry.slug)}
                busy={switchLifestyle.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface CardProps {
  entry: LifestyleCatalogEntry;
  isActive: boolean;
  locked: boolean;
  onPick: () => void;
  busy: boolean;
}

const LifestyleCard = ({ entry, isActive, locked, onPick, busy }: CardProps) => {
  const accent = ACCENT[entry.accent_color] ?? ACCENT.primary;
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border p-3 transition-colors",
        accent,
        isActive && "ring-2 ring-primary",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-background/60 p-1.5">{ICONS[entry.icon] ?? ICONS.sparkles}</div>
          <div>
            <p className="font-display text-sm font-semibold leading-none">{entry.name}</p>
            <p className="text-[10px] text-muted-foreground">{entry.tagline}</p>
          </div>
        </div>
        {isActive && <Badge className="text-[10px]">Active</Badge>}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">{entry.description}</p>

      <div className="mb-2 space-y-1 text-[11px]">
        {entry.bonuses.slice(0, 3).map((b) => (
          <div key={b} className="flex items-start gap-1 text-emerald-600 dark:text-emerald-400">
            <span>+</span> <span>{b}</span>
          </div>
        ))}
        {entry.penalties.slice(0, 2).map((p) => (
          <div key={p} className="flex items-start gap-1 text-rose-600 dark:text-rose-400">
            <span>−</span> <span>{p}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <Button
          size="sm"
          variant={isActive ? "secondary" : "default"}
          className="w-full"
          disabled={isActive || locked || busy}
          onClick={onPick}
        >
          {isActive ? (
            <><Check className="mr-1 h-3 w-3" /> Selected</>
          ) : locked ? (
            <><Lock className="mr-1 h-3 w-3" /> On cooldown</>
          ) : (
            "Adopt"
          )}
        </Button>
      </div>
    </div>
  );
};

export default LifestylePickerPanel;
