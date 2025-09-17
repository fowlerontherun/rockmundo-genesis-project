import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type { PlayerProfile, ActivityItem } from "@/hooks/useGameData";

export type GameEvent = Tables<'game_events'>;
export type EventParticipant = Tables<'event_participants'>;

export type GameEventWithStatus = GameEvent & {
  participants: EventParticipant[];
  participantCount: number;
  isUserParticipant: boolean;
  isUserRewardClaimed: boolean;
  availableSlots: number | null;
};

type UseGameEventsOptions = {
  profile: PlayerProfile | null;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | null | undefined>;
  addActivity: (activityType: string, message: string, earnings?: number) => Promise<ActivityItem | null | undefined>;
};

type RewardSummary = {
  updates: Partial<PlayerProfile>;
  messageDetails: string[];
  cashDelta: number;
};

type RawRecord = Record<string, unknown>;

const rewardableFields: (keyof PlayerProfile)[] = [
  "cash",
  "experience",
  "fame",
  "fans",
  "followers",
  "engagement_rate",
  "health"
];

const formatKey = (key: string) => key.replace(/_/g, " ");

const parseRewardPayload = (rewards: unknown, profile: PlayerProfile | null): RewardSummary => {
  const updates: Partial<PlayerProfile> = {};
  const messageDetails: string[] = [];
  let cashDelta = 0;

  if (!rewards || typeof rewards !== "object" || Array.isArray(rewards)) {
    return { updates, messageDetails, cashDelta };
  }

  const rewardsRecord = rewards as RawRecord;

  rewardableFields.forEach(field => {
    const value = rewardsRecord[field as string];
    const numericValue = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numericValue) || numericValue === 0) {
      return;
    }

    const currentValue = profile?.[field];
    const baseValue = typeof currentValue === "number" ? currentValue : 0;
    const nextValue = baseValue + numericValue;

    updates[field] = nextValue as PlayerProfile[typeof field];
    messageDetails.push(`${formatKey(field as string)} ${numericValue > 0 ? "+" : ""}${numericValue}`);

    if (field === "cash") {
      cashDelta += numericValue;
    }
  });

  return { updates, messageDetails, cashDelta };
};

const meetsRequirements = (requirements: unknown, profile: PlayerProfile | null) => {
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) {
    return true;
  }

  if (!profile) {
    return false;
  }

  const requirementEntries = Object.entries(requirements as RawRecord);
  const profileRecord = profile as unknown as RawRecord;

  return requirementEntries.every(([key, value]) => {
    const numericValue = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numericValue)) {
      return true;
    }

    const current = profileRecord[key];

    if (typeof current === "number") {
      return current >= numericValue;
    }

    return true;
  });
};

const mapEventResponse = (
  events: (GameEvent & { event_participants: EventParticipant[] | null })[],
  userId: string | undefined
): GameEventWithStatus[] =>
  events.map(event => {
    const participants = event.event_participants ?? [];
    const participantCount = participants.length;
    const participant = userId
      ? participants.find(entry => entry.user_id === userId)
      : undefined;

    const availableSlots = typeof event.max_participants === "number"
      ? Math.max(event.max_participants - participantCount, 0)
      : null;

    return {
      ...event,
      participants,
      participantCount,
      isUserParticipant: Boolean(participant),
      isUserRewardClaimed: Boolean(participant?.rewards_claimed),
      availableSlots
    };
  });

export const useGameEvents = (options?: Partial<UseGameEventsOptions>) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<GameEventWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [completingEventId, setCompletingEventId] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (showInitialLoader: boolean = false) => {
      try {
        if (showInitialLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const { data, error: fetchError } = await supabase
          .from('game_events')
          .select('*, event_participants(*)')
          .order('start_date', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        const mapped = mapEventResponse((data ?? []) as (GameEvent & { event_participants: EventParticipant[] | null })[], user?.id);
        setEvents(mapped);
        setError(null);
      } catch (err: unknown) {
        console.error('Error loading game events:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load game events.');
        }
      } finally {
        if (showInitialLoader) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [user?.id]
  );

  useEffect(() => {
    let isMounted = true;

    void fetchEvents(true);

    const channel = supabase.channel('game-events-feed');

    channel.on('postgres_changes', { schema: 'public', table: 'game_events' }, () => {
      if (!isMounted) {
        return;
      }
      void fetchEvents();
    });

    channel.on('postgres_changes', { schema: 'public', table: 'event_participants' }, () => {
      if (!isMounted) {
        return;
      }
      void fetchEvents();
    });

    void channel.subscribe();

    return () => {
      isMounted = false;
      void channel.unsubscribe();
    };
  }, [fetchEvents]);

  const syncParticipantCount = useCallback(async (eventId: string) => {
    const { count, error: countError } = await supabase
      .from('event_participants')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (countError) {
      throw countError;
    }

    const { error: updateError } = await supabase
      .from('game_events')
      .update({ current_participants: count ?? 0 })
      .eq('id', eventId);

    if (updateError) {
      throw updateError;
    }
  }, []);

  const joinEvent = useCallback(
    async (eventId: string) => {
      if (!user) {
        throw new Error('You must be signed in to join an event.');
      }

      const targetEvent = events.find(event => event.id === eventId);

      if (!targetEvent) {
        throw new Error('Event not found.');
      }

      if (!targetEvent.is_active) {
        throw new Error('This event is not currently active.');
      }

      if (targetEvent.isUserParticipant) {
        throw new Error('You have already joined this event.');
      }

      if (typeof targetEvent.max_participants === 'number' && targetEvent.participantCount >= targetEvent.max_participants) {
        throw new Error('This event has reached its participant limit.');
      }

      if (!meetsRequirements(targetEvent.requirements, options?.profile ?? null)) {
        throw new Error('You do not meet the requirements for this event.');
      }

      try {
        setJoiningEventId(eventId);

        const { error: insertError } = await supabase
          .from('event_participants')
          .insert({
            event_id: eventId,
            user_id: user.id
          });

        if (insertError) {
          if ('code' in insertError && insertError.code === '23505') {
            throw new Error('You are already registered for this event.');
          }
          throw insertError;
        }

        await syncParticipantCount(eventId);
        await fetchEvents();

        if (options?.addActivity) {
          await options.addActivity('event', `Joined event: ${targetEvent.title}`, 0);
        }
      } finally {
        setJoiningEventId(null);
      }
    },
    [events, fetchEvents, options, syncParticipantCount, user]
  );

  const completeEvent = useCallback(
    async (eventId: string) => {
      if (!user) {
        throw new Error('You must be signed in to complete an event.');
      }

      const targetEvent = events.find(event => event.id === eventId);

      if (!targetEvent) {
        throw new Error('Event not found.');
      }

      const participant = targetEvent.participants.find(entry => entry.user_id === user.id);

      if (!participant) {
        throw new Error('You need to join the event before completing it.');
      }

      if (participant.rewards_claimed) {
        throw new Error('You have already claimed rewards for this event.');
      }

      try {
        setCompletingEventId(eventId);

        const { error: updateError } = await supabase
          .from('event_participants')
          .update({ rewards_claimed: true })
          .eq('id', participant.id);

        if (updateError) {
          throw updateError;
        }

        if (options?.updateProfile && options?.addActivity) {
          const { updates, messageDetails, cashDelta } = parseRewardPayload(targetEvent.rewards, options.profile ?? null);

          if (Object.keys(updates).length > 0) {
            await options.updateProfile(updates);
          }

          const rewardMessage = messageDetails.length
            ? `Completed event: ${targetEvent.title} - Rewards: ${messageDetails.join(', ')}`
            : `Completed event: ${targetEvent.title}`;

          await options.addActivity('event', rewardMessage, cashDelta);
        }

        await fetchEvents();
      } finally {
        setCompletingEventId(null);
      }
    },
    [events, fetchEvents, options, user]
  );

  return {
    events,
    loading,
    refreshing,
    error,
    joinEvent,
    completeEvent,
    refresh: fetchEvents,
    joiningEventId,
    completingEventId
  };
};
