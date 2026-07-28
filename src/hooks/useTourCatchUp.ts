import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { catchUpToTour } from "@/lib/api/tourCatchUp";

interface CatchUpInput {
  tourId: string;
  profileId: string;
}

const getCatchUpErrorMessage = (message: string): string => {
  if (message.includes("tour_catch_up_forbidden")) {
    return "You cannot arrange catch-up travel for this character.";
  }
  if (message.includes("tour_catch_up_not_found")) {
    return "This tour could not be found.";
  }
  if (message.includes("tour_catch_up_no_destination")) {
    return "There are no upcoming tour stops to catch up to.";
  }
  if (message.includes("tour_catch_up_insufficient_funds")) {
    return "You need £1,500 to charter a catch-up flight.";
  }
  if (message.includes("tour_catch_up_profile_busy")) {
    return "This character is already travelling or unavailable.";
  }
  return "The catch-up flight could not be arranged. No money was charged.";
};

export const useTourCatchUp = () => {
  const queryClient = useQueryClient();

  const catchUp = useMutation({
    mutationFn: ({ tourId, profileId }: CatchUpInput) =>
      catchUpToTour(tourId, profileId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["travel-status"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] });
      queryClient.invalidateQueries({ queryKey: ["travel-plans"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });

      if (result.already_in_city) {
        toast.info("You are already in the correct city for the tour.");
        return;
      }

      if (result.already_booked) {
        toast.info("This catch-up flight was already arranged.");
        return;
      }

      toast.success("Catch-up flight chartered for £1,500. Arrival is in two hours.");
    },
    onError: (error: Error) => {
      toast.error(getCatchUpErrorMessage(error.message));
    },
  });

  return { catchUp };
};

export { getCatchUpErrorMessage };
