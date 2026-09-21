import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

interface TotpRpcError {
  message: string;
}

export interface TotpRpcResponse<T> {
  data: T | null;
  error: TotpRpcError | null;
}

type PublicFunctions = Database["public"]["Functions"];
export type TotpRpcName =
  | Extract<keyof PublicFunctions, `totp_${string}`>
  | "totp_admin_enqueue_rehearsal_render"
  | "totp_admin_record_preflight_override"
  | "totp_admin_band_name_audio_catalog"
  | "totp_admin_save_band_name_audio"
  | "totp_episode_presenter_audio"
  | "totp_episode_presenter_fragments"
  | "totp_admin_booking_catalog"
  | "totp_admin_book_band"
  | "totp_admin_resend_invitation";
type TotpRpcArgument = Record<string, unknown> | undefined;
type TypedTotpRpc = (functionName: TotpRpcName, args?: TotpRpcArgument) => PromiseLike<TotpRpcResponse<unknown>>;

const typedTotpRpc = supabase.rpc.bind(supabase) as TypedTotpRpc;

export async function totpRpc<Result>(
  functionName: TotpRpcName,
  args?: TotpRpcArgument,
): Promise<TotpRpcResponse<Result>> {
  return await typedTotpRpc(functionName, args) as TotpRpcResponse<Result>;
}