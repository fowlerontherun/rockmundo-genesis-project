import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAuthoritativeChildBirth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, name }: { requestId: string; name: string }) => {
      const cleanedName = name.trim();
      if (!cleanedName) throw new Error("Enter a name for your child");
      const { data, error } = await (supabase as any).rpc("complete_child_birth_authoritative", {
        p_request_id: requestId,
        p_name: cleanedName,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: async () => {
      toast.success("A child has joined the family! 🎉👶");
      await qc.invalidateQueries({ queryKey: ["player-children"] });
      await qc.invalidateQueries({ queryKey: ["child-requests"] });
      await qc.invalidateQueries({ queryKey: ["activity-feed"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to complete birth"),
  });
}
