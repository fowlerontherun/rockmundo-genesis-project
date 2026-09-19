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
export type TotpRpcArgs<Name extends TotpRpcName> = PublicFunctions[Name]["Args"];
export type TotpRpcResult<Name extends TotpRpcName> = PublicFunctions[Name]["Returns"];

type TypedTotpRpc = <Name extends TotpRpcName>(
  functionName: Name,
  args?: TotpRpcArgs<Name>,
) => PromiseLike<TotpRpcResponse<TotpRpcResult<Name>>>;

const typedTotpRpc = supabase.rpc.bind(supabase) as TypedTotpRpc;

export async function totpRpc<Name extends TotpRpcName, Result = TotpRpcResult<Name>>(
  functionName: Name,
  args?: TotpRpcArgs<Name>,
): Promise<TotpRpcResponse<T>> {
  const response = await typedTotpRpc(functionName, args);
  return response as TotpRpcResponse<Result>;
}
