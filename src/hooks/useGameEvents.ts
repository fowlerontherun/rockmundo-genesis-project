import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export type GameEventWithStatus = {
  id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  participantCount: number;
  max_participants: number | null;
  availableSlots: number | null;
  rewards?: Record<string, unknown> | null;
  requirements?: Record<string, unknown> | null;
  isUserParticipant: boolean;
  isUserRewardClaimed: boolean;
};

export type UseGameEventsOptions = {
  profile?: { id: string; user_id: string } | null;
  updateProfile?: (updates: Record<string, unknown>) => Promise<void>;
  addActivity?: (activity: { type: string; message: string; earnings?: number }) => void;
};

export const useGameEvents = (options: UseGameEventsOptions = {}) => {
  const { profile, updateProfile, addActivity } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [completingEventId, setCompletingEventId] = useState<string | null>(null);

  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ["game-events", profile?.id],
    queryFn: async () => {
      const { data: eventsData, error: eventsError } = await supabase
        .from("game_events")
        .select("*")
        .gte("end_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (eventsError) throw eventsError;

      const eventsWithStatus: GameEventWithStatus[] = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { count: participantCount } = await supabase
            .from("event_participants")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id);

          let isUserParticipant = false;
          let isUserRewardClaimed = false;

          if (profile?.id) {
            const { data: participant } = await supabase
              .from("event_participants")
              .select("*")
              .eq("event_id", event.id)
              .eq("user_id", profile.user_id)
              .maybeSingle();

            isUserParticipant = !!participant;
            isUserRewardClaimed = participant?.rewards_claimed || false;
          }

          const availableSlots = event.max_participants
            ? event.max_participants - (participantCount || 0)
            : null;

          return {
            id: event.id,
            title: event.title,
            description: event.description,
            start_date: event.start_date,
            end_date: event.end_date,
            is_active: event.is_active,
            participantCount: participantCount || 0,
            max_participants: event.max_participants,
            availableSlots,
            rewards: event.rewards as Record<string, unknown> | null,
            requirements: event.requirements as Record<string, unknown> | null,
            isUserParticipant,
            isUserRewardClaimed,
          };
        })
      );

      return eventsWithStatus;
    },
    enabled: !!profile,
  });

  const joinEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!profile) throw new Error("No profile found");

      const { error } = await supabase
        .from("event_participants")
        .insert({
          event_id: eventId,
          user_id: profile.user_id,
        });

      if (error) throw error;
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ["game-events"] });
      const event = events.find((e) => e.id === eventId);
      toast({
        title: "Joined Event",
        description: `You've successfully joined ${event?.title}!`,
      });
      if (addActivity) {
        addActivity({
          type: "event_joined",
          message: `Joined event: ${event?.title}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Join",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setJoiningEventId(null),
  });

  const completeEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!profile) throw new Error("No profile found");

      const event = events.find((e) => e.id === eventId);
      if (!event) throw new Error("Event not found");

      const { error: updateError } = await supabase
        .from("event_participants")
        .update({ 
          performance_score: 100,
          rewards_claimed: true 
        })
        .eq("event_id", eventId)
        .eq("user_id", profile.user_id);

      if (updateError) throw updateError;

      // Award rewards
      if (event.rewards && updateProfile) {
        const updates: Record<string, unknown> = {};
        if (typeof event.rewards === "object" && "xp" in event.rewards) {
          updates.experience = (event.rewards as any).xp;
        }
        if (Object.keys(updates).length > 0) {
          await updateProfile(updates);
        }
      }
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ["game-events"] });
      const event = events.find((e) => e.id === eventId);
      toast({
        title: "Event Completed!",
        description: `You've completed ${event?.title} and claimed your rewards!`,
      });
      if (addActivity) {
        addActivity({
          type: "event_completed",
          message: `Completed event: ${event?.title}`,
          earnings: (event?.rewards as any)?.xp || 0,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Complete",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setCompletingEventId(null),
  });

  return {
    events,
    loading: isLoading,
    refreshing: false,
    error: error?.message || null,
    joinEvent: async (eventId: string) => {
      setJoiningEventId(eventId);
      await joinEventMutation.mutateAsync(eventId);
    },
    completeEvent: async (eventId: string) => {
      setCompletingEventId(eventId);
      await completeEventMutation.mutateAsync(eventId);
    },
    refresh: async () => {
      await refetch();
    },
    joiningEventId,
    completingEventId,
  };
};
