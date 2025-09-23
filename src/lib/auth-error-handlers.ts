import { AuthApiError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Determines whether the provided error was caused by an invalid
 * Supabase refresh token. This allows different parts of the app to
 * perform early checks before invoking the async recovery handler.
 */
export const isInvalidRefreshTokenError = (error: unknown): error is AuthApiError => {
  if (error instanceof AuthApiError) {
    const message = error.message.toLowerCase();

    return message.includes("invalid refresh token");
  }

  return false;
};

/**
 * Clears any persisted Supabase session if the provided error indicates
 * an invalid refresh token. This helps recover from stale browser storage
 * where Supabase is unable to find the referenced refresh token.
 *
 * @returns A boolean indicating whether the error was handled.
 */
export const handleInvalidRefreshTokenError = async (error: unknown): Promise<boolean> => {
  if (!isInvalidRefreshTokenError(error)) {
    return false;
  }

  console.warn("Clearing stale Supabase session due to invalid refresh token.", error);

  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  if (signOutError) {
    console.error("Failed to clear stale Supabase session:", signOutError);
  }

  return true;
};
