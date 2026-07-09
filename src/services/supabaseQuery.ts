import type { PostgrestError } from "@supabase/supabase-js";

export type SupabaseQueryContext = {
  scope: string;
  action: string;
};

export const describeSupabaseError = (error: PostgrestError | Error | null | undefined): string => {
  if (!error) return "Unknown Supabase error";
  if ("message" in error && error.message) return error.message;
  return String(error);
};

export const logSupabaseError = (
  context: SupabaseQueryContext,
  error: PostgrestError | Error | null | undefined,
) => {
  console.error(`[${context.scope}] Failed to ${context.action}: ${describeSupabaseError(error)}`, error);
};

export const requireSupabaseData = <T>(
  data: T | null | undefined,
  context: SupabaseQueryContext,
): T => {
  if (data == null) {
    throw new Error(`[${context.scope}] Failed to ${context.action}: no data returned`);
  }

  return data;
};

export const supabaseArrayOrThrow = <T>(
  data: T[] | null | undefined,
  error: PostgrestError | Error | null | undefined,
  context: SupabaseQueryContext,
): T[] => {
  if (error) {
    logSupabaseError(context, error);
    throw error;
  }

  return data ?? [];
};

export const supabaseArrayOrFallback = <T>(
  data: T[] | null | undefined,
  error: PostgrestError | Error | null | undefined,
  context: SupabaseQueryContext,
  fallback: T[] = [],
): T[] => {
  if (error) {
    logSupabaseError(context, error);
    return fallback;
  }

  return data ?? fallback;
};

export const supabaseSingleOrFallback = <T>(
  data: T | null | undefined,
  error: PostgrestError | Error | null | undefined,
  context: SupabaseQueryContext,
  fallback: T,
): T => {
  if (error) {
    logSupabaseError(context, error);
    return fallback;
  }

  return data ?? fallback;
};
