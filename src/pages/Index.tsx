import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: dataLoading, error } = useGameData();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !dataLoading && user) {
      navigate(profile ? "/dashboard" : "/profile");
    }
  }, [authLoading, dataLoading, user, profile, navigate]);

  if (authLoading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage px-4">
        <div className="w-full max-w-md space-y-6 rounded-xl bg-background/95 p-8 text-center shadow-xl">
          <Alert variant="destructive" className="text-left">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>We couldn&apos;t load your profile</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => navigate("/profile")}>Open profile</Button>
        </div>
      </div>
    );
  }

  return null;
};

export default Index;
