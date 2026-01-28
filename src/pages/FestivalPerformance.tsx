import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Music, 
  Users, 
  Star, 
  Zap, 
  TrendingUp, 
  DollarSign,
  Play,
  CheckCircle,
  PartyPopper
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FestivalPerformanceOutcome } from "@/components/festivals/FestivalPerformanceOutcome";

interface PerformanceState {
  phase: "warmup" | "performing" | "climax" | "complete";
  crowdEnergy: number;
  performanceScore: number;
  songsPlayed: number;
  totalSongs: number;
}

export default function FestivalPerformance() {
  const { participationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const primaryBandQuery = usePrimaryBand();
  const primaryBand = primaryBandQuery.data?.bands;

  const [performanceState, setPerformanceState] = useState<PerformanceState>({
    phase: "warmup",
    crowdEnergy: 30,
    performanceScore: 0,
    songsPlayed: 0,
    totalSongs: 8,
  });

  const [isPerforming, setIsPerforming] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [performanceResults, setPerformanceResults] = useState<{
    earnedPayment: number;
    earnedFame: number;
  } | null>(null);

  // Fetch participation details
  const { data: participation, isLoading } = useQuery({
    queryKey: ["festival-participation", participationId],
    queryFn: async () => {
      if (!participationId) return null;

      const { data, error } = await (supabase as any)
        .from("festival_participants")
        .select(`
          *,
          festival:game_events!event_id(id, title, description, start_date, end_date, requirements, rewards)
        `)
        .eq("id", participationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!participationId,
  });

  // Complete performance mutation
  const completePerformance = useMutation({
    mutationFn: async (results: { score: number; crowdEnergy: number }) => {
      if (!participationId || !primaryBand?.id) throw new Error("Missing data");

      // Calculate rewards based on performance
      const basePayment = participation?.payout_amount || 5000;
      const baseFame = participation?.festival?.rewards?.fame || 100;
      
      const scoreMultiplier = results.score / 100;
      const energyMultiplier = results.crowdEnergy / 100;
      const finalMultiplier = (scoreMultiplier + energyMultiplier) / 2;

      const earnedPayment = Math.round(basePayment * finalMultiplier);
      const earnedFame = Math.round(baseFame * finalMultiplier);

      // Update participation status
      const { error: updateError } = await (supabase as any)
        .from("festival_participants")
        .update({ status: "performed" })
        .eq("id", participationId);

      if (updateError) throw updateError;

      // Update band balance and fame
      const { data: bandData } = await (supabase as any)
        .from("bands")
        .select("band_balance, fame")
        .eq("id", primaryBand.id)
        .single();

      if (bandData) {
        await (supabase as any)
          .from("bands")
          .update({
            band_balance: (bandData.band_balance || 0) + earnedPayment,
            fame: (bandData.fame || 0) + earnedFame,
          })
          .eq("id", primaryBand.id);
      }

      return { earnedPayment, earnedFame, score: results.score };
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["festival-participation"] });
      queryClient.invalidateQueries({ queryKey: ["primary-band"] });
      setPerformanceResults({
        earnedPayment: results.earnedPayment,
        earnedFame: results.earnedFame,
      });
      setShowOutcome(true);
      toast.success(
        `Performance complete! Score: ${results.score}/100 | +${results.earnedFame} fame | +$${results.earnedPayment.toLocaleString()}`
      );
    },
    onError: (error: any) => {
      toast.error("Failed to complete performance", { description: error.message });
    },
  });

  // Simulate performance progression
  useEffect(() => {
    if (!isPerforming || performanceState.phase === "complete") return;

    const interval = setInterval(() => {
      setPerformanceState((prev) => {
        // Random energy fluctuations
        const energyChange = Math.random() > 0.5 ? Math.random() * 10 : -Math.random() * 5;
        const newEnergy = Math.max(10, Math.min(100, prev.crowdEnergy + energyChange));

        // Progress through songs
        const newSongsPlayed = Math.min(prev.songsPlayed + 0.5, prev.totalSongs);

        // Determine phase
        let newPhase = prev.phase;
        if (newSongsPlayed >= prev.totalSongs) {
          newPhase = "complete";
        } else if (newSongsPlayed >= prev.totalSongs * 0.75) {
          newPhase = "climax";
        } else if (newSongsPlayed >= 1) {
          newPhase = "performing";
        }

        // Calculate score based on energy maintenance
        const scoreIncrement = newEnergy > 50 ? 2 : newEnergy > 30 ? 1 : 0;
        const newScore = Math.min(100, prev.performanceScore + scoreIncrement);

        return {
          phase: newPhase,
          crowdEnergy: newEnergy,
          performanceScore: newScore,
          songsPlayed: newSongsPlayed,
          totalSongs: prev.totalSongs,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPerforming, performanceState.phase]);

  // Auto-complete when performance ends
  useEffect(() => {
    if (performanceState.phase === "complete" && isPerforming) {
      setIsPerforming(false);
      completePerformance.mutate({
        score: performanceState.performanceScore,
        crowdEnergy: performanceState.crowdEnergy,
      });
    }
  }, [performanceState.phase, isPerforming]);

  const handleStartPerformance = () => {
    setIsPerforming(true);
    setPerformanceState({
      phase: "warmup",
      crowdEnergy: 30,
      performanceScore: 0,
      songsPlayed: 0,
      totalSongs: 8,
    });
  };

  const handleBoostEnergy = () => {
    setPerformanceState((prev) => ({
      ...prev,
      crowdEnergy: Math.min(100, prev.crowdEnergy + 15),
    }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!participation) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Performance Not Found</h2>
          <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
        </div>
      </div>
    );
  }

  const canPerform = participation.status === "confirmed" || participation.status === "pending" || participation.status === "invited";
  const hasPerformed = participation.status === "performed";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Music className="h-6 w-6" />
            {participation.festival?.title || "Festival Performance"}
          </h1>
          <p className="text-muted-foreground">
            {participation.slot_type} slot • {primaryBand?.name}
          </p>
        </div>
        <Badge variant={hasPerformed ? "default" : "secondary"}>
          {participation.status}
        </Badge>
      </div>

      {/* Performance Area */}
      {canPerform && !hasPerformed && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Live Performance
            </CardTitle>
            <CardDescription>
              Take the stage and perform for the festival crowd!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isPerforming && performanceState.phase === "warmup" && (
              <div className="text-center py-8">
                <Music className="h-16 w-16 mx-auto mb-4 text-primary animate-pulse" />
                <h3 className="text-xl font-semibold mb-2">Ready to Perform?</h3>
                <p className="text-muted-foreground mb-6">
                  The crowd is waiting. Take the stage and give them a show to remember!
                </p>
                <Button size="lg" onClick={handleStartPerformance}>
                  <Play className="h-5 w-5 mr-2" />
                  Start Performance
                </Button>
              </div>
            )}

            {isPerforming && (
              <div className="space-y-6">
                {/* Phase Indicator */}
                <div className="flex justify-center gap-4">
                  {["warmup", "performing", "climax", "complete"].map((phase) => (
                    <Badge
                      key={phase}
                      variant={performanceState.phase === phase ? "default" : "outline"}
                      className={cn(
                        "capitalize",
                        performanceState.phase === phase && phase === "climax" && "animate-pulse"
                      )}
                    >
                      {phase === "complete" ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                      {phase}
                    </Badge>
                  ))}
                </div>

                {/* Crowd Energy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Crowd Energy
                    </span>
                    <span className="font-bold">{Math.round(performanceState.crowdEnergy)}%</span>
                  </div>
                  <Progress 
                    value={performanceState.crowdEnergy} 
                    className={cn(
                      "h-4",
                      performanceState.crowdEnergy > 70 && "bg-primary/20"
                    )}
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleBoostEnergy}
                    className="w-full"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Stage Move! (+15 Energy)
                  </Button>
                </div>

                {/* Performance Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      Songs Played
                    </span>
                    <span>{Math.floor(performanceState.songsPlayed)}/{performanceState.totalSongs}</span>
                  </div>
                  <Progress 
                    value={(performanceState.songsPlayed / performanceState.totalSongs) * 100} 
                    className="h-3"
                  />
                </div>

                {/* Current Score */}
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Current Score</p>
                  <p className="text-4xl font-bold text-primary">
                    {Math.round(performanceState.performanceScore)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance Outcome */}
      {showOutcome && performanceResults && (
        <FestivalPerformanceOutcome
          performanceScore={performanceState.performanceScore}
          crowdEnergy={performanceState.crowdEnergy}
          festivalName={participation.festival?.title || "Festival"}
          slotType={participation.slot_type}
          earnedPayment={performanceResults.earnedPayment}
          earnedFame={performanceResults.earnedFame}
          attendanceEstimate={Math.floor(Math.random() * 10000) + 5000}
          onShare={() => toast.success("Results shared!")}
        />
      )}

      {/* Completed Performance (simple fallback) */}
      {hasPerformed && !showOutcome && (
        <Card className="border-2 border-primary/30">
          <CardContent className="pt-6 text-center">
            <PartyPopper className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h3 className="text-2xl font-bold mb-2">Performance Complete!</h3>
            <p className="text-muted-foreground mb-4">
              You've successfully performed at {participation.festival?.title}
            </p>
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Payment</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  {(participation.payout_amount || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Fame Earned</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500" />
                  +{participation.festival?.rewards?.fame || 100}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Festival Details */}
      <Card>
        <CardHeader>
          <CardTitle>Festival Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Event</p>
              <p className="font-medium">{participation.festival?.title}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Slot Type</p>
              <Badge variant="outline" className="capitalize">{participation.slot_type}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Guaranteed Payment</p>
              <p className="font-medium">${(participation.payout_amount || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge>{participation.status}</Badge>
            </div>
          </div>
          {participation.festival?.description && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground">{participation.festival.description}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
