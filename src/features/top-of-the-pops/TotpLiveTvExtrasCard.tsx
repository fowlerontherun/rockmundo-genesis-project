import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Flame, RadioTower, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  chooseTotpPerformanceStyle,
  getMyTotpLiveTvExtras,
  type TotpPerformanceStyleChoice,
} from "./liveTvApi";

interface TotpLiveTvExtrasCardProps {
  invitationId: string;
}

const STYLE_CHOICES: Array<{
  key: TotpPerformanceStyleChoice;
  title: string;
  description: string;
}> = [
  {
    key: "polished",
    title: "Polished television performance",
    description: "Controlled, camera-aware and reliable. Small fame and reputation lift.",
  },
  {
    key: "crowd_first",
    title: "Play to the studio audience",
    description: "Prioritise energy and connection. Strongest fan reaction with a modest fame lift.",
  },
  {
    key: "raw_live",
    title: "Go raw and live",
    description: "Higher upside and bigger buzz, but the deterministic live-TV risk can also trim the fame result.",
  },
];

function signed(value: number | undefined) {
  const numeric = Number(value ?? 0);
  return `${numeric >= 0 ? "+" : ""}${numeric}`;
}

export function TotpLiveTvExtrasCard({ invitationId }: TotpLiveTvExtrasCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const extras = useQuery({
    queryKey: ["totp", "live-tv-extras"],
    queryFn: getMyTotpLiveTvExtras,
  });

  const event = extras.data?.events.find((row) => row.invitation_id === invitationId) ?? null;
  const style = extras.data?.styles.find((row) => row.invitation_id === invitationId) ?? null;

  const chooseStyle = useMutation({
    mutationFn: (choice: TotpPerformanceStyleChoice) => {
      if (!style) throw new Error("The performance-style choice is not ready yet.");
      return chooseTotpPerformanceStyle(style.id, choice);
    },
    onSuccess: (result) => {
      toast({
        title: "Performance style locked",
        description: `${result.style.replaceAll("_", " ")} · fame x${Number(result.fame_multiplier).toFixed(2)} · audience ${signed(result.audience_reaction)}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "live-tv-extras"] });
    },
    onError: (error: Error) => toast({
      title: "Could not save performance style",
      description: error.message,
      variant: "destructive",
    }),
  });

  if (extras.isLoading || (!event && !style)) return null;

  const selectedStyle = STYLE_CHOICES.find((choice) => choice.key === style?.selected_style) ?? null;

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTower className="h-4 w-4" /> Live television production
            </CardTitle>
            <CardDescription>Studio incidents and the performance approach for tonight's broadcast.</CardDescription>
          </div>
          <Badge variant="secondary">studio floor</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {event && (
          <div className="rounded-lg border bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <Activity className="h-4 w-4 text-amber-500" /> {event.title}
              </div>
              <Badge variant="outline">Audience {signed(event.audience_reaction)}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {Number(event.effects.reputation ?? 0) !== 0 && <Badge variant="outline">Reputation {signed(event.effects.reputation)}</Badge>}
              {Number(event.effects.fan_sentiment ?? 0) !== 0 && <Badge variant="outline">Fan sentiment {signed(event.effects.fan_sentiment)}</Badge>}
              {Number(event.effects.media_intensity ?? 0) !== 0 && <Badge variant="outline">Media {signed(event.effects.media_intensity)}</Badge>}
            </div>
          </div>
        )}

        {style && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <Flame className="h-4 w-4 text-primary" /> Performance style
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                This can slightly change the fame earned from the appearance, but never the chart, cash payout or future eligibility.
              </p>
            </div>

            {style.selected_style ? (
              <div className="rounded-lg border bg-background/70 p-4">
                <div className="font-medium">{selectedStyle?.title ?? style.selected_style.replaceAll("_", " ")}</div>
                <p className="mt-1 text-sm text-muted-foreground">{selectedStyle?.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge>Fame x{Number(style.fame_multiplier).toFixed(2)}</Badge>
                  <Badge variant="outline"><Users className="mr-1 h-3 w-3" /> Audience {signed(style.audience_reaction)}</Badge>
                  {style.applied_at && <Badge variant="secondary">applied</Badge>}
                </div>
              </div>
            ) : (
              <div className="grid gap-2 lg:grid-cols-3">
                {STYLE_CHOICES.map((choice) => (
                  <Button
                    key={choice.key}
                    variant="outline"
                    className="h-auto justify-start whitespace-normal p-3 text-left"
                    onClick={() => chooseStyle.mutate(choice.key)}
                    disabled={chooseStyle.isPending}
                  >
                    <span>
                      <span className="flex items-center gap-2 font-medium"><Sparkles className="h-3.5 w-3.5" /> {choice.title}</span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">{choice.description}</span>
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Production events and raw-live risk are seeded from the invitation, so refreshing cannot reroll the outcome.
        </p>
      </CardContent>
    </Card>
  );
}
