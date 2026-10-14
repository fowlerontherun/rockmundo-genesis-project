import { createElement, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
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
import type { BandPaymentSource } from "@/hooks/useBandPaymentSource";
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
  paymentSource?: BandPaymentSource;
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
  const { profileId: activeProfileId } = useActiveProfile();
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

      // Build a stable key from the complete, character-scoped booking intent.
      // Identical retries reuse it; changed songs, setlists or payers never do.
      const paymentSource: BandPaymentSource = params.paymentSource ?? "band";
      const actingProfileId = activeProfileId ?? params.profileId;
      if (!actingProfileId) throw new Error("Choose an active character to book.");
      if (params.profileId && params.profileId !== actingProfileId) {
        throw new Error("Active character changed. Reopen the booking form.");
      }
      const idempotencyKey = JSON.stringify([
        "rehearsal:v2",
        actingProfileId,
        params.bandId,
        params.roomId,
        params.scheduledStart.toISOString(),
        params.duration,
        params.songId ?? null,
        params.setlistId ?? null,
        paymentSource,
      ]);

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

      // The booking RPC committed payment already. Projection repair must
      // never turn a paid booking into a failure or cause a second charge.
      const repairSchedule = async () => {
        const hasProjection = await hasScheduledBookingProjection(
          "linked_rehearsal_id", booking.bookingId,
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
      };

      let projectionFailed = false;
      try {
        await repairSchedule();
      } catch (projectionError) {
        projectionFailed = true;
        console.error("[rehearsals] Booking paid and committed; calendar projection needs repair:", {
          bookingId: booking.bookingId, projectionError,
        });
      }

      if (!booking.idempotent) {
        try {
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
        } catch (postCommitError) {
          console.warn("[rehearsals] Noncritical post-booking notification failed:", postCommitError);
        }
      }

      if (projectionFailed) {
        toast({
          title: "Rehearsal booked — schedule needs refreshing",
          description: "Payment and booking succeeded. Use Retry schedule to restore missing calendar entries without paying again.",
          action: createElement(ToastAction, {
            altText: "Retry rehearsal schedule",
            onClick: () => {
              void repairSchedule().then(() => {
                void queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
                toast({ title: "Schedule updated", description: "Your rehearsal is now on the calendar." });
              }).catch((repairError) => {
                console.error("[rehearsals] Calendar repair retry failed:", repairError);
                toast({ title: "Schedule still needs attention", description: "Booking and payment are safe. Try syncing the calendar again.", variant: "destructive" });
              });
            },
          }, "Retry schedule") as ToastActionElement,
        });
      } else {
        toast({
          title: excludedConflicts.length > 0
            ? "Rehearsal booked without some members" : "Rehearsal Booked!",
          description: excludedConflicts.length > 0
            ? `${params.duration}-hour rehearsal at ${params.roomName}. ${excludedConflicts.length} member(s) were notified they are not booked in.`
            : `${params.duration}-hour rehearsal scheduled at ${params.roomName} using ${booking.paymentSource} funds.`,
        });
      }

      // Cache invalidation is not part of booking settlement.
      void Promise.allSettled([
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
