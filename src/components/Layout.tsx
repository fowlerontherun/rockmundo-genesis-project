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

  useEffect(() => {
    const isOnProfile = location.pathname === "/profile";

    if (!authLoading && !dataLoading && user && !profile && !isOnProfile) {
      navigate("/profile");
    }
  }, [authLoading, dataLoading, user, profile, location.pathname, navigate]);

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
    <div className="flex h-screen bg-background">
      <Navigation />
      <main className="flex-1 overflow-y-auto pb-16 pt-16 lg:ml-0 lg:pb-0 lg:pt-0">
        {profileError && (
          <div className="px-4 pt-4 lg:px-6">
            <Alert variant="destructive" className="max-w-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Profile error</AlertTitle>
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          </div>
        )}
        <CharacterGate>
          <Outlet />
        </CharacterGate>
      </main>
    </div>
  );
};

export default Layout;
