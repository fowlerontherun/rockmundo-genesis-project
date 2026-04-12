import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface BackstageEvent {
  id: string;
  festival_id: string;
  band_id: string;
  event_type: string;
  title: string;
  description: string;
  choices: { label: string; fameImpact: number; moneyImpact: number; chemistryImpact: number; reputationKey?: string; reputationChange?: number }[];
  chosen_option?: number;
  outcome_text?: string;
  fame_impact: number;
  money_impact: number;
  chemistry_impact: number;
  reputation_impact: Record<string, number>;
  created_at: string;
}

const BACKSTAGE_EVENT_TEMPLATES = [
  {
    event_type: "media_interview",
    title: "Backstage Interview Request",
    description: "A journalist from Rock Weekly wants a quick interview before your set. How do you handle it?",
    choices: [
      { label: "Give an honest, heartfelt interview", fameImpact: 15, moneyImpact: 0, chemistryImpact: 5, reputationKey: "authenticity", reputationChange: 10 },
      { label: "Drop some controversial hot takes", fameImpact: 25, moneyImpact: 0, chemistryImpact: -5, reputationKey: "attitude", reputationChange: -10 },
      { label: "Politely decline — focus on the show", fameImpact: 0, moneyImpact: 0, chemistryImpact: 10, reputationKey: "reliability", reputationChange: 5 },
    ],
  },
  {
    event_type: "rival_encounter",
    title: "Rival Band Backstage",
    description: "You bump into a rival band backstage. Their lead singer smirks and makes a snide comment about your last album.",
    choices: [
      { label: "Laugh it off and wish them luck", fameImpact: 5, moneyImpact: 0, chemistryImpact: 10, reputationKey: "attitude", reputationChange: 15 },
      { label: "Fire back with a witty comeback", fameImpact: 10, moneyImpact: 0, chemistryImpact: 0, reputationKey: "authenticity", reputationChange: 5 },
      { label: "Challenge them to a guitar duel on stage", fameImpact: 30, moneyImpact: 0, chemistryImpact: -10, reputationKey: "creativity", reputationChange: 10 },
    ],
  },
  {
    event_type: "fan_encounter",
    title: "Superfan Backstage Pass",
    description: "A superfan with a backstage pass is overwhelmed to meet you. They have a tattoo of your band logo!",
    choices: [
      { label: "Spend 20 minutes chatting and taking photos", fameImpact: 10, moneyImpact: 0, chemistryImpact: 5, reputationKey: "attitude", reputationChange: 15 },
      { label: "Sign an autograph and move on", fameImpact: 3, moneyImpact: 0, chemistryImpact: 0, reputationKey: "attitude", reputationChange: -5 },
      { label: "Invite them to watch from the side stage", fameImpact: 20, moneyImpact: 0, chemistryImpact: 8, reputationKey: "authenticity", reputationChange: 10 },
    ],
  },
  {
    event_type: "sponsor_deal",
    title: "Last-Minute Sponsor Offer",
    description: "A brand rep approaches you backstage offering cash to wear their merch during your set.",
    choices: [
      { label: "Take the deal — easy money", fameImpact: -5, moneyImpact: 2000, chemistryImpact: -5, reputationKey: "authenticity", reputationChange: -20 },
      { label: "Decline — stay true to your brand", fameImpact: 10, moneyImpact: 0, chemistryImpact: 10, reputationKey: "authenticity", reputationChange: 15 },
      { label: "Counter-offer for double the money", fameImpact: 0, moneyImpact: 3500, chemistryImpact: 0, reputationKey: "creativity", reputationChange: 5 },
    ],
  },
  {
    event_type: "equipment_crisis",
    title: "Equipment Emergency!",
    description: "Your guitarist's amp just blew a fuse 30 minutes before your set. The festival's spare gear is mediocre at best.",
    choices: [
      { label: "Use the festival's spare gear — the show must go on", fameImpact: 0, moneyImpact: 0, chemistryImpact: 5, reputationKey: "reliability", reputationChange: 10 },
      { label: "Borrow from another band (they might say no)", fameImpact: 5, moneyImpact: 0, chemistryImpact: -5, reputationKey: "creativity", reputationChange: 5 },
      { label: "Go acoustic for the set — make it unique", fameImpact: 15, moneyImpact: 0, chemistryImpact: 15, reputationKey: "creativity", reputationChange: 20 },
    ],
  },
  {
    event_type: "band_argument",
    title: "Pre-Show Tension",
    description: "The drummer and bassist are arguing about the setlist order. Tensions are running high before your big performance.",
    choices: [
      { label: "Mediate calmly and find a compromise", fameImpact: 0, moneyImpact: 0, chemistryImpact: 15, reputationKey: "reliability", reputationChange: 10 },
      { label: "Take the drummer's side — they're right", fameImpact: 0, moneyImpact: 0, chemistryImpact: -10, reputationKey: "authenticity", reputationChange: 5 },
      { label: "Pull rank and decide the order yourself", fameImpact: 0, moneyImpact: 0, chemistryImpact: -5, reputationKey: "attitude", reputationChange: -10 },
    ],
  },
  {
    event_type: "celeb_meeting",
    title: "Celebrity Encounter",
    description: "A famous music producer is hanging out backstage and seems interested in your band. This could be a career-changing moment.",
    choices: [
      { label: "Play it cool and let your music speak", fameImpact: 10, moneyImpact: 0, chemistryImpact: 5, reputationKey: "authenticity", reputationChange: 10 },
      { label: "Network aggressively — hand out demos", fameImpact: 5, moneyImpact: 0, chemistryImpact: -5, reputationKey: "attitude", reputationChange: -10 },
      { label: "Invite them to watch from backstage", fameImpact: 20, moneyImpact: 0, chemistryImpact: 0, reputationKey: "creativity", reputationChange: 5 },
    ],
  },
  {
    event_type: "food_drama",
    title: "Catering Catastrophe",
    description: "The festival catering ran out of food, and your band hasn't eaten. A food vendor offers free samples if you shout them out on stage.",
    choices: [
      { label: "Accept the deal — the band needs to eat!", fameImpact: -3, moneyImpact: 0, chemistryImpact: 10, reputationKey: "authenticity", reputationChange: -5 },
      { label: "Tough it out — perform hungry", fameImpact: 5, moneyImpact: 0, chemistryImpact: -5, reputationKey: "reliability", reputationChange: 10 },
      { label: "Send someone to get pizza — delay soundcheck", fameImpact: 0, moneyImpact: -50, chemistryImpact: 15, reputationKey: "attitude", reputationChange: 5 },
    ],
  },
];

export const useFestivalBackstageEvents = (festivalId?: string, bandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ["backstage-events", festivalId, bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_backstage_events")
        .select("*")
        .eq("festival_id", festivalId)
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BackstageEvent[];
    },
    enabled: !!festivalId && !!bandId,
  });

  const triggerEventMutation = useMutation({
    mutationFn: async () => {
      if (!festivalId || !bandId) throw new Error("Missing IDs");
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      // Pick a random event template
      const template = BACKSTAGE_EVENT_TEMPLATES[Math.floor(Math.random() * BACKSTAGE_EVENT_TEMPLATES.length)];

      const { data, error } = await (supabase as any)
        .from("festival_backstage_events")
        .insert({
          festival_id: festivalId,
          band_id: bandId,
          event_type: template.event_type,
          title: template.title,
          description: template.description,
          choices: template.choices,
          triggered_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BackstageEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backstage-events", festivalId, bandId] });
    },
    onError: (error: any) => {
      toast({
        title: "Event failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resolveEventMutation = useMutation({
    mutationFn: async ({ eventId, choiceIndex }: { eventId: string; choiceIndex: number }) => {
      // Get the event to find the choice
      const { data: event, error: fetchErr } = await (supabase as any)
        .from("festival_backstage_events")
        .select("*")
        .eq("id", eventId)
        .single();
      if (fetchErr) throw fetchErr;

      const choices = event.choices as any[];
      const choice = choices[choiceIndex];
      if (!choice) throw new Error("Invalid choice");

      const outcomeTexts: Record<string, string[]> = {
        media_interview: ["The interview went viral!", "Your words resonated with fans.", "The article was lukewarm."],
        rival_encounter: ["The crowd loved the drama!", "Backstage gossip spread fast.", "Tensions will simmer."],
        fan_encounter: ["The fan posted about it everywhere!", "A touching moment backstage.", "Quick but meaningful."],
        sponsor_deal: ["The brand is thrilled!", "Your integrity shines.", "A savvy business move."],
        equipment_crisis: ["The show went on!", "Creative problem-solving!", "Not ideal, but it worked."],
        band_argument: ["Peace restored!", "Sides were taken.", "You showed leadership."],
        celeb_meeting: ["They want to talk after!", "Connections made.", "Maybe next time."],
        food_drama: ["Well-fed and ready!", "Hungry but determined.", "Pizza saves the day!"],
      };

      const outcomes = outcomeTexts[event.event_type] || ["Something happened backstage."];
      const outcomeText = outcomes[Math.min(choiceIndex, outcomes.length - 1)];

      const repImpact: Record<string, number> = {};
      if (choice.reputationKey) {
        repImpact[choice.reputationKey] = choice.reputationChange || 0;
      }

      const { error } = await (supabase as any)
        .from("festival_backstage_events")
        .update({
          chosen_option: choiceIndex,
          outcome_text: outcomeText,
          fame_impact: choice.fameImpact,
          money_impact: choice.moneyImpact,
          chemistry_impact: choice.chemistryImpact,
          reputation_impact: repImpact,
        })
        .eq("id", eventId);

      if (error) throw error;
      return { ...choice, outcomeText };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["backstage-events", festivalId, bandId] });
      const impacts: string[] = [];
      if (result.fameImpact) impacts.push(`Fame ${result.fameImpact > 0 ? "+" : ""}${result.fameImpact}`);
      if (result.moneyImpact) impacts.push(`$${result.moneyImpact > 0 ? "+" : ""}${result.moneyImpact}`);
      if (result.chemistryImpact) impacts.push(`Chemistry ${result.chemistryImpact > 0 ? "+" : ""}${result.chemistryImpact}`);

      toast({
        title: result.outcomeText,
        description: impacts.join(" • ") || "Your choice has been recorded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resolve event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    events,
    isLoading,
    triggerEvent: triggerEventMutation.mutate,
    isTriggering: triggerEventMutation.isPending,
    resolveEvent: resolveEventMutation.mutate,
    isResolving: resolveEventMutation.isPending,
  };
};
