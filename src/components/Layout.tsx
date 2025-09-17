import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navigation from "@/components/ui/navigation";
import CharacterGate from "@/components/CharacterGate";
import { useAuth } from "@/hooks/use-auth-context";

const Layout = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-stage">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading Rockmundo...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth page
  }

  return (
    <div className="flex h-screen bg-background">
      <Navigation />
      <main className="flex-1 overflow-y-auto lg:ml-0 pt-16 lg:pt-0 pb-16 lg:pb-0">
        <CharacterGate>
          <Outlet />
        </CharacterGate>
      </main>
    </div>
  );
};

export default Layout;