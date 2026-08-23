import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  checkTimeSlotAvailable,
  createScheduledActivity,
} from "@/hooks/useActivityBooking";
import {
  BandUnavailableError,
  checkBandAvailability,
  createBandScheduledActivities,
  notifyAbsentBandMembers,
} from "@/utils/bandActivityScheduling";
import {
  confirmRecordingSessionAtomic,
  hasScheduledBookingProjection,
  insertBookingInboxMessages,
  type BookingInboxMessage,
} from "@/services/finance/atomicBookingClient";

// Keep every existing recording export available. This module only replaces the
// create-session mutation so the large recording UI can move to server-authority
// without a broad rewrite.
export * from "./useRecordingData";

interface CreateRecordingSessionInput {
  user_id: string;
  profile_id?: string | null;
  band_id?: string;
  studio_id: string;
  producer_id: string;
  song_id: string;
  duration_hours: number;
  orchestra_size?: "chamber" | "small" | "full";
  recording_version?: "standard" | "remix" | "acoustic";
  recording_type?: "demo" | "professional";
  rehearsal_bonus?: number;
  session_type?: string;
  parent_recording_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  payment_source?: "band" | "personal";
  skip_profile_ids?: string[];
}

const readableRecordingError = (message: string) => {
  if (message.includes("insufficient_band_funds")) {
    return "The band treasury does not have enough available funds for this recording session.";
  }
  if (message.includes("insufficient_personal_funds")) {
    return "You do not have enough personal funds for this recording session.";
  }
  if (message.includes("band_treasury_missing")) {
    return "The band treasury is not ready yet. Open Band Finances and try again.";
  }
  if (message.includes("recording_studio_unavailable")) {
    return "That studio has just been booked for this time. Choose another slot.";
  }
  if (message.includes("band_unavailable")) {
    return "The band already has a rehearsal or recording during this time.";
  }
  if (message.includes("recording_must_be_in_future")) {
    return "Recording sessions must be booked for a future time.";
  }
  if (message.includes("producer_not_available")) {
    return "That producer is no longer available. Choose another producer.";
  }
  if (message.includes("not_band_member")) {
    return "Only an active member of this band can book its recording session.";
  }
  return message || "Unable to book the recording session.";
};

const unknownErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
};

export const useCreateRecordingSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRecordingSessionInput) => {
      let stage = "starting the booking";

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const scheduledStart = input.scheduled_start
          ? new Date(input.scheduled_start)
          : new Date(Date.now() + 60_000);
        const scheduledEnd = input.scheduled_end
          ? new Date(input.scheduled_end)
          : new Date(
              scheduledStart.getTime() + input.duration_hours * 60 * 60 * 1000,
            );

        let excludedConflicts: Awaited<
          ReturnType<typeof checkBandAvailability>
        >["conflicts"] = [];

        stage = "checking band availability";
        if (input.band_id) {
          const { available, conflicts } = await checkBandAvailability(
            input.band_id,
            scheduledStart,
            scheduledEnd,
          );

          const skipSet = new Set(
            Array.isArray(input.skip_profile_ids) ? input.skip_profile_ids : [],
          );
          const blockingConflicts = conflicts.filter(
            (conflict) =>
              !conflict.profileId || !skipSet.has(conflict.profileId),
          );
          excludedConflicts = conflicts.filter(
            (conflict) =>
              !!conflict.profileId && skipSet.has(conflict.profileId),
          );

          if (!available && blockingConflicts.length > 0) {
            throw new BandUnavailableError(blockingConflicts);
          }
        } else {
          const { available, conflictingActivity } =
            await checkTimeSlotAvailable(
              user.id,
              scheduledStart,
              scheduledEnd,
            );

          if (!available) {
            const conflictTitle = conflictingActivity?.title
              ? ` “${String(conflictingActivity.title)}”`
              : "";
            throw new Error(
              `You have another activity${conflictTitle} scheduled during this time. Please check your schedule.`,
            );
          }
        }

        const paymentSource = input.band_id
          ? (input.payment_source ?? "band")
          : "personal";
        const idempotencyKey = [
          "recording",
          input.band_id ?? input.profile_id ?? user.id,
          input.studio_id,
          input.song_id,
          scheduledStart.toISOString(),
          input.duration_hours,
        ].join(":");

        stage = "confirming payment and recording session";
        const { data: booking, error } = await confirmRecordingSessionAtomic({
          bandId: input.band_id ?? null,
          studioId: input.studio_id,
          producerId: input.producer_id ?? "self-produce",
          songId: input.song_id,
          durationHours: input.duration_hours,
          // Empty string is the explicit no-orchestra value accepted by the RPC.
          orchestraSize: input.orchestra_size ?? "",
          recordingVersion: input.recording_version ?? "standard",
          recordingType: input.recording_type ?? "professional",
          rehearsalBonus: input.rehearsal_bonus ?? 0,
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd.toISOString(),
          paymentSource,
          idempotencyKey,
        });

        if (error) {
          throw new Error(readableRecordingError(error.message || ""));
        }

        if (!booking?.bookingId) {
          throw new Error(
            "The recording booking authority returned no booking id.",
          );
        }

        const { data: session, error: sessionError } = await supabase
          .from("recording_sessions")
          .select("*")
          .eq("id", booking.bookingId)
          .single();
        if (sessionError || !session) {
          throw new Error(
            sessionError?.message || "The recording session could not be reloaded.",
          );
        }

        const [{ data: studioData }, { data: songData }] = await Promise.all([
          supabase
            .from("city_studios")
            .select("name")
            .eq("id", input.studio_id)
            .single(),
          supabase
            .from("songs")
            .select("title")
            .eq("id", input.song_id)
            .single(),
        ]);
        const studioName = studioData?.name || "Recording Studio";
        const songTitle = songData?.title || "a song";

        stage = "scheduling the session for everyone involved";
        const hasProjection = await hasScheduledBookingProjection(
          "linked_recording_id",
          booking.bookingId,
        );

        if (!hasProjection) {
          if (input.band_id) {
            await createBandScheduledActivities({
              bandId: input.band_id,
              activityType: "recording",
              scheduledStart,
              scheduledEnd,
              title: "Recording Session",
              description: `Recording at ${studioName}`,
              location: studioName,
              linkedRecordingId: booking.bookingId,
              skipProfileIds: input.skip_profile_ids,
              metadata: {
                sessionId: booking.bookingId,
                studioId: input.studio_id,
                songId: input.song_id,
              },
            });
          } else {
            await createScheduledActivity({
              userId: input.user_id,
              activityType: "recording",
              scheduledStart,
              scheduledEnd,
              title: "Recording Session",
              description: `Recording at ${studioName}`,
              location: studioName,
              linkedRecordingId: booking.bookingId,
              metadata: {
                sessionId: booking.bookingId,
                studioId: input.studio_id,
                songId: input.song_id,
              },
            });
          }
        }

        if (!booking.idempotent && input.band_id) {
          if (excludedConflicts.length > 0) {
            await notifyAbsentBandMembers({
              bandId: input.band_id,
              activityType: "recording",
              activityLabel: `Recording Session at ${studioName}`,
              scheduledStart,
              scheduledEnd,
              location: studioName,
              conflicts: excludedConflicts,
              linkedRecordingId: booking.bookingId,
              actionPath: "/recording",
            });
          }

          try {
            const [{ data: bandInfo }, { data: members }] = await Promise.all([
              supabase
                .from("bands")
                .select("name")
                .eq("id", input.band_id)
                .single(),
              supabase
                .from("band_members")
                .select("user_id")
                .eq("band_id", input.band_id)
                .eq("member_status", "active"),
            ]);
            const bandName = bandInfo?.name || "Your band";
            const startLabel = scheduledStart.toLocaleString();
            const memberUserIds = (members ?? [])
              .map((member) => member.user_id)
              .filter(
                (userId): userId is string =>
                  typeof userId === "string" && userId.length > 0,
              );
            const inboxRows: BookingInboxMessage[] = memberUserIds.map(
              (userId) => ({
                user_id: userId,
                category: "system",
                priority: "normal",
                title: `Recording session booked: ${songTitle}`,
                message: `${bandName} has a recording session for "${songTitle}" at ${studioName} starting ${startLabel} (${input.duration_hours}h).`,
                action_type: "view_recording_session",
                action_data: { session_id: booking.bookingId },
                metadata: {
                  source: "recording_booking",
                  session_id: booking.bookingId,
                  band_id: input.band_id,
                  payment_source: booking.paymentSource,
                },
              }),
            );
            await insertBookingInboxMessages(inboxRows);
          } catch (notifyError) {
            console.error(
              "Failed to notify band members of recording booking:",
              notifyError,
            );
          }
        } else if (!booking.idempotent) {
          try {
            await insertBookingInboxMessages([
              {
                user_id: input.user_id,
                category: "system",
                priority: "normal",
                title: `Recording session booked: ${songTitle}`,
                message: `Your recording session for "${songTitle}" at ${studioName} starts ${scheduledStart.toLocaleString()} (${input.duration_hours}h).`,
                action_type: "view_recording_session",
                action_data: { session_id: booking.bookingId },
                metadata: {
                  source: "recording_booking",
                  session_id: booking.bookingId,
                  payment_source: booking.paymentSource,
                },
              },
            ]);
          } catch (notifyError) {
            console.error(
              "Failed to notify artist of recording booking:",
              notifyError,
            );
          }
        }

        return session;
      } catch (bookingError) {
        if (bookingError instanceof BandUnavailableError) throw bookingError;
        console.error(
          `[recording-booking] failed during stage "${stage}"`,
          bookingError,
        );
        throw new Error(`${unknownErrorMessage(bookingError)} (while ${stage})`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recording-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["recorded-songs-list"] });
      queryClient.invalidateQueries({ queryKey: ["band-payment-source-band"] });
      queryClient.invalidateQueries({ queryKey: ["band-payment-source-profile"] });
      toast.success("Recording session booked!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to book recording: ${error.message}`);
    },
  });
};
