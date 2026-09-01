import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { REHEARSAL_SLOTS, getSlotTimeRange } from "@/utils/facilitySlots";
import { validateBookingWindow } from "@/utils/activityBookingTime";

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

const getRpcErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
};

export const useJamSessionBooking = () => {
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBooking, setIsBooking] = useState(false);
  const bookingKeys = useRef(new Map<string, string>());

  const { data: profile } = useQuery({
    queryKey: ["profile-jam", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash, current_city_id, user_id")
        .eq("id", profileId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const invalidateJamState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["jam-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["jam-session-workspace"] }),
      queryClient.invalidateQueries({ queryKey: ["jam-session-outcomes"] }),
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
      queryClient.invalidateQueries({ queryKey: ["profile-jam"] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
    ]);
  };

  const checkAvailability = async (roomId: string, date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("jam_sessions")
      .select("id, scheduled_start, scheduled_end")
      .eq("rehearsal_room_id", roomId)
      .gte("scheduled_start", startOfDay.toISOString())
      .lte("scheduled_start", endOfDay.toISOString())
      .in("status", ["waiting", "active"]);

    if (error) throw error;
    return data || [];
  };

  const bookJamSession = async (params: BookJamSessionParams): Promise<string> => {
    if (!profile) throw new Error("Profile not found");
    if (isBooking) throw new Error("Booking already in progress");

    const slot = REHEARSAL_SLOTS.find((candidate) => candidate.id === params.slotId);
    if (!slot) throw new Error("Invalid slot selected");

    const { start: scheduledStart } = getSlotTimeRange(slot, params.selectedDate);
    const scheduledEnd = new Date(
      scheduledStart.getTime() + params.durationHours * 60 * 60 * 1000,
    );
    const bookingError = validateBookingWindow(scheduledStart, scheduledEnd);
    if (bookingError) throw new Error(bookingError);

    const fingerprint = [
      profile.id,
      params.name.trim(),
      params.rehearsalRoomId,
      scheduledStart.toISOString(),
      params.durationHours,
    ].join(":");
    const idempotencyKey =
      bookingKeys.current.get(fingerprint) ?? globalThis.crypto.randomUUID();
    bookingKeys.current.set(fingerprint, idempotencyKey);

    setIsBooking(true);
    try {
      const { data, error } = await (supabase.rpc as any)("book_jam_session_v2", {
        p_name: params.name.trim(),
        p_description: params.description?.trim() || null,
        p_genre: params.genre,
        p_tempo: params.tempo,
        p_max_participants: params.maxParticipants,
        p_skill_requirement: params.skillRequirement,
        p_is_private: params.isPrivate,
        p_access_code: params.isPrivate ? params.accessCode?.trim() || null : null,
        p_rehearsal_room_id: params.rehearsalRoomId,
        p_scheduled_start: scheduledStart.toISOString(),
        p_duration_hours: params.durationHours,
        p_idempotency_key: idempotencyKey,
        p_band_id: null,
        p_challenge_id: null,
      });

      if (error) throw error;
      const sessionId = data?.session_id ?? data?.id;
      if (!sessionId) throw new Error("Jam session booking did not return a session id");

      bookingKeys.current.delete(fingerprint);
      await invalidateJamState();
      toast({
        title: "Jam Session Booked!",
        description: `${params.name} is reserved for ${scheduledStart.toLocaleString()}.`,
      });
      return String(sessionId);
    } catch (error) {
      throw new Error(getRpcErrorMessage(error, "Unable to book jam session"));
    } finally {
      setIsBooking(false);
    }
  };

  const joinJamSession = async (sessionId: string, accessCode?: string): Promise<void> => {
    const { error } = await (supabase.rpc as any)("join_jam_session", {
      p_session_id: sessionId,
      p_access_code: accessCode?.trim() || null,
    });
    if (error) throw new Error(getRpcErrorMessage(error, "Unable to join jam session"));

    await invalidateJamState();
    toast({
      title: "Joined session!",
      description: "Your schedule and contribution were updated together.",
    });
  };

  const leaveJamSession = async (sessionId: string): Promise<void> => {
    const { error } = await (supabase.rpc as any)("leave_jam_session_v2", {
      p_session_id: sessionId,
    });
    if (error) throw new Error(getRpcErrorMessage(error, "Unable to leave jam session"));

    await invalidateJamState();
    toast({ title: "Left session", description: "Your jam reservation has been released." });
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
