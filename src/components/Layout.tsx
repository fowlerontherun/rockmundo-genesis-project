import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navigation from "@/components/ui/navigation";
import CharacterGate from "@/components/CharacterGate";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, error: profileError } = useGameData();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Removed automatic redirect to /my-character
  // Users can access character creation page directly if needed

  if (authLoading || dataLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-stage">
        <div className="text-center">
          <div className="mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-oswald">Loading Rockmundo...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full">
      <Navigation />
      <main className="flex-1 lg:ml-64 pt-[72px] pb-[72px] lg:pt-0 lg:pb-0">
        <div className="p-3 md:p-4">
          {profileError && (
            <Alert variant="destructive" className="mb-4 max-w-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Profile error</AlertTitle>
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          )}
          <CharacterGate>
            <Outlet />
          </CharacterGate>
        </div>
      </main>
    </div>
  );
};

export default Layout;
