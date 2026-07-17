import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type FestivalApplicationScope =
  | { scope: "edition"; editionId: string; festivalId?: string; bandId?: string }
  | { scope: "festival"; festivalId: string; editionId?: never; bandId?: string }
  | { scope: "band"; bandId: string; festivalId?: string; editionId?: string };

const relatedRecord = z.object({ id: z.string() }).passthrough().nullable();
export const festivalSlotApplicationSchema = z.object({
  id: z.string(),
  festival_id: z.string(),
  edition_id: z.string().nullable(),
  band_id: z.string(),
  slot_type: z.string().nullable(),
  status: z.string(),
  requested_payment: z.coerce.number().nullable().optional(),
  offered_payment: z.coerce.number().nullable().optional(),
  admin_notes: z.string().nullable().optional(),
  application_message: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  edition: relatedRecord,
  festival: relatedRecord,
  band: relatedRecord,
  setlist: relatedRecord,
}).passthrough();
export type FestivalSlotApplication = z.infer<typeof festivalSlotApplicationSchema>;

export const useFestivalSlotApplications = (scope?: FestivalApplicationScope) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editionId = scope?.editionId;
  const festivalId = scope?.festivalId;
  const bandId = scope?.bandId;
  const queryKey = ["festival-slot-applications", scope?.scope ?? "none", festivalId ?? null, editionId ?? null, bandId ?? null];

  const { data: applications, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<FestivalSlotApplication[]> => {
      let query = (supabase as any)
        .from("festival_slot_applications")
        .select(`
          *,
          edition:festival_editions(id, title, edition_number, start_at, end_at),
          festival:festivals(id, name, start_date, end_date),
          band:bands(id, name, genre, fame),
          setlist:setlists(id, name)
        `)
        .order("created_at", { ascending: false });

      if (editionId) query = query.eq("edition_id", editionId);
      if (festivalId) query = query.eq("festival_id", festivalId);
      if (bandId) query = query.eq("band_id", bandId);

      const { data, error } = await query;
      if (error) throw error;
      return z.array(festivalSlotApplicationSchema).parse(data ?? []);
    },
    enabled: Boolean(scope && (editionId || festivalId || bandId)),
  });

  const applyForSlotMutation = useMutation({
    mutationFn: async (applicationData: {
      festival_id: string;
      edition_id?: string;
      band_id: string;
      applied_by_user_id: string;
      slot_type: string;
      preferred_date?: string;
      setlist_id?: string;
      application_message?: string;
    }) => {
      const { error } = await (supabase as any).from("festival_slot_applications").insert(applicationData as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festival-slot-applications"] });
      toast({ title: "Application submitted!", description: "Your festival slot application has been sent for review." });
    },
    onError: (error: Error) => toast({ title: "Application failed", description: error.message, variant: "destructive" }),
  });

  const reviewApplicationMutation = useMutation({
    mutationFn: async ({ applicationId, status, adminNotes, offeredPayment }: {
      applicationId: string;
      status: "accepted" | "rejected";
      adminNotes?: string;
      offeredPayment?: number;
    }) => {
      if (scope?.scope === "edition" && applications?.some((app) => app.id === applicationId && app.edition_id !== scope.editionId)) {
        throw new Error("Application does not belong to the selected edition.");
      }
      let mutation = supabase
        .from("festival_slot_applications")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by_admin_id: (await supabase.auth.getUser()).data.user?.id,
          admin_notes: adminNotes,
          offered_payment: offeredPayment,
        } as never)
        .eq("id", applicationId);
      if (scope?.scope === "edition") mutation = mutation.eq("edition_id", scope.editionId);
      const { error } = await mutation;
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: status === "accepted" ? "Application accepted" : "Application rejected", description: `The festival application has been ${status}.` });
    },
    onError: (error: Error) => toast({ title: "Review failed", description: error.message, variant: "destructive" }),
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
