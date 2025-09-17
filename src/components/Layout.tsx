
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navigation from "@/components/ui/navigation";
import CharacterGate from "@/components/CharacterGate";
import { useAuth } from "@/hooks/use-auth-context";
import { checkProfileCompletion } from "@/utils/profileCompletion";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Wand2 } from "lucide-react";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRefresh, setProfileRefresh] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handleProfileUpdated = () => {
      setProfileRefresh((previous) => previous + 1);
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    const verifyProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        setHasProfile(false);
        setProfileError(null);
        return;
      }

      setCheckingProfile(true);
      setProfileError(null);

      try {
        const { isComplete } = await checkProfileCompletion(user.id);
        setHasProfile(isComplete);
      } catch (error) {
        console.error("Failed to confirm profile:", error);
        setHasProfile(false);
        setProfileError("We couldn't confirm your profile. You may need to revisit the creator.");
      } finally {
        setCheckingProfile(false);
      }
    };

    if (!loading) {
      void verifyProfile();
    }
  }, [user, loading, profileRefresh]);

  useEffect(() => {
    if (
      !loading &&
      user &&
      !checkingProfile &&
      !hasProfile &&
      location.pathname !== "/character-create"
    ) {
      navigate("/character-create");
    }
  }, [loading, user, checkingProfile, hasProfile, location.pathname, navigate]);

  if (loading || checkingProfile) {
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
