import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useFestivalSlotApplications = (festivalId?: string, bandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["festival-slot-applications", festivalId, bandId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("festival_slot_applications")
        .select(`
          *,
          festival:festivals(id, name, start_date, end_date),
          band:bands(id, name, genre, fame),
          setlist:setlists(id, name)
        `)
        .order("created_at", { ascending: false });

      if (festivalId) query = query.eq("festival_id", festivalId);
      if (bandId) query = query.eq("band_id", bandId);

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!festivalId || !!bandId,
  });

  const applyForSlotMutation = useMutation({
    mutationFn: async (applicationData: {
      festival_id: string;
      band_id: string;
      applied_by_user_id: string;
      slot_type: string;
      preferred_date?: string;
      setlist_id?: string;
      application_message?: string;
    }) => {
      const { error } = await (supabase as any)
        .from("festival_slot_applications")
        .insert(applicationData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-slot-applications"] });
      toast({
        title: "Application submitted!",
        description: "Your festival slot application has been sent for review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Application failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reviewApplicationMutation = useMutation({
    mutationFn: async ({
      applicationId,
      status,
      adminNotes,
      offeredPayment,
    }: {
      applicationId: string;
      status: "accepted" | "rejected";
      adminNotes?: string;
      offeredPayment?: number;
    }) => {
      const { error } = await (supabase as any)
        .from("festival_slot_applications")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by_admin_id: (await supabase.auth.getUser()).data.user?.id,
          admin_notes: adminNotes,
          offered_payment: offeredPayment,
        })
        .eq("id", applicationId);

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["festival-slot-applications"] });
      toast({
        title: status === "accepted" ? "Application accepted" : "Application rejected",
        description: `The festival application has been ${status}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Review failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    applications,
    isLoading,
    applyForSlot: applyForSlotMutation.mutate,
    reviewApplication: reviewApplicationMutation.mutate,
    isApplying: applyForSlotMutation.isPending,
    isReviewing: reviewApplicationMutation.isPending,
  };
};
