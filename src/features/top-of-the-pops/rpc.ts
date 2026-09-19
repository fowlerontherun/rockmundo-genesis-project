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
export type TotpRpcName = Extract<keyof PublicFunctions, `totp_${string}`>;
type TotpRpcArgument = Record<string, unknown> | undefined;
type TypedTotpRpc = (functionName: TotpRpcName, args?: TotpRpcArgument) => PromiseLike<TotpRpcResponse<unknown>>;

const typedTotpRpc = supabase.rpc.bind(supabase) as TypedTotpRpc;

export async function totpRpc<Result>(
  functionName: TotpRpcName,
  args?: TotpRpcArgument,
): Promise<TotpRpcResponse<Result>> {
  return await typedTotpRpc(functionName, args) as TotpRpcResponse<Result>;
}
