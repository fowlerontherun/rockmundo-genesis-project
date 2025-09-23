import { useState, useEffect, type ReactNode, type FC } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { handleInvalidRefreshTokenError } from "@/lib/auth-error-handlers";

import { AuthContext, type AuthContextType } from "./use-auth-context";

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const fetchInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          const handled = await handleInvalidRefreshTokenError(error);
          if (!handled) {
            throw error;
          }

          setSession(null);
          setUser(null);
          return;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (sessionError) {
        await handleInvalidRefreshTokenError(sessionError);
        console.error("Error fetching initial auth session:", sessionError);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchInitialSession();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
