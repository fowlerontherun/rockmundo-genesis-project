import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, PartyPopper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { supabase } from "@/integrations/supabase/client";
import { calculateCharacterAgeFromAnchor } from "@/utils/gameCalendar";

type BirthdayChoice = {
  label: string;
  outcome?: string;
  effects?: Record<string, number>;
};

type BirthdayState = {
  is_birthday: boolean;
  age: number;
  claimed?: boolean;
  reward?: { sxp: number; ap: number };
  event?: {
    instance_id: string;
    title: string;
    description: string;
    choices: BirthdayChoice[];
    resolved: boolean;
    selected_choice?: number | null;
    outcome_text?: string | null;
  } | null;
};

function effectSummary(effects?: Record<string, number>) {
  if (!effects) return "";
  return Object.entries(effects)
    .map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${key.toUpperCase()}`)
    .join(" · ");
}

export function BirthdayExperience() {
  const { profile } = useGameData();
  const { data: calendar } = useGameCalendar();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const ageProfile = profile as any;

  const currentAge = profile && calendar
    ? calculateCharacterAgeFromAnchor(ageProfile, calendar)
    : null;
  const isBirthday = Boolean(
    profile &&
    calendar &&
    Number(ageProfile?.birth_game_month) === calendar.gameMonth &&
    Number(ageProfile?.birth_game_day) === calendar.gameDay,
  );

  const birthdayState = useQuery({
    queryKey: ["birthday-state", profile?.id, calendar?.gameYear, calendar?.gameMonth, calendar?.gameDay],
    enabled: Boolean(profile?.id && calendar && isBirthday),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ensure_birthday_state" as any, {
        _profile_id: profile!.id,
        _game_year: calendar!.gameYear,
        _game_month: calendar!.gameMonth,
        _game_day: calendar!.gameDay,
      });
      if (error) throw error;
      return data as BirthdayState;
    },
    staleTime: 60_000,
  });

  const claimReward = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_character_birthday_reward" as any, {
        _profile_id: profile!.id,
        _game_year: calendar!.gameYear,
        _game_month: calendar!.gameMonth,
        _game_day: calendar!.gameDay,
      });
      if (error) throw error;
      return data as { success: boolean; sxp: number; ap: number; age: number };
    },
    onSuccess: (result) => {
      toast({
        title: "🎂 Birthday reward claimed!",
        description: `You received ${result.sxp.toLocaleString()} SXP and ${result.ap} AP.`,
      });
      queryClient.invalidateQueries({ queryKey: ["birthday-state"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["player-xp-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["experience-ledger"] });
    },
    onError: (error: Error) => toast({ title: "Birthday reward failed", description: error.message, variant: "destructive" }),
  });

  const resolveEvent = useMutation({
    mutationFn: async ({ instanceId, choiceIndex }: { instanceId: string; choiceIndex: number }) => {
      const { data, error } = await supabase.rpc("resolve_birthday_event_choice" as any, {
        _instance_id: instanceId,
        _choice_index: choiceIndex,
      });
      if (error) throw error;
      return data as { success: boolean; outcome: string; effects: Record<string, number> };
    },
    onSuccess: (result) => {
      toast({ title: "Birthday choice made", description: result.outcome });
      queryClient.invalidateQueries({ queryKey: ["birthday-state"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["player-xp-wallet"] });
    },
    onError: (error: Error) => toast({ title: "Could not resolve birthday event", description: error.message, variant: "destructive" }),
  });

  if (!isBirthday || !profile || !calendar) return null;

  const state = birthdayState.data;
  const displayAge = state?.age ?? currentAge ?? Number(ageProfile?.age ?? 16);
  const reward = state?.reward;
  const event = state?.event;

  return (
    <Card className="mb-4 overflow-hidden border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-pink-500/10 to-violet-500/10 shadow-sm">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <div className="text-4xl" aria-hidden>🎂</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">Happy {displayAge}th Birthday!</h2>
                <Badge variant="secondary"><PartyPopper className="mr-1 h-3 w-3" />Birthday</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Your character has aged up. A birthday notification has been added to your inbox.</p>
              {reward && <p className="mt-2 flex items-center gap-2 text-sm font-medium"><Gift className="h-4 w-4" />Birthday bonus: {reward.sxp.toLocaleString()} SXP + {reward.ap} AP</p>}
            </div>
          </div>
          {state && !state.claimed ? (
            <Button onClick={() => claimReward.mutate()} disabled={claimReward.isPending}>
              <Sparkles className="mr-2 h-4 w-4" />{claimReward.isPending ? "Claiming..." : "Claim birthday bonus"}
            </Button>
          ) : state?.claimed ? <Badge className="w-fit">Reward claimed</Badge> : null}
        </div>

        {birthdayState.isLoading && <p className="text-sm text-muted-foreground">Preparing your birthday surprise...</p>}

        {event && !event.resolved && (
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Birthday event</p>
            <h3 className="mt-1 text-lg font-semibold">{event.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {event.choices.map((choice, index) => (
                <Button
                  key={`${event.instance_id}-${index}`}
                  variant="outline"
                  className="h-auto min-h-16 justify-start whitespace-normal p-3 text-left"
                  disabled={resolveEvent.isPending}
                  onClick={() => resolveEvent.mutate({ instanceId: event.instance_id, choiceIndex: index })}
                >
                  <span>
                    <span className="block font-medium">{choice.label}</span>
                    {effectSummary(choice.effects) && <span className="mt-1 block text-xs text-muted-foreground">{effectSummary(choice.effects)}</span>}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {event?.resolved && event.outcome_text && (
          <div className="rounded-lg border bg-background/60 p-3 text-sm">
            <span className="font-medium">Birthday outcome:</span> {event.outcome_text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
