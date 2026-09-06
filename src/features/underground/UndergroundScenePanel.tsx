import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, LockKeyhole, Radio, Skull, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getUndergroundState, listUndergroundEvents, resolveUndergroundEvent } from "./service";
import type { UndergroundEvent } from "./types";

interface Props {
  profileId?: string | null;
  age?: number | null;
}

const effectLabel = (key: string) => key.replaceAll("_", " ");

function RiskPips({ value }: { value: number }) {
  return <div className="flex gap-1" aria-label={`Risk ${value} of 5`}>{[1, 2, 3, 4, 5].map((pip) => <span key={pip} className={`h-1.5 w-4 rounded-full ${pip <= value ? "bg-destructive" : "bg-muted"}`} />)}</div>;
}

function Effects({ effects }: { effects: Record<string, number> }) {
  const rows = Object.entries(effects).filter(([, value]) => value !== 0).slice(0, 6);
  return <div className="flex flex-wrap gap-1.5">{rows.map(([key, value]) => <Badge key={key} variant="outline" className="text-[10px] capitalize">{effectLabel(key)} {value > 0 ? "+" : ""}{value}</Badge>)}</div>;
}

export function UndergroundScenePanel({ profileId, age }: Props) {
  const queryClient = useQueryClient();
  const stateQuery = useQuery({
    queryKey: ["underground-state", profileId],
    enabled: Boolean(profileId),
    queryFn: () => getUndergroundState(profileId!),
  });
  const eventsQuery = useQuery({ queryKey: ["underground-events"], queryFn: listUndergroundEvents });

  const resolveMutation = useMutation({
    mutationFn: (event: UndergroundEvent) => resolveUndergroundEvent(profileId!, event.slug),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.reason === "age_restricted") toast.error(`This scene is restricted to characters aged ${result.minimumAge}+.`);
        else if (result.reason === "insufficient_cred") toast.error(`You need ${result.minimumCred} Underground Cred to get an invite.`);
        else toast.error("You could not access this underground event.");
        return;
      }
      toast[result.outcome === "success" ? "success" : "warning"](result.outcome === "success" ? "The night paid off." : "The risk caught up with you.");
      queryClient.invalidateQueries({ queryKey: ["underground-state", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
    },
    onError: (error: Error) => toast.error(error.message || "Unable to resolve underground event."),
  });

  if (!profileId) return null;
  const state = stateQuery.data;
  const cred = state?.underground_cred ?? 0;

  return (
    <Card className="border-destructive/20 bg-gradient-to-br from-card to-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Radio className="h-4 w-4" /> The Underground</CardTitle>
            <CardDescription>Word-of-mouth shows, afterparties and risky scene opportunities. Higher rewards create real career and wellness consequences.</CardDescription>
          </div>
          <Badge variant="secondary">Age {Math.floor(age ?? 0)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><div className="flex items-center justify-between text-xs"><span>Underground Cred</span><span>{cred}</span></div><Progress value={cred} className="mt-1 h-1.5" /></div>
          <div><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1"><Flame className="h-3 w-3" /> Heat</span><span>{state?.heat ?? 0}</span></div><Progress value={state?.heat ?? 0} className="mt-1 h-1.5" /></div>
          <div><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1"><Skull className="h-3 w-3" /> Notoriety</span><span>{state?.notoriety ?? 0}</span></div><Progress value={state?.notoriety ?? 0} className="mt-1 h-1.5" /></div>
          <div><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1"><UsersRound className="h-3 w-3" /> Connections</span><span>{state?.scene_connections ?? 0}</span></div><Progress value={state?.scene_connections ?? 0} className="mt-1 h-1.5" /></div>
        </div>

        <div className="space-y-2">
          {(eventsQuery.data ?? []).map((event) => {
            const ageBlocked = Math.floor(age ?? 0) < event.minimum_age;
            const credBlocked = cred < event.min_cred;
            const blocked = ageBlocked || credBlocked;
            return (
              <div key={event.id} className="rounded-lg border bg-background/70 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-sm">{event.name}</span><RiskPips value={event.risk_tier} />{event.minimum_age >= 18 && <Badge variant="outline" className="text-[10px]">18+</Badge>}{event.min_cred > 0 && <Badge variant="outline" className="text-[10px]">{event.min_cred} cred</Badge>}</div>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                    <Effects effects={event.success_effects} />
                  </div>
                  <Button size="sm" variant={event.risk_tier >= 4 ? "destructive" : "secondary"} disabled={blocked || resolveMutation.isPending} onClick={() => resolveMutation.mutate(event)}>
                    {blocked ? <><LockKeyhole className="mr-1 h-3 w-3" />{ageBlocked ? `${event.minimum_age}+` : `${event.min_cred} cred`}</> : "Take the chance"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
