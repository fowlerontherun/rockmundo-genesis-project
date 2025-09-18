import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth-context";
import { checkProfileCompletion } from "@/utils/profileCompletion";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const determineLandingPage = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      if (!isActive) {
        return;
      }

      setCheckingProfile(true);
      setError(null);

      try {
        const { isComplete } = await checkProfileCompletion(user.id);
        if (!isActive) {
          return;
        }
        navigate(isComplete ? "/dashboard" : "/character-create");
      } catch (profileError) {
        console.error("Failed to verify profile completion:", profileError);
        if (!isActive) {
          return;
        }
        setError("We couldn't verify your profile status. You can continue to the creator.");
      } finally {
        if (isActive) {
          setCheckingProfile(false);
        }
      }
    };

    if (!loading) {
      void determineLandingPage();
    }
    return () => {
      isActive = false;
    };
  }, [user, loading, navigate]);

  if (loading || checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading Rockmundo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage px-4">
        <div className="w-full max-w-md space-y-6 rounded-xl bg-background/95 p-8 text-center shadow-xl">
          <Alert variant="destructive" className="text-left">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Heads up!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We'll take you to the character creator so you can finish setting up your artist.
            </p>
            <Button onClick={() => navigate("/character-create")}>Continue to Creator</Button>
          </div>
        </div>
      </div>
    );
  }

  return null; // Will redirect to dashboard
};

export default Index;
