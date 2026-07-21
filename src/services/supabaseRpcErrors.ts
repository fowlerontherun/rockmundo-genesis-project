export const SUPABASE_RPC_SCHEMA_UNAVAILABLE_MESSAGE =
  "Banking is temporarily unavailable while the finance service is being updated. Please try again shortly.";

export type SupabaseRpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function isMissingSupabaseRpcError(error: SupabaseRpcErrorLike | null | undefined): boolean {
  if (!error) return false;

  const haystack = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    error.code === "PGRST202" ||
    haystack.includes("function not found") ||
    haystack.includes("schema cache") ||
    haystack.includes("could not find the function")
  );
}
