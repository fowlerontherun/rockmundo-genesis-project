import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useFullCharacterIdentity } from "@/hooks/useCharacterIdentity";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const targetProfileId = searchParams.get("profileId") || undefined;
  const { hasCompletedOnboarding, isLoading } = useFullCharacterIdentity(targetProfileId);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // Check the profile explicitly requested by character creation when present.
    // This prevents a completed previous character from bouncing a new character
    // out of the onboarding wizard while active-profile game data is refreshing.
    if (!isLoading && hasCompletedOnboarding) {
      navigate("/home");
    }
  }, [hasCompletedOnboarding, isLoading, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-stage">
      <OnboardingWizard />
    </div>
  );
};

export default Onboarding;
