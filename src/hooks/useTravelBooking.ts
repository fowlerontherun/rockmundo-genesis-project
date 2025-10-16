import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookTravel, TravelBookingData } from "@/utils/travelSystem";
import { toast } from "@/hooks/use-toast";

export function useTravelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingData: TravelBookingData) => bookTravel(bookingData),
    onSuccess: (data) => {
      toast({
        title: "Travel Complete!",
        description: data.message,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["travel-history"] });
      queryClient.invalidateQueries({ queryKey: ["current-location"] });
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Travel Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
