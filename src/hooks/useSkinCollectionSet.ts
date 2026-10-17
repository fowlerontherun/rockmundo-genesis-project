import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

/** Skin collection sets are sold for real money (£1.99) via Stripe checkout. */
export const SKIN_SET_PRICE_LABEL = "£1.99";

export function useBuySkinCollectionSet() {
  const { profileId } = useActiveProfile();
  return useMutation({
    mutationFn: async (collectionId: string) => {
      if (!profileId) throw new Error("Choose a character first.");
      const { data, error } = await supabase.functions.invoke("skin-collection-checkout", {
        body: { collectionId, profileId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.url as string;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: (e: Error) => toast.error(e.message || "Could not start checkout"),
  });
}

/** After returning from checkout, confirm payment and unlock the set. */
export function useConfirmSkinSetReturn() {
  const qc = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("set_session");
    if (!sessionId || done.current) return;
    done.current = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("skin-collection-checkout", {
        body: { action: "verify", sessionId },
      });
      if (error || data?.error) toast.error(data?.error || "Could not confirm your payment yet. Refresh in a moment.");
      else if (data?.status === "unpaid") toast.error("Payment not completed.");
      else toast.success(`Collection unlocked — ${data?.items ?? 0} new items added to your wardrobe!`);
      qc.invalidateQueries({ queryKey: ["owned-skins"] });
      params.delete("set_session");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    })();
  }, [qc]);
}
