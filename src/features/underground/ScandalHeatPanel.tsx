import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeDollarSign, Flame, Megaphone, Newspaper, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getPlayerScandals, getUndergroundState, respondToScandal } from "./service";
import type { PlayerScandal, ScandalResponse } from "./types";

interface Props {
  profileId: string;
}

const stageLabels: Record<PlayerScandal["stage"], string> = {
  rumor: "Rumour",
  press: "Press",
  frenzy: "Media frenzy",
  fading: "Fading",
  resolved: "Resolved",
};

const responseLabels: Record<Exclude<ScandalResponse, "pay_fine">, string> = {
  ignore: "Ignore it",
  apologize: "Apologise",
  deny: "Deny it",
  lean_in: "Lean into it",
  consultant: "Use PR consultant",
  disappear: "Disappear for 3 days",
};

const activeRestriction = (value: string | null) => Boolean(value && new Date(value).getTime() > Date.now());

export function ScandalHeatPanel({ profileId }: Props) {
  const queryClient = useQueryClient();
  const { data: scandals = [], isLoading } = useQuery({
    queryKey: ["player-scandals", profileId],
    queryFn: () => getPlayerScandals(profileId),
    enabled: Boolean(profileId),
    refetchInterval: 60_000,
  });
  const { data: underground } = useQuery({
    queryKey: ["underground-state", profileId],
    queryFn: () => getUndergroundState(profileId),
    enabled: Boolean(profileId),
  });

  const responseMutation = useMutation({
    mutationFn: ({ scandalId, response }: { scandalId: string; response: ScandalResponse }) =>
      respondToScandal(profileId, scandalId, response),
    onSuccess: (result) => {
      if (!result.ok) {
        const messages: Record<string, string> = {
          already_responded: "You have already made your main response to this story.",
          no_active_consultant: "You need an active PR consultant for that response.",
          insufficient_cash: `You need $${Number(result.required ?? 0).toLocaleString()} to pay this fine.`,
          no_outstanding_fine: "There is no outstanding fine on this scandal.",
          resolved: "This scandal has already been resolved.",
        };
        toast.error(messages[result.reason ?? ""] ?? "That response is not available.");
        return;
      }
      toast.success(result.message ?? "Response issued.");
      queryClient.invalidateQueries({ queryKey: ["player-scandals", profileId] });
      queryClient.invalidateQueries({ queryKey: ["underground-state", profileId] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not respond to the scandal."),
  });

  const active = scandals.filter((item) => item.stage !== "resolved");
  const history = scandals.filter((item) => item.stage === "resolved").slice(0, 3);
  const heat = underground?.heat ?? 0;

  return (
    <Card className="border-orange-500/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2"><Newspaper className="h-4 w-4" /> Scandals & Heat</span>
          <Badge variant={heat >= 70 ? "destructive" : "outline"} className="gap-1">
            <Flame className="h-3 w-3" /> Heat {heat}/100
          </Badge>
        </CardTitle>
        <Progress value={heat} className="h-2" />
        <p className="text-xs text-muted-foreground">
          Heat measures unwanted attention. High Heat makes serious stories more likely to escalate and can trigger fines, venue restrictions and travel scrutiny.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Checking the news cycle…</p>
        ) : active.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No active scandals. Relationship gossip and messy underground failures can still become stories later.
          </div>
        ) : (
          active.map((scandal) => (
            <div key={scandal.id} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={scandal.stage === "frenzy" ? "destructive" : "secondary"}>{stageLabels[scandal.stage]}</Badge>
                    <Badge variant="outline">Severity {scandal.severity}/5</Badge>
                    <Badge variant="outline" className="capitalize">{scandal.category.replace("_", " ")}</Badge>
                  </div>
                  <p className="font-medium text-sm">{scandal.headline}</p>
                  <p className="text-xs text-muted-foreground">{scandal.summary}</p>
                </div>
                <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div className="rounded bg-muted/50 p-2"><span className="text-muted-foreground">Credibility</span><div className="font-semibold">{scandal.credibility}%</div></div>
                <div className="rounded bg-muted/50 p-2"><span className="text-muted-foreground">Exposure</span><div className="font-semibold">{scandal.exposure}%</div></div>
                <div className="rounded bg-muted/50 p-2"><span className="text-muted-foreground">Fine</span><div className="font-semibold">{scandal.fine_amount > 0 ? `$${scandal.fine_amount.toLocaleString()}` : "None"}</div></div>
                <div className="rounded bg-muted/50 p-2"><span className="text-muted-foreground">Response</span><div className="font-semibold capitalize">{scandal.response_choice?.replace("_", " ") ?? "Not issued"}</div></div>
              </div>

              {(activeRestriction(scandal.venue_restriction_until) || activeRestriction(scandal.travel_scrutiny_until) || activeRestriction(scandal.media_blackout_until)) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {activeRestriction(scandal.venue_restriction_until) && <Badge variant="destructive"><ShieldAlert className="mr-1 h-3 w-3" /> Venue restriction active</Badge>}
                  {activeRestriction(scandal.travel_scrutiny_until) && <Badge variant="destructive"><ShieldAlert className="mr-1 h-3 w-3" /> Travel scrutiny active</Badge>}
                  {activeRestriction(scandal.media_blackout_until) && <Badge variant="secondary"><Megaphone className="mr-1 h-3 w-3" /> Media blackout</Badge>}
                </div>
              )}

              {!scandal.response_choice && (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(responseLabels) as Exclude<ScandalResponse, "pay_fine">[]).map((response) => (
                    <Button
                      key={response}
                      size="sm"
                      variant={response === "lean_in" ? "destructive" : "outline"}
                      disabled={responseMutation.isPending}
                      onClick={() => responseMutation.mutate({ scandalId: scandal.id, response })}
                    >
                      {responseLabels[response]}
                    </Button>
                  ))}
                </div>
              )}

              {scandal.fine_amount > 0 && !scandal.fine_paid && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={responseMutation.isPending}
                  onClick={() => responseMutation.mutate({ scandalId: scandal.id, response: "pay_fine" })}
                >
                  <BadgeDollarSign className="mr-1 h-4 w-4" /> Pay ${scandal.fine_amount.toLocaleString()} fine
                </Button>
              )}

              {scandal.response_outcome && (
                <p className="text-xs text-muted-foreground">Response outcome: <span className="font-medium capitalize">{scandal.response_outcome}</span></p>
              )}
            </div>
          ))
        )}

        {history.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recently resolved</p>
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-xs">
                <span className="truncate">{item.headline}</span>
                <Badge variant="outline">Resolved</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
