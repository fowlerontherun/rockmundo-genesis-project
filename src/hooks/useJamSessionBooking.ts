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

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

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

    setIsBooking(true);

    try {
      // Calculate scheduled times
      const slot = REHEARSAL_SLOTS.find(s => s.id === params.slotId);
      if (!slot) throw new Error("Invalid slot selected");

      const { start: scheduledStart, end: slotEnd } = getSlotTimeRange(slot, params.selectedDate);
      const scheduledEnd = new Date(scheduledStart.getTime() + params.durationHours * 60 * 60 * 1000);

      // Cost per participant estimate (will be recalculated as people join)
      const costPerParticipant = Math.ceil(params.totalCost / params.maxParticipants);

      // Check if user can afford it
      if ((profile.cash || 0) < params.totalCost) {
        throw new Error("Insufficient funds to book this session");
      }

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

      return session.id;
    } finally {
      setIsBooking(false);
    }
  };

  const joinJamSession = async (sessionId: string): Promise<void> => {
    if (!profile) throw new Error("Profile not found");

    // Get session details
    const { data: session } = await supabase
      .from("jam_sessions")
      .select("*, current_participants:jam_session_participants(count)")
      .eq("id", sessionId)
      .single();

    if (!session) throw new Error("Session not found");
    if (session.status !== "waiting") throw new Error("Session is not accepting participants");

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
  };

  const leaveJamSession = async (sessionId: string): Promise<void> => {
    if (!profile) throw new Error("Profile not found");

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
