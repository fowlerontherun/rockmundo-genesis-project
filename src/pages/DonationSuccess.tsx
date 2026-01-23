import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Trophy, Sparkles, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";

export default function DonationSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { user } = useAuth();
  const { toast } = useToast();
  const [processed, setProcessed] = useState(false);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processRewards = async () => {
      if (!user || processed) return;

      try {
        // Award XP via experience_ledger
        const { error: xpError } = await supabase
          .from("experience_ledger")
          .insert({
            user_id: user.id,
            profile_id: user.id,
            activity_type: "project_donation",
            xp_amount: 1000,
            metadata: { session_id: sessionId, description: "Thank you for your generous donation to Rockmundo!" },
          });

        if (xpError) console.error("XP error:", xpError);

        // Update profile experience
        const { data: profile } = await supabase
          .from("profiles")
          .select("experience")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ experience: (profile.experience || 0) + 1000 })
            .eq("user_id", user.id);
        }

        // Check if donation achievement exists, if not create it
        let achievementId: string | null = null;
        const { data: existingAchievement } = await supabase
          .from("achievements")
          .select("id")
          .eq("name", "Project Supporter")
          .single();

        if (existingAchievement) {
          achievementId = existingAchievement.id;
        } else {
          const { data: newAchievement } = await supabase
            .from("achievements")
            .insert({
              name: "Project Supporter",
              description: "Generously donated to support Rockmundo development",
              icon: "heart",
              category: "special",
              rarity: "legendary",
              requirements: { donation: true },
              rewards: { xp: 1000, badge: "supporter" },
            })
            .select("id")
            .single();
          achievementId = newAchievement?.id ?? null;
        }

        // Award achievement if not already owned
        if (achievementId) {
          const { data: existingPlayerAchievement } = await supabase
            .from("player_achievements")
            .select("id")
            .eq("user_id", user.id)
            .eq("achievement_id", achievementId)
            .single();

          if (!existingPlayerAchievement) {
            await supabase.from("player_achievements").insert({
              user_id: user.id,
              achievement_id: achievementId,
              progress: { donation: true },
              unlocked_at: new Date().toISOString(),
            });
          }
        }

        // Log activity
        await supabase.from("activity_feed").insert({
          user_id: user.id,
          activity_type: "donation",
          message: "Made a generous donation to support Rockmundo! 💖",
          earnings: 0,
          metadata: { session_id: sessionId, xp_earned: 1000 },
        });

        setProcessed(true);

        toast({
          title: "Rewards Claimed! 🎉",
          description: "You received 1000 XP and the Project Supporter achievement!",
        });
      } catch (error) {
        console.error("Error processing rewards:", error);
        toast({
          title: "Processing Error",
          description: "There was an issue processing your rewards. Please contact support.",
          variant: "destructive",
        });
      } finally {
        setProcessing(false);
      }
    };

    processRewards();
  }, [user, processed, sessionId, toast]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
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
              <p className="font-semibold text-amber-400">+1000 XP</p>
              <p className="text-xs text-muted-foreground">Experience Earned</p>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30">
              <Trophy className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <p className="font-semibold text-purple-400">Achievement</p>
              <p className="text-xs text-muted-foreground">Project Supporter</p>
            </div>
          </div>

          <Badge className="bg-gradient-to-r from-pink-500 to-amber-500 text-white px-4 py-2">
            {processing ? "Processing rewards..." : "Rewards Claimed!"}
          </Badge>

          <Button
            onClick={() => navigate("/dashboard")}
            className="w-full bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 text-white"
          >
            <Home className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
