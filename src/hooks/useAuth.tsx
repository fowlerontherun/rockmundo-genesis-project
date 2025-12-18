import { useState, useEffect, type ReactNode, type FC } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
          throw error;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (sessionError) {
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
    // Use scope: 'local' to ensure local session is cleared even if server call fails
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error("Error signing out:", error);
    }
    // Explicitly clear state in case the onAuthStateChange doesn't fire
    setSession(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
