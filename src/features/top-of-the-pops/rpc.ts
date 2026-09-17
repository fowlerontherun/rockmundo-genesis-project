import { supabase } from "@/integrations/supabase/client";

interface TotpRpcError {
  message: string;
}

interface TotpRpcResponse<T> {
  data: T | null;
  error: TotpRpcError | null;
}

type DynamicRpc = <T>(
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<TotpRpcResponse<T>>;

const dynamicRpc = supabase.rpc.bind(supabase) as unknown as DynamicRpc;

/**
 * Temporary strongly-typed bridge for TOTP RPCs until the generated Supabase
 * database types include the migrations in this branch.
 */
export async function totpRpc<T>(
  functionName: string,
  args?: Record<string, unknown>,
): Promise<TotpRpcResponse<T>> {
  return await dynamicRpc<T>(functionName, args);
}
