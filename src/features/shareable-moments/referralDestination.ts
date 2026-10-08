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
    if (error || !data?.code) return destinationUrl;
    return withReferral(destinationUrl, data.code, source);
  } catch {
    return destinationUrl;
  }
}
