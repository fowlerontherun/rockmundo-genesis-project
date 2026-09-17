import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Flame, MessageSquareMore, RadioTower, Sparkles, Users, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  chooseTotpIncidentRecovery,
  chooseTotpPerformanceStyle,
  getMyTotpLiveTvExtras,
  type TotpIncidentRecoveryChoice,
  type TotpPerformanceStyleChoice,
} from "./liveTvApi";
import {
  chooseTotpPostShowInteraction,
  getMyTotpPostShowInteractions,
  type TotpPostShowChoice,
} from "./postShowApi";
import { totpAudienceReactionLabel } from "./studioAudience";

interface TotpLiveTvExtrasCardProps {
  invitationId: string;
}

const STYLE_CHOICES: Array<{
  key: Exclude<TotpPerformanceStyleChoice, "house_direction">;
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

const RECOVERY_COPY: Record<string, Array<{
  key: TotpIncidentRecoveryChoice;
  title: string;
  description: string;
}>> = {
  broken_string: [
    { key: "professional", title: "Take the spare", description: "Swap instruments cleanly and keep the room calm. Safest reputation gain." },
    { key: "improvise", title: "Play through it", description: "Adapt the part on the fly. Better audience reaction with moderate buzz." },
    { key: "showman", title: "Make it part of the show", description: "Turn the mishap into a visible live-TV moment. Biggest crowd/media upside." },
  ],
  late_floor_manager: [
    { key: "professional", title: "Follow the new cue", description: "Trust the floor team and hit the revised mark. Safest reputation gain." },
    { key: "improvise", title: "Adapt on the move", description: "Rework the entrance naturally. Better crowd response and some media buzz." },
    { key: "showman", title: "Lean into the chaos", description: "Make the scramble look deliberate. Bigger media reaction with a small fan-sentiment risk." },
  ],
};

const POSTSHOW_PROMPTS: Record<string, string> = {
  press_line: "The performance is over and the press line is forming outside the green room.",
  fan_barrier: "You can hear fans calling for the band at the barrier outside the television centre.",
  green_room_wrap: "The cameras are down, the adrenaline is still high, and the green room is starting to empty.",
  producer_chat: "A RockMundo Television producer asks if the band can stay for a quick post-show conversation.",
};

const POSTSHOW_CHOICES: Array<{
  key: TotpPostShowChoice;
  title: string;
  description: string;
}> = [
  { key: "press", title: "Stay for the press", description: "Lean into the television moment. Strongest media boost with a small reputation gain." },
  { key: "fans", title: "Go meet the fans", description: "Spend the time at the barrier. Strongest fan-sentiment gain with a little extra buzz." },
  { key: "band", title: "Decompress with the band", description: "Skip the circus and regroup together. Strongest reputation gain with a small fan benefit." },
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
  const postShow = useQuery({
    queryKey: ["totp", "postshow"],
    queryFn: getMyTotpPostShowInteractions,
  });

  const event = extras.data?.events.find((row) => row.invitation_id === invitationId) ?? null;
  const style = extras.data?.styles.find((row) => row.invitation_id === invitationId) ?? null;
  const followUp = postShow.data?.find((row) => row.invitation_id === invitationId) ?? null;

  const chooseStyle = useMutation({
    mutationFn: (choice: Exclude<TotpPerformanceStyleChoice, "house_direction">) => {
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

  const chooseRecovery = useMutation({
    mutationFn: (choice: TotpIncidentRecoveryChoice) => {
      if (!event) throw new Error("The production incident is not ready yet.");
      return chooseTotpIncidentRecovery(event.id, choice);
    },
    onSuccess: (result) => {
      toast({
        title: "Production recovery locked",
        description: `${result.choice.replaceAll("_", " ")} · audience now ${signed(result.audience_reaction)}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "live-tv-extras"] });
    },
    onError: (error: Error) => toast({
      title: "Could not save production recovery",
      description: error.message,
      variant: "destructive",
    }),
  });

  const choosePostShow = useMutation({
    mutationFn: (choice: TotpPostShowChoice) => {
      if (!followUp) throw new Error("The post-show green-room choice is not ready yet.");
      return chooseTotpPostShowInteraction(followUp.id, choice);
    },
    onSuccess: (result) => {
      toast({
        title: "Post-show choice locked",
        description: `Reputation ${signed(result.effects.reputation)}, fan sentiment ${signed(result.effects.fan_sentiment)}, media ${signed(result.effects.media_intensity)}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "postshow"] });
    },
    onError: (error: Error) => toast({
      title: "Could not save post-show choice",
      description: error.message,
      variant: "destructive",
    }),
  });

  if ((extras.isLoading || postShow.isLoading) && !event && !style && !followUp) return null;
  if (!event && !style && !followUp) return null;

  const selectedStyle = STYLE_CHOICES.find((choice) => choice.key === style?.selected_style) ?? null;
  const recoveryChoices = event ? RECOVERY_COPY[event.event_key] ?? [] : [];
  const audienceReaction = Number(event?.audience_reaction ?? 0) + Number(style?.selected_style ? style.audience_reaction : 0);
  const audienceMeter = Math.max(0, Math.min(100, 50 + audienceReaction * 8));
  const audienceLabel = totpAudienceReactionLabel(audienceReaction);
  const selectedPostShow = POSTSHOW_CHOICES.find((choice) => choice.key === followUp?.selected_choice) ?? null;

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTower className="h-4 w-4" /> Live television production
            </CardTitle>
            <CardDescription>Studio incidents, performance direction and the post-show green room.</CardDescription>
          </div>
          <Badge variant="secondary"><Users className="mr-1 h-3 w-3" /> Audience: {audienceLabel}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {(event || style) && (
          <div className="rounded-lg border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> Studio audience</div>
              <Badge variant="secondary">{audienceLabel} · {signed(audienceReaction)}</Badge>
            </div>
            <Progress value={audienceMeter} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              The locked reaction drives the canonical 3D studio crowd density and how tightly fans press toward the performance area.
            </p>
          </div>
        )}

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

            {event.requires_recovery && !event.recovered_at && recoveryChoices.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium"><Wrench className="h-4 w-4" /> How do you recover?</div>
                <div className="grid gap-2 lg:grid-cols-3">
                  {recoveryChoices.map((choice) => (
                    <Button
                      key={choice.key}
                      variant="outline"
                      className="h-auto justify-start whitespace-normal p-3 text-left"
                      onClick={() => chooseRecovery.mutate(choice.key)}
                      disabled={chooseRecovery.isPending}
                    >
                      <span>
                        <span className="font-medium">{choice.title}</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">{choice.description}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {event.recovered_at && event.recovery_choice && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 text-xs">
                <Badge variant="secondary">Recovery: {event.recovery_choice.replaceAll("_", " ")}</Badge>
                {event.recovery_effects?.auto_locked && <Badge variant="outline">safe fallback</Badge>}
                {Number(event.recovery_effects?.audience_reaction ?? 0) !== 0 && (
                  <Badge variant="outline">Recovery audience {signed(event.recovery_effects?.audience_reaction)}</Badge>
                )}
              </div>
            )}
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
                <div className="font-medium">
                  {style.selected_style === "house_direction" ? "House television direction" : selectedStyle?.title ?? style.selected_style.replaceAll("_", " ")}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {style.selected_style === "house_direction"
                    ? "No player style was locked before the performance completed, so the broadcast uses neutral house direction."
                    : selectedStyle?.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge>Fame x{Number(style.fame_multiplier).toFixed(2)}</Badge>
                  <Badge variant="outline"><Users className="mr-1 h-3 w-3" /> Audience {signed(style.audience_reaction)}</Badge>
                  {style.effects?.auto_locked && <Badge variant="secondary">automatic fallback</Badge>}
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

        {followUp && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <div className="flex items-center gap-2 font-medium"><MessageSquareMore className="h-4 w-4 text-violet-500" /> After the cameras stop</div>
              <p className="mt-1 text-sm text-muted-foreground">{POSTSHOW_PROMPTS[followUp.prompt_key] ?? POSTSHOW_PROMPTS.green_room_wrap}</p>
            </div>

            {followUp.resolved_at ? (
              <div className="rounded-lg border bg-background/70 p-4">
                <div className="font-medium">{selectedPostShow?.title ?? followUp.selected_choice?.replaceAll("_", " ")}</div>
                <p className="mt-1 text-sm text-muted-foreground">{selectedPostShow?.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {Number(followUp.effects.reputation ?? 0) !== 0 && <Badge variant="outline">Reputation {signed(followUp.effects.reputation)}</Badge>}
                  {Number(followUp.effects.fan_sentiment ?? 0) !== 0 && <Badge variant="outline">Fan sentiment {signed(followUp.effects.fan_sentiment)}</Badge>}
                  {Number(followUp.effects.media_intensity ?? 0) !== 0 && <Badge variant="outline">Media {signed(followUp.effects.media_intensity)}</Badge>}
                  <Badge variant="secondary">0 extra fame</Badge>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 lg:grid-cols-3">
                {POSTSHOW_CHOICES.map((choice) => (
                  <Button
                    key={choice.key}
                    variant="outline"
                    className="h-auto justify-start whitespace-normal p-3 text-left"
                    onClick={() => choosePostShow.mutate(choice.key)}
                    disabled={choosePostShow.isPending}
                  >
                    <span>
                      <span className="font-medium">{choice.title}</span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">{choice.description}</span>
                    </span>
                  </Button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Post-show choices never change fame, chart position, cash or future eligibility.</p>
          </div>
        )}

        {(event || style) && (
          <p className="text-xs text-muted-foreground">
            Production events and raw-live risk are seeded from the invitation, so refreshing cannot reroll the outcome.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
