import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Sparkles, Tv2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  chooseTotpBackstageInterview,
  listMyTotpBackstageInteractions,
  type TotpInterviewChoice,
} from "./api";

interface TotpBackstageInterviewCardProps {
  invitationId: string;
}

const PROMPTS: Record<string, string> = {
  first_impressions: "Alex Rayne: You're about to make your mark on RockMundo television. What do you want viewers to remember about you tonight?",
  chart_pressure: "Alex Rayne: Your song has earned a place in the charts. Does that add pressure before you walk onto the studio floor?",
  fans_waiting: "Alex Rayne: Fans are already gathering outside the television centre. What do you want to say to them before the performance?",
  live_television: "Alex Rayne: This is live television and there are no second chances. How are you feeling right now?",
};

const CHOICES: Array<{ key: TotpInterviewChoice; label: string; detail: string }> = [
  {
    key: "confident",
    label: "Own the moment",
    detail: "+ reputation, + media attention, small fan-sentiment gain",
  },
  {
    key: "humble",
    label: "Thank the fans",
    detail: "+ fan sentiment, small reputation and media gains",
  },
  {
    key: "cheeky",
    label: "Give them a headline",
    detail: "largest media boost, but a small fan-sentiment risk",
  },
];

export function TotpBackstageInterviewCard({ invitationId }: TotpBackstageInterviewCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const interactions = useQuery({
    queryKey: ["totp", "backstage"],
    queryFn: listMyTotpBackstageInteractions,
  });

  const interaction = interactions.data?.find((row) => row.invitation_id === invitationId) ?? null;

  const choose = useMutation({
    mutationFn: (choice: TotpInterviewChoice) => {
      if (!interaction) throw new Error("The backstage interview is not ready yet.");
      return chooseTotpBackstageInterview(interaction.id, choice);
    },
    onSuccess: (result) => {
      const effects = result.effects ?? {};
      toast({
        title: "Interview answer locked",
        description: `Reputation ${Number(effects.reputation ?? 0) >= 0 ? "+" : ""}${effects.reputation ?? 0}, fan sentiment ${Number(effects.fan_sentiment ?? 0) >= 0 ? "+" : ""}${effects.fan_sentiment ?? 0}, media ${Number(effects.media_intensity ?? 0) >= 0 ? "+" : ""}${effects.media_intensity ?? 0}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp", "backstage"] });
    },
    onError: (error: Error) => toast({
      title: "Could not save interview response",
      description: error.message,
      variant: "destructive",
    }),
  });

  if (interactions.isLoading || !interaction) return null;

  const resolved = !!interaction.resolved_at;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tv2 className="h-4 w-4" /> Backstage with Alex Rayne
            </CardTitle>
            <CardDescription>Recorded before your Top of the Pops performance.</CardDescription>
          </div>
          <Badge variant={resolved ? "secondary" : "default"}>{resolved ? "answered" : "live"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-background/70 p-4 text-sm leading-relaxed">
          <MessageCircle className="mb-2 h-4 w-4 text-primary" />
          {PROMPTS[interaction.prompt_key] ?? PROMPTS.live_television}
        </div>

        {resolved ? (
          <div className="space-y-2 text-sm">
            <div className="font-medium">Your answer: {CHOICES.find((choice) => choice.key === interaction.selected_choice)?.label ?? interaction.selected_choice}</div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Reputation {Number(interaction.effects.reputation ?? 0) >= 0 ? "+" : ""}{interaction.effects.reputation ?? 0}</Badge>
              <Badge variant="outline">Fan sentiment {Number(interaction.effects.fan_sentiment ?? 0) >= 0 ? "+" : ""}{interaction.effects.fan_sentiment ?? 0}</Badge>
              <Badge variant="outline">Media {Number(interaction.effects.media_intensity ?? 0) >= 0 ? "+" : ""}{interaction.effects.media_intensity ?? 0}</Badge>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {CHOICES.map((choice) => (
              <Button
                key={choice.key}
                variant="outline"
                className="h-auto justify-start whitespace-normal p-3 text-left"
                onClick={() => choose.mutate(choice.key)}
                disabled={choose.isPending}
              >
                <span>
                  <span className="flex items-center gap-2 font-medium"><Sparkles className="h-3.5 w-3.5" /> {choice.label}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">{choice.detail}</span>
                </span>
              </Button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">Interview choices never alter charts, cash rewards or Top of the Pops eligibility.</p>
      </CardContent>
    </Card>
  );
}
