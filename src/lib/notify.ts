import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";

export type NotifyCategory =
  | "gig_result"
  | "gig_reminder"
  | "offer"
  | "achievement"
  | "release"
  | "recording"
  | "social"
  | "financial"
  | "system";

export interface NotifyArgs {
  userId: string;
  profileId?: string | null;
  category: NotifyCategory | string;
  type?: "info" | "success" | "warning" | "achievement" | "offer";
  title: string;
  message?: string;
  actionPath?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Persist a notification so it shows up in the top-right bell.
 * Uses the SECURITY DEFINER RPC `create_notification`.
 */
export async function pushNotification(args: NotifyArgs): Promise<string | null> {
  if (!args.userId) return null;
  try {
    const { data, error } = await supabase.rpc(asAny("create_notification"), {
      p_user_id: args.userId,
      p_profile_id: args.profileId ?? null,
      p_category: args.category,
      p_type: args.type ?? "info",
      p_title: args.title,
      p_message: args.message ?? "",
      p_action_path: args.actionPath ?? null,
      p_metadata: args.metadata ?? {},
    } as never);
    if (error) {
      console.error("[notify] create_notification failed", error);
      return null;
    }
    return (data as unknown as string) ?? null;
  } catch (err) {
    console.error("[notify] exception", err);
    return null;
  }
}
