import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { REHEARSAL_SLOTS, getSlotTimeRange } from "@/utils/facilitySlots";

export interface BookJamSessionParams {
  name: string;
  description?: string;
  genre: string;
  tempo: number;
  maxParticipants: number;
  skillRequirement: number;
  isPrivate: boolean;
  accessCode?: string;
  rehearsalRoomId: string;
  cityId: string;
  selectedDate: Date;
  slotId: string;
  durationHours: number;
  totalCost: number;
}

export const useJamSessionBooking = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBooking, setIsBooking] = useState(false);

  // Fetch user profile with current city
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash, current_city_id, user_id")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if user has conflicting activities during a time range
  const checkActivityConflict = async (
    userId: string,
    startTime: Date,
    endTime: Date
  ): Promise<{ hasConflict: boolean; conflictTitle?: string }> => {
    const { data: conflicts } = await supabase
      .from("player_scheduled_activities")
      .select("title")
      .eq("user_id", userId)
      .in("status", ["scheduled", "in_progress"])
      .lte("scheduled_start", endTime.toISOString())
      .gte("scheduled_end", startTime.toISOString())
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      return { hasConflict: true, conflictTitle: conflicts[0].title };
    }
    return { hasConflict: false };
  };

  // Check if user is already in an active/waiting jam session
  const checkExistingJamParticipation = async (profileId: string): Promise<boolean> => {
    const { data: existing } = await supabase
      .from("jam_session_participants")
      .select("jam_session_id, jam_sessions!inner(status)")
      .eq("profile_id", profileId)
      .is("left_at", null);

    // Filter to only waiting/active sessions
    const activeParticipations = (existing || []).filter((p: any) => 
      p.jam_sessions?.status === "waiting" || p.jam_sessions?.status === "active"
    );

    return activeParticipations.length > 0;
  };

  // Create scheduled activity for jam session
  const createScheduledActivity = async (
    userId: string,
    profileId: string,
    sessionId: string,
    sessionName: string,
    scheduledStart: Date,
    scheduledEnd: Date,
    cityName?: string
  ) => {
    await (supabase as any).from("player_scheduled_activities").insert({
      user_id: userId,
      profile_id: profileId,
      activity_type: "jam_session",
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      duration_minutes: Math.round((scheduledEnd.getTime() - scheduledStart.getTime()) / 60000),
      status: "scheduled",
      title: `Jam Session: ${sessionName}`,
      location: cityName || "Rehearsal Room",
      linked_jam_session_id: sessionId,
      metadata: { jam_session_id: sessionId },
    });
  };

  // Check jam session availability for a room and date
  const checkAvailability = async (roomId: string, date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingJams } = await supabase
      .from("jam_sessions")
      .select("id, scheduled_start, scheduled_end")
      .eq("rehearsal_room_id", roomId)
      .gte("scheduled_start", startOfDay.toISOString())
      .lte("scheduled_start", endOfDay.toISOString())
      .neq("status", "completed");

    return existingJams || [];
  };

  const bookJamSession = async (params: BookJamSessionParams): Promise<string> => {
    if (!profile) throw new Error("Profile not found");
    if (!user) throw new Error("User not found");

    setIsBooking(true);

    try {
      // Calculate scheduled times
      const slot = REHEARSAL_SLOTS.find(s => s.id === params.slotId);
      if (!slot) throw new Error("Invalid slot selected");

      const { start: scheduledStart } = getSlotTimeRange(slot, params.selectedDate);
      const scheduledEnd = new Date(scheduledStart.getTime() + params.durationHours * 60 * 60 * 1000);

      // Check for activity conflicts
      const { hasConflict, conflictTitle } = await checkActivityConflict(
        user.id,
        scheduledStart,
        scheduledEnd
      );
      if (hasConflict) {
        throw new Error(`You have a scheduling conflict with "${conflictTitle}". Cancel that activity first.`);
      }

      // Check if already in a jam session
      const alreadyInJam = await checkExistingJamParticipation(profile.id);
      if (alreadyInJam) {
        throw new Error("You're already participating in another jam session. Leave that session first.");
      }

      // Cost per participant estimate (will be recalculated as people join)
      const costPerParticipant = Math.ceil(params.totalCost / params.maxParticipants);

      // Check if user can afford it
      if ((profile.cash || 0) < params.totalCost) {
        throw new Error("Insufficient funds to book this session");
      }

      // Get city name for the activity
      const { data: cityData } = await supabase
        .from("cities")
        .select("name")
        .eq("id", params.cityId)
        .maybeSingle();

      // Create the jam session with venue booking
      const { data: session, error: sessionError } = await supabase
        .from("jam_sessions")
        .insert({
          host_id: profile.id,
          name: params.name.trim(),
          description: params.description?.trim() || null,
          genre: params.genre,
          tempo: params.tempo,
          max_participants: params.maxParticipants,
          skill_requirement: params.skillRequirement,
          is_private: params.isPrivate,
          access_code: params.isPrivate ? params.accessCode?.trim() : null,
          status: "waiting",
          rehearsal_room_id: params.rehearsalRoomId,
          city_id: params.cityId,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          duration_hours: params.durationHours,
          total_cost: params.totalCost,
          creator_profile_id: profile.id,
          cost_per_participant: costPerParticipant,
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;

      // Deduct cost from creator's profile
      await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) - params.totalCost })
        .eq("id", profile.id);

      // Add creator as first participant
      await supabase
        .from("jam_session_participants")
        .insert({
          jam_session_id: session.id,
          profile_id: profile.id,
          cost_paid: params.totalCost,
          joined_at: new Date().toISOString(),
        });

      // Create scheduled activity for the creator
      await createScheduledActivity(
        user.id,
        profile.id,
        session.id,
        params.name,
        scheduledStart,
        scheduledEnd,
        cityData?.name
      );

      // Add system message to chat
      await supabase
        .from("jam_session_chat")
        .insert({
          session_id: session.id,
          profile_id: profile.id,
          message: `Session "${params.name}" created! Waiting for musicians to join...`,
          message_type: "system",
        });

      toast({
        title: "Jam Session Booked!",
        description: `${params.name} scheduled for ${scheduledStart.toLocaleString()}`,
      });

      queryClient.invalidateQueries({ queryKey: ["jam-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });

      return session.id;
    } finally {
      setIsBooking(false);
    }
  };

  const joinJamSession = async (sessionId: string): Promise<void> => {
    if (!profile) throw new Error("Profile not found");
    if (!user) throw new Error("User not found");

    // Get session details with city info
    const { data: session } = await supabase
      .from("jam_sessions")
      .select("*, current_participants:jam_session_participants(count), city:cities(id, name)")
      .eq("id", sessionId)
      .single();

    if (!session) throw new Error("Session not found");
    if (session.status !== "waiting") throw new Error("Session is not accepting participants");

    // Check if user is in the same city as the session
    if (session.city_id && profile.current_city_id !== session.city_id) {
      const cityName = (session.city as any)?.name || "the session city";
      throw new Error(`You must be in ${cityName} to join this jam session. Travel there first!`);
    }

    // Check for activity conflicts during the session time
    if (session.scheduled_start && session.scheduled_end) {
      const { hasConflict, conflictTitle } = await checkActivityConflict(
        user.id,
        new Date(session.scheduled_start),
        new Date(session.scheduled_end)
      );
      if (hasConflict) {
        throw new Error(`You have a scheduling conflict with "${conflictTitle}". Cancel that activity first.`);
      }
    }

    // Check if already in a jam session
    const alreadyInJam = await checkExistingJamParticipation(profile.id);
    if (alreadyInJam) {
      throw new Error("You're already participating in another jam session. Leave that session first.");
    }

    // Calculate new cost per person
    const currentCount = session.current_participants?.[0]?.count || 1;
    const newCount = currentCount + 1;
    const newCostPerPerson = Math.ceil(session.total_cost / Math.min(newCount + 1, session.max_participants));

    // Check if user can afford their share
    if ((profile.cash || 0) < newCostPerPerson) {
      throw new Error("Insufficient funds to join this session");
    }

    // Add as participant
    await supabase
      .from("jam_session_participants")
      .insert({
        jam_session_id: sessionId,
        profile_id: profile.id,
        cost_paid: newCostPerPerson,
        joined_at: new Date().toISOString(),
      });

    // Deduct cost
    await supabase
      .from("profiles")
      .update({ cash: (profile.cash || 0) - newCostPerPerson })
      .eq("id", profile.id);

    // Update session cost per participant
    await supabase
      .from("jam_sessions")
      .update({ cost_per_participant: newCostPerPerson })
      .eq("id", sessionId);

    // Create scheduled activity for the joiner
    if (session.scheduled_start && session.scheduled_end) {
      await createScheduledActivity(
        user.id,
        profile.id,
        sessionId,
        session.name,
        new Date(session.scheduled_start),
        new Date(session.scheduled_end),
        (session.city as any)?.name
      );
    }

    // Add join message to chat
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", profile.id)
      .single();

    await supabase
      .from("jam_session_chat")
      .insert({
        session_id: sessionId,
        profile_id: profile.id,
        message: `${profileData?.display_name || profileData?.username || 'A musician'} joined the session!`,
        message_type: "join",
      });

    toast({ title: "Joined session!" });
    queryClient.invalidateQueries({ queryKey: ["jam-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
  };

  const leaveJamSession = async (sessionId: string): Promise<void> => {
    if (!profile) throw new Error("Profile not found");
    if (!user) throw new Error("User not found");

    // Get session details
    const { data: session } = await supabase
      .from("jam_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) throw new Error("Session not found");

    const now = new Date();
    const scheduledEnd = session.scheduled_end ? new Date(session.scheduled_end) : null;
    const startedAt = session.started_at ? new Date(session.started_at) : null;

    // Calculate penalty if session is active
    let rewardMultiplier = 1.0;
    if (session.status === "active" && scheduledEnd && startedAt) {
      const totalDuration = scheduledEnd.getTime() - startedAt.getTime();
      const elapsed = now.getTime() - startedAt.getTime();
      const percentageLeft = ((totalDuration - elapsed) / totalDuration) * 100;

      if (percentageLeft > 75) rewardMultiplier = 0.10;
      else if (percentageLeft > 50) rewardMultiplier = 0.25;
      else if (percentageLeft > 25) rewardMultiplier = 0.50;
      else if (percentageLeft > 10) rewardMultiplier = 0.75;
    }

    // Update participant record
    await supabase
      .from("jam_session_participants")
      .update({
        left_at: now.toISOString(),
        participation_percentage: Math.floor((1 - rewardMultiplier) * 100) || 100,
        reward_multiplier: rewardMultiplier,
      })
      .eq("jam_session_id", sessionId)
      .eq("profile_id", profile.id);

    // Cancel the scheduled activity
    await (supabase as any)
      .from("player_scheduled_activities")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("linked_jam_session_id", sessionId);

    // Add leave message
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", profile.id)
      .single();

    await supabase
      .from("jam_session_chat")
      .insert({
        session_id: sessionId,
        profile_id: profile.id,
        message: `${profileData?.display_name || profileData?.username || 'A musician'} left the session${rewardMultiplier < 1 ? ' (early leave penalty applied)' : ''}.`,
        message_type: "leave",
      });

    toast({
      title: "Left session",
      description: rewardMultiplier < 1 ? `Early leave penalty applied (${Math.floor(rewardMultiplier * 100)}% rewards)` : undefined,
      variant: rewardMultiplier < 1 ? "destructive" : "default",
    });

    queryClient.invalidateQueries({ queryKey: ["jam-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
  };

  return {
    profile,
    isBooking,
    bookJamSession,
    joinJamSession,
    leaveJamSession,
    checkAvailability,
  };
};
