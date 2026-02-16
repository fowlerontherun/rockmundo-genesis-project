import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";
import { createScheduledActivity } from "./useActivityBooking";

export interface FestivalTicket {
  id: string;
  festival_id: string;
  user_id: string;
  ticket_type: "day" | "weekend";
  purchase_price: number;
  day_number: number | null;
  purchased_at: string;
  refunded: boolean;
}

export const useFestivalTickets = (festivalId: string | undefined) => {
  const { user } = useAuth();

  const { data: tickets = [], isLoading } = useQuery<FestivalTicket[]>({
    queryKey: ["festival-tickets", festivalId, user?.id],
    queryFn: async () => {
      if (!festivalId || !user?.id) return [];
      const { data, error } = await (supabase as any)
        .from("festival_tickets")
        .select("*")
        .eq("festival_id", festivalId)
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!festivalId && !!user?.id,
  });

  const queryClient = useQueryClient();

  const purchaseTicket = useMutation({
    mutationFn: async ({
      festivalId,
      ticketType,
      price,
      dayNumber,
      festivalTitle,
      festivalStart,
      festivalEnd,
    }: {
      festivalId: string;
      ticketType: "day" | "weekend";
      price: number;
      dayNumber?: number;
      festivalTitle: string;
      festivalStart: string;
      festivalEnd: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Deduct cash from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();

      if (!profile || profile.cash < price) {
        throw new Error("Not enough cash to purchase ticket");
      }

      await supabase
        .from("profiles")
        .update({ cash: profile.cash - price })
        .eq("user_id", user.id);

      // Create ticket
      const { data, error } = await (supabase as any)
        .from("festival_tickets")
        .insert({
          festival_id: festivalId,
          user_id: user.id,
          ticket_type: ticketType,
          purchase_price: price,
          day_number: dayNumber || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Block schedule for festival duration
      try {
        await createScheduledActivity({
          userId: user.id,
          activityType: "festival_attendance",
          scheduledStart: new Date(festivalStart),
          scheduledEnd: new Date(festivalEnd),
          title: `Attending: ${festivalTitle}`,
          description: `Festival ticket (${ticketType})`,
          metadata: { festival_id: festivalId, ticket_type: ticketType },
        });
      } catch (scheduleError) {
        console.warn("Could not block schedule for festival:", scheduleError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Ticket purchased! Your schedule has been blocked.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const hasTicket = tickets.length > 0;
  const hasWeekendPass = tickets.some((t) => t.ticket_type === "weekend");

  return {
    tickets,
    isLoading,
    purchaseTicket,
    hasTicket,
    hasWeekendPass,
  };
};
