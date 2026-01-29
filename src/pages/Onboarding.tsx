import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useFullCharacterIdentity } from "@/hooks/useCharacterIdentity";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading } = useFullCharacterIdentity();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // If onboarding already completed, redirect to dashboard
    if (!isLoading && hasCompletedOnboarding) {
      navigate("/dashboard");
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
