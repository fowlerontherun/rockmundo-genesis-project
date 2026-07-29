import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  regenerateTourTravelLegs,
  syncTourMemberTravel,
} from "@/lib/api/tourTravel";

const describeRepairError = (error: Error): string => {
  if (error.message.includes("tour_travel_repair_forbidden")) {
    return "You do not have permission to repair travel for this tour.";
  }
  if (error.message.includes("tour_travel_repair_status_invalid")) {
    return "Completed and cancelled tours cannot be repaired.";
  }
  if (error.message.includes("tour_travel_repair_route_impossible")) {
    return "The current route cannot reach a later show in time. Reschedule the tour before rebuilding travel.";
  }
  if (error.message.includes("tour_travel_repair_not_found")) {
    return "This tour no longer exists.";
  }
  return "Tour travel could not be repaired. No partial travel changes were applied.";
};

const describeMemberSyncError = (error: Error): string => {
  if (error.message.includes("tour_member_travel_forbidden")) {
    return "You do not have permission to add member travel for this tour.";
  }
  if (error.message.includes("tour_member_travel_status_invalid")) {
    return "Completed and cancelled tours cannot receive new member travel.";
  }
  if (error.message.includes("tour_member_travel_not_found")) {
    return "This tour no longer exists.";
  }
  return "Member travel could not be synchronised. No partial bookings were created.";
};

export const useTourTravelRepair = () => {
  const queryClient = useQueryClient();

  const invalidateTravelState = () => {
    queryClient.invalidateQueries({ queryKey: ["my-tours"] });
    queryClient.invalidateQueries({ queryKey: ["tour-travel-legs"] });
    queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
    queryClient.invalidateQueries({ queryKey: ["travel-status"] });
    queryClient.invalidateQueries({ queryKey: ["travel-plans"] });
    queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] });
  };

  const regenerateTravelLegs = useMutation({
    mutationFn: (tourId: string) => regenerateTourTravelLegs(tourId),
    onSuccess: (result) => {
      invalidateTravelState();
      if (result.already_repaired || result.created === 0) {
        toast.info(
          result.existing > 0
            ? `${result.existing} tour travel legs already exist.`
            : "No missing tour travel legs were found.",
        );
        return;
      }
      toast.success(`Rebuilt ${result.created} tour travel legs safely.`);
    },
    onError: (error: Error) => toast.error(describeRepairError(error)),
  });

  const syncMemberTravel = useMutation({
    mutationFn: (tourId: string) => syncTourMemberTravel(tourId),
    onSuccess: (result) => {
      invalidateTravelState();
      if (result.created > 0) {
        toast.success(
          `Booked ${result.created} remaining travel legs for active band members.`,
        );
        return;
      }
      toast.info(`No new travel bookings were needed for ${result.tour_name}.`);
    },
    onError: (error: Error) => toast.error(describeMemberSyncError(error)),
  });

  return {
    regenerateTravelLegs,
    syncMemberTravel,
  };
};
