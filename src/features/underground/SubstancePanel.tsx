import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Beer, HeartPulse, LockKeyhole, MoonStar, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getSubstanceState, listSubstances, useSubstance } from "./service";
import type { PlayerSubstanceState, SubstanceCatalogItem } from "./types";

interface Props {
  profileId: string;
  age?: number | null;
}

const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value / 100);
const effectLabel = (key: string) => key.replaceAll("_", " ");

function RiskPips({ value }: { value: number }) {
  return <div className="flex gap-1" aria-label={`Risk ${value} of 5`}>{[1, 2, 3, 4, 5].map((pip) => <span key={pip} className={`h-1.5 w-3 rounded-full ${pip <= value ? "bg-destructive" : "bg-muted"}`} />)}</div>;
}

function MiniMeter({ label, value }: { label: string; value: number }) {
  return <div><div className="flex justify-between text-[10px] text-muted-foreground"><span>{label}</span><span>{value}</span></div><Progress value={value} className="mt-1 h-1.5" /></div>;
}

function StateSummary({ state }: { state?: PlayerSubstanceState }) {
  if (!state) return <p className="text-[11px] text-muted-foreground">No history with this choice.</p>;
  const activeUntil = state.hangover_until ?? state.crash_until;
  const active = Boolean(activeUntil && new Date(activeUntil).getTime() > Date.now());
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2">
      <div className="grid grid-cols-3 gap-2">
        <MiniMeter label="Intoxication" value={state.intoxication} />
        <MiniMeter label="Tolerance" value={state.tolerance} />
        <MiniMeter label="Dependency" value={state.dependency} />
      </div>
      {active && <div className="flex items-center gap-1 text-[10px] text-destructive"><MoonStar className="h-3 w-3" /> After-effects active until {new Date(activeUntil!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
      {state.dependency >= 60 && <div className="flex items-center gap-1 text-[10px] text-destructive"><ShieldAlert className="h-3 w-3" /> High dependency: recovery will be slower and future consequences harsher.</div>}
    </div>
  );
}

function Effects({ item }: { item: SubstanceCatalogItem }) {
  const immediate = Object.entries(item.immediate_effects).filter(([, value]) => value !== 0);
  const crash = Object.entries(item.crash_effects).filter(([, value]) => value !== 0);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">{immediate.map(([key, value]) => <Badge key={`i-${key}`} variant="outline" className="text-[9px] capitalize">Now: {effectLabel(key)} {value > 0 ? "+" : ""}{value}</Badge>)}</div>
      <div className="flex flex-wrap gap-1">{crash.map(([key, value]) => <Badge key={`c-${key}`} variant="secondary" className="text-[9px] capitalize">Later: {effectLabel(key)} {value > 0 ? "+" : ""}{value}</Badge>)}</div>
    </div>
  );
}

export function SubstancePanel({ profileId, age }: Props) {
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ["substance-catalog"], queryFn: listSubstances });
  const state = useQuery({ queryKey: ["substance-state", profileId], queryFn: () => getSubstanceState(profileId) });
  const mutation = useMutation({
    mutationFn: (slug: string) => useSubstance(profileId, slug),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.reason === "age_restricted") toast.error("Adult nightlife choices are restricted to characters aged 18+.");
        else if (result.reason === "insufficient_cash") toast.error(`You need ${money(result.cashCost ?? 0)} available cash.`);
        else toast.error("That choice is not available right now.");
        return;
      }
      if (result.highRisk) toast.warning("You pushed well into the danger zone. Your health risk is now significantly higher.");
      else toast.success("Choice resolved. Your wellness and nightlife state have changed.");
      queryClient.invalidateQueries({ queryKey: ["substance-state", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
    },
    onError: (error: Error) => toast.error(error.message || "Unable to resolve nightlife choice."),
  });

  const stateBySlug = new Map((state.data ?? []).map((row) => [row.substance_slug, row]));
  const ageBlocked = Math.floor(age ?? 0) < 18;

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-card to-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Beer className="h-4 w-4" /> Drinks & After-hours Choices</CardTitle>
        <CardDescription>Optional adult nightlife choices trade short-term social or performance effects for fatigue, health, tolerance and dependency risk. Consequences persist beyond the night.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ageBlocked && <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/40 p-3 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4" /> This section unlocks when the character reaches age 18.</div>}
        {!ageBlocked && <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>Higher intoxication increases the chance of severe health consequences. Repeated use builds tolerance and dependency; avoiding use allows dependency to reduce gradually.</span></div>}

        <div className="grid gap-3 xl:grid-cols-2">
          {(catalog.data ?? []).map((item) => {
            const current = stateBySlug.get(item.slug);
            const danger = (current?.intoxication ?? 0) >= 65 || (current?.dependency ?? 0) >= 60;
            return (
              <div key={item.id} className="space-y-2 rounded-lg border bg-background/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{item.name}</span><Badge variant="outline" className="text-[9px] capitalize">{item.category}</Badge><RiskPips value={item.risk_tier} /></div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="text-xs font-medium">{money(item.cash_cost)}</span>
                </div>
                <Effects item={item} />
                <StateSummary state={current} />
                <Button size="sm" variant={danger || item.risk_tier >= 4 ? "destructive" : "secondary"} disabled={ageBlocked || mutation.isPending} onClick={() => mutation.mutate(item.slug)} className="w-full">
                  {danger ? <><HeartPulse className="mr-1 h-3 w-3" /> Take another risk</> : "Choose this"}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
