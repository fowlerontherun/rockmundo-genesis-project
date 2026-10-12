import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Trophy, Sparkles, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/use-toast";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function DonationSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const [processed, setProcessed] = useState(false);
  const [processing, setProcessing] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!profileId) return;
    if (!sessionId) {
      setFailure("No paid checkout session was provided.");
      setProcessing(false);
      return;
    }
    let cancelled = false;
    setProcessing(true);
    setFailure(null);
    void supabase.functions.invoke("fulfill-donation-reward", {
      body: { session_id: sessionId, profile_id: profileId },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.success) throw error ?? new Error(data?.error || "Could not redeem donation");
      setProcessed(true);
      toast({ title: "Donation rewards confirmed!", description: "Your verified payment was processed securely." });
    }).catch((err) => {
      if (cancelled) return;
      setFailure(err instanceof Error ? err.message : "Could not verify this donation.");
    }).finally(() => { if (!cancelled) setProcessing(false); });
    return () => { cancelled = true; };
  }, [profileId, sessionId, attempt, toast]);

  return (
    <FMPageScaffold title="Thank You" icon={Heart} backTo="/hub/career-business">
      <Card className="bg-gradient-to-br from-pink-500/10 via-background to-amber-500/10 border-pink-500/30">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 rounded-full bg-gradient-to-r from-pink-500/20 to-amber-500/20">
            <Heart className="h-12 w-12 text-pink-500" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-amber-500 bg-clip-text text-transparent">
            Thank You! 💖
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-lg text-muted-foreground">
            Your generous donation helps keep Rockmundo running and growing!
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30">
              <Sparkles className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-amber-400">{processed ? "+1000 XP" : "1000 XP pending"}</p>
              <p className="text-xs text-muted-foreground">Experience Earned</p>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30">
              <Trophy className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <p className="font-semibold text-purple-400">Achievement</p>
              <p className="text-xs text-muted-foreground">Project Supporter</p>
            </div>
          </div>

          <Badge className="bg-gradient-to-r from-pink-500 to-amber-500 text-white px-4 py-2">
            {processing ? "Verifying payment..." : processed ? "Rewards Claimed!" : "Rewards not confirmed"}
          </Badge>

          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          {!processed && !processing && <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Retry verified payment</Button>}
          <Button
            onClick={() => navigate("/home")}
            className="w-full bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 text-white"
          >
            <Home className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/checkout-receipt${sessionId ? `?session_id=${sessionId}` : ""}`)}
          >
            View receipt & status
          </Button>
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
