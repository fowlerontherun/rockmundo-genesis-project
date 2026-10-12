import { supabase } from "@/integrations/supabase/client";
import { withReferral } from "./share";

export async function referralAwareDestination(
  profileId: string | null | undefined,
  destinationUrl: string,
  source: string,
): Promise<string> {
  if (!profileId) return destinationUrl;
  try {
    const { data, error } = await (supabase as any).rpc("get_referral_dashboard", {
      p_profile_id: profileId,
    });
    if (error) throw error;
    if (!data?.code) throw new Error("Referral code is unavailable; the destination cannot be shared with attribution.");
    return withReferral(destinationUrl, data.code, source);
  } catch {
    // A referral lookup outage must not prevent players from sharing the original destination.
    return destinationUrl;
  }
}
