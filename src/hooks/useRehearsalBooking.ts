import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { logGameActivity } from "@/hooks/useGameActivityLog";
import {
  createBandScheduledActivities,
  checkBandAvailability,
  notifyAbsentBandMembers,
  BandUnavailableError,
  isBandUnavailableError,
} from "@/utils/bandActivityScheduling";
import { validateFutureTime } from "@/utils/timeSlotValidation";
import { consumeAtomicRehearsalPaymentSource } from "@/hooks/useBandPaymentSource";
import {
  confirmRehearsalBookingAtomic,
  hasScheduledBookingProjection,
} from "@/services/finance/atomicBookingClient";

interface BookRehearsalParams {
  bandId: string;
  roomId: string;
  duration: number;
  songId: string | null;
  setlistId: string | null;
  scheduledStart: Date;
  // Kept for compatibility with the existing page/dialog contract. The server
  // now recalculates all of these values authoritatively.
  totalCost: number;
  chemistryGain: number;
  xpEarned: number;
  familiarityGained: number;
  roomName: string;
  roomLocation: string;
  profileId?: string;
  bandName?: string;
  /** Members (profile ids) the leader chose to book without. */
  skipProfileIds?: string[];
}

const readableBookingError = (message: string) => {
  if (message.includes("insufficient_band_funds")) {
    return "The band treasury does not have enough available funds for this rehearsal.";
  }
  if (message.includes("insufficient_personal_funds")) {
    return "You do not have enough personal funds for this rehearsal.";
  }
  if (message.includes("band_treasury_missing")) {
    return "The band treasury is not ready yet. Open Band Finances and try again.";
  }
  if (message.includes("rehearsal_room_unavailable")) {
    return "That rehearsal room has just been booked for this time. Choose another slot.";
  }
  if (message.includes("band_unavailable")) {
    return "The band already has a rehearsal or recording during this time.";
  }
  if (message.includes("rehearsal_must_be_in_future")) {
    return "Rehearsals must be booked for a future time.";
  }
  if (message.includes("not_band_member")) {
    return "Only an active member of this band can book its rehearsal.";
  }
  return message || "Unable to book the rehearsal.";
};

export function useRehearsalBooking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBooking, setIsBooking] = useState(false);

  const bookRehearsal = async (params: BookRehearsalParams) => {
    setIsBooking(true);

    try {
      const timeValidation = validateFutureTime(params.scheduledStart);
      if (!timeValidation.valid) {
        throw new Error(timeValidation.message);
      }

      const scheduledEnd = new Date(params.scheduledStart);
      scheduledEnd.setHours(scheduledEnd.getHours() + params.duration);

      // Preserve the broader player-schedule conflict experience in the client.
      // The RPC independently protects room/band booking races and the payment.
      const { available, conflicts } = await checkBandAvailability(
        params.bandId,
        params.scheduledStart,
        scheduledEnd,
      );

      const skipSet = new Set(params.skipProfileIds || []);
      const blockingConflicts = conflicts.filter(
        (conflict) => !conflict.profileId || !skipSet.has(conflict.profileId),
      );
      const excludedConflicts = conflicts.filter(
        (conflict) => conflict.profileId && skipSet.has(conflict.profileId),
      );

      if (!available && blockingConflicts.length > 0) {
        // Do not consume the selected payer yet: the leader may retry from the
        // conflict dialog without reopening the booking form.
        throw new BandUnavailableError(blockingConflicts);
      }

      const paymentSource = consumeAtomicRehearsalPaymentSource(params.bandId);
      const idempotencyKey = [
        "rehearsal",
        params.bandId,
        params.roomId,
        params.scheduledStart.toISOString(),
        params.duration,
      ].join(":");

      const { data: booking, error } = await confirmRehearsalBookingAtomic({
        bandId: params.bandId,
        roomId: params.roomId,
        durationHours: params.duration,
        songId: params.songId,
        setlistId: params.setlistId,
        scheduledStart: params.scheduledStart.toISOString(),
        paymentSource,
        idempotencyKey,
      });

      if (error) {
        throw new Error(readableBookingError(error.message || ""));
      }

      if (!booking?.bookingId) {
        throw new Error("The rehearsal booking authority returned no booking id.");
      }

      // Booking/payment are already committed atomically. Scheduled-activity rows
      // remain a projection, so make this follow-up retry-safe as well.
      const hasProjection = await hasScheduledBookingProjection(
        "linked_rehearsal_id",
        booking.bookingId,
      );

      if (!hasProjection) {
        await createBandScheduledActivities({
          bandId: params.bandId,
          activityType: "rehearsal",
          scheduledStart: params.scheduledStart,
          scheduledEnd,
          title: `Band Rehearsal - ${params.roomName}`,
          location: params.roomLocation,
          linkedRehearsalId: booking.bookingId,
          skipProfileIds: params.skipProfileIds,
          metadata: {
            rehearsalId: booking.bookingId,
            roomId: params.roomId,
            songId: params.songId,
            setlistId: params.setlistId,
          },
        });
      }

      if (!booking.idempotent) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: activeProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .is("died_at", null)
            .maybeSingle();

          if (activeProfile) {
            void logGameActivity({
              userId: activeProfile.id,
              bandId: params.bandId,
              activityType: "rehearsal_booked",
              activityCategory: "rehearsal",
              description: `Booked ${params.duration}-hour rehearsal at ${params.roomName}`,
              amount: -Number(booking.totalCost || 0),
              metadata: {
                rehearsalId: booking.bookingId,
                roomId: params.roomId,
                songId: params.songId,
                setlistId: params.setlistId,
                duration: params.duration,
                paymentSource: booking.paymentSource,
                chemistryGain: booking.chemistryGain,
                xpEarned: booking.xpEarned,
              },
            });
          }
        }

        if (excludedConflicts.length > 0) {
          await notifyAbsentBandMembers({
            bandId: params.bandId,
            bandName: params.bandName ?? null,
            activityType: "rehearsal",
            activityLabel: `Band Rehearsal - ${params.roomName}`,
            scheduledStart: params.scheduledStart,
            scheduledEnd,
            location: params.roomLocation,
            conflicts: excludedConflicts,
            linkedRehearsalId: booking.bookingId,
            actionPath: "/rehearsals",
          });
        }
      }

      toast({
        title:
          excludedConflicts.length > 0
            ? "Rehearsal booked without some members"
            : "Rehearsal Booked!",
        description:
          excludedConflicts.length > 0
            ? `${params.duration}-hour rehearsal at ${params.roomName}. ${excludedConflicts.length} member(s) were notified they are not booked in.`
            : `${params.duration}-hour rehearsal scheduled at ${params.roomName} using ${booking.paymentSource} funds.`,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-rehearsals"] }),
        queryClient.invalidateQueries({ queryKey: ["user-bands"] }),
        queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
        queryClient.invalidateQueries({ queryKey: ["band-payment-source-band", params.bandId] }),
        queryClient.invalidateQueries({ queryKey: ["band-payment-source-profile"] }),
      ]);

      return booking.bookingId;
    } catch (error) {
      console.error("Failed to book rehearsal:", error);
      if (isBandUnavailableError(error)) {
        throw error;
      }
      toast({
        title: "Booking Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsBooking(false);
    }
  };

  return {
    bookRehearsal,
    isBooking,
  };
}
