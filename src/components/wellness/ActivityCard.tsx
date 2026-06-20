import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Coins, Battery, Lock, ArrowRight } from "lucide-react";
import type { WellnessCatalogEntry, WellnessCooldown, WellnessVitals } from "@/lib/api/wellnessActivities";

interface Props {
  entry: WellnessCatalogEntry;
  cooldown?: WellnessCooldown;
  vitals: WellnessVitals | null;
  fame: number;
  performing: boolean;
  onPerform: (slug: string) => void;
}

const formatRemaining = (ms: number) => {
  if (ms <= 0) return "Ready";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const categoryAccent: Record<string, string> = {
  recovery: "border-l-emerald-500",
  fitness: "border-l-blue-500",
  medical: "border-l-rose-500",
  indulgence: "border-l-amber-500",
};

export const ActivityCard = ({ entry, cooldown, vitals, fame, performing, onPerform }: Props) => {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const cooldownMs = cooldown ? new Date(cooldown.cooldown_until).getTime() - Date.now() : 0;
  const onCooldown = cooldownMs > 0;
  const locked = fame < entry.unlock_min_fame;
  const lowStamina = vitals ? vitals.energy < entry.stamina_cost : false;
  const blocked = onCooldown || locked || lowStamina;

  const blockReason = locked
    ? `Unlocks at ${entry.unlock_min_fame} fame`
    : onCooldown
      ? `Cooldown · ${formatRemaining(cooldownMs)}`
      : lowStamina
        ? `Need ${entry.stamina_cost} energy`
        : null;

  return (
    <Card className={`border-l-4 ${categoryAccent[entry.category] ?? ""} transition hover:shadow-md`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold leading-tight">{entry.name}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
          </div>
          {entry.treats_ailment_slug && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">Treats</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {Object.entries(entry.stat_effects).map(([k, v]) => (
            <span key={k} className={`rounded-full px-2 py-0.5 ${v > 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/15 text-rose-700 dark:text-rose-400"}`}>
              {v > 0 ? "+" : ""}{v} {k}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{entry.duration_minutes}m · CD {entry.cooldown_hours}h</span>
          <span className="inline-flex items-center gap-1"><Battery className="h-3 w-3" />{entry.stamina_cost}</span>
          {entry.cost_cents > 0 && <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />${(entry.cost_cents / 100).toLocaleString()}</span>}
        </div>

        <Button
          size="sm"
          className="w-full"
          disabled={blocked || performing}
          variant={blocked ? "outline" : "default"}
          onClick={() => onPerform(entry.slug)}
        >
          {locked ? <Lock className="mr-1 h-3.5 w-3.5" /> : null}
          {blocked ? blockReason : (
            <>
              Do it now <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ActivityCard;
