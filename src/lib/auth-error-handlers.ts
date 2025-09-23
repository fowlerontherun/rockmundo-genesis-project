import { AuthApiError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Clears any persisted Supabase session if the provided error indicates
 * an invalid refresh token. This helps recover from stale browser storage
 * where Supabase is unable to find the referenced refresh token.
 *
 * @returns A boolean indicating whether the error was handled.
 */
export const handleInvalidRefreshTokenError = async (error: unknown): Promise<boolean> => {
  if (error instanceof AuthApiError) {
    const message = error.message.toLowerCase();

    if (message.includes("invalid refresh token")) {
      console.warn("Clearing stale Supabase session due to invalid refresh token.", error);

      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        console.error("Failed to clear stale Supabase session:", signOutError);
      }

      return true;
    }
  }

  return false;
};
