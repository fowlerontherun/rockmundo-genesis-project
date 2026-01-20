import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-context";

export default function VipSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(5);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Invalidate VIP status to refresh
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ["vip-status", user.id] });
    }
  }, [user?.id, queryClient]);

  useEffect(() => {
    // Auto-redirect countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[600px]">
      <Card className="max-w-md w-full bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/30">
        <CardContent className="p-8 text-center space-y-6">
          {/* Success Animation */}
          <div className="relative mx-auto w-fit">
            <div className="absolute inset-0 animate-ping rounded-full bg-green-500/30" />
            <div className="relative rounded-full bg-green-500/20 p-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </div>

          {/* VIP Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-900">
            <Crown className="h-5 w-5" />
            <span className="font-bold">VIP</span>
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Welcome to VIP!</h1>
            <p className="text-muted-foreground">
              Your subscription is now active. You have full access to all VIP features!
            </p>
          </div>

          <div className="space-y-3 text-left bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold text-sm">You can now:</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Create and manage holding companies
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Own record labels, venues, and studios
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Vote on radio chart rankings
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Access exclusive VIP features
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={() => navigate("/dashboard")}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
            >
              <Crown className="h-4 w-4 mr-2" />
              Start Building Your Empire
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Redirecting in {countdown} seconds...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
