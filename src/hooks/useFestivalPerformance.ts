import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PerformancePhase {
  id: string;
  name: string;
  description: string;
  duration: number; // seconds
  type: "soundcheck" | "opening" | "main_set" | "crowd_interaction" | "climax";
}

export interface PerformanceEvent {
  id: string;
  type: "technical_issue" | "crowd_surfer" | "equipment_failure" | "crowd_chant" | "encore_request";
  description: string;
  options: { label: string; score: number }[];
  timestamp: number;
}

export interface PerformanceMetrics {
  songFamiliarity: number;
  gearQuality: number;
  bandChemistry: number;
  setlistFlow: number;
  crowdManagement: number;
  eventResponses: number;
}

export interface PerformanceResult {
  performanceScore: number;
  crowdEnergyPeak: number;
  crowdEnergyAvg: number;
  paymentEarned: number;
  fameEarned: number;
  merchRevenue: number;
  newFansGained: number;
  criticScore: number;
  fanScore: number;
  reviewHeadline: string;
  reviewSummary: string;
  highlights: string[];
}

const PERFORMANCE_PHASES: PerformancePhase[] = [
  { id: "soundcheck", name: "Soundcheck", description: "Tune your instruments and test the sound system", duration: 30, type: "soundcheck" },
  { id: "opening", name: "Opening", description: "Build energy and warm up the crowd", duration: 45, type: "opening" },
  { id: "main_set", name: "Main Set", description: "Perform your core setlist songs", duration: 90, type: "main_set" },
  { id: "crowd_interaction", name: "Crowd Interaction", description: "Engage with the audience", duration: 30, type: "crowd_interaction" },
  { id: "climax", name: "Climax/Encore", description: "End with a bang!", duration: 45, type: "climax" },
];

const RANDOM_EVENTS: Omit<PerformanceEvent, "id" | "timestamp">[] = [
  {
    type: "technical_issue",
    description: "A microphone starts cutting out!",
    options: [
      { label: "Quickly switch mics", score: 80 },
      { label: "Keep singing louder", score: 50 },
      { label: "Stop and fix it", score: 30 },
    ],
  },
  {
    type: "crowd_surfer",
    description: "A crowd surfer reaches the stage!",
    options: [
      { label: "Help them up for a high-five", score: 90 },
      { label: "Keep playing", score: 60 },
      { label: "Motion security", score: 40 },
    ],
  },
  {
    type: "crowd_chant",
    description: "The crowd starts chanting your band name!",
    options: [
      { label: "Lead the chant", score: 95 },
      { label: "Acknowledge with a wave", score: 70 },
      { label: "Continue playing", score: 50 },
    ],
  },
  {
    type: "encore_request",
    description: "The crowd is demanding an encore!",
    options: [
      { label: "Play your biggest hit", score: 100 },
      { label: "Play a surprise cover", score: 80 },
      { label: "Wave goodbye", score: 40 },
    ],
  },
  {
    type: "equipment_failure",
    description: "Your amp blows a fuse!",
    options: [
      { label: "Borrow from another band", score: 70 },
      { label: "Go acoustic", score: 60 },
      { label: "Take a break", score: 30 },
    ],
  },
];

const REVIEW_HEADLINES = {
  excellent: [
    "A Performance for the Ages",
    "Absolutely Electric!",
    "Best Festival Set This Year",
    "The Crowd Went Wild",
    "Unforgettable Night",
  ],
  good: [
    "Solid Festival Performance",
    "Crowd-Pleasing Set",
    "A Good Time Was Had",
    "Energetic Show",
    "Worth the Wait",
  ],
  average: [
    "Decent But Unmemorable",
    "Middle of the Road",
    "They Played, We Listened",
    "Room for Improvement",
    "Not Bad, Not Great",
  ],
  poor: [
    "A Disappointing Display",
    "Crowd Left Early",
    "Technical Troubles Mar Set",
    "Below Expectations",
    "Forgettable Performance",
  ],
};

export function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  const weights = {
    songFamiliarity: 0.25,
    gearQuality: 0.15,
    bandChemistry: 0.20,
    setlistFlow: 0.15,
    crowdManagement: 0.15,
    eventResponses: 0.10,
  };

  return Math.round(
    metrics.songFamiliarity * weights.songFamiliarity +
    metrics.gearQuality * weights.gearQuality +
    metrics.bandChemistry * weights.bandChemistry +
    metrics.setlistFlow * weights.setlistFlow +
    metrics.crowdManagement * weights.crowdManagement +
    metrics.eventResponses * weights.eventResponses
  );
}

function generateReview(score: number): { headline: string; summary: string; criticScore: number; fanScore: number } {
  let category: keyof typeof REVIEW_HEADLINES;
  if (score >= 85) category = "excellent";
  else if (score >= 70) category = "good";
  else if (score >= 50) category = "average";
  else category = "poor";

  const headlines = REVIEW_HEADLINES[category];
  const headline = headlines[Math.floor(Math.random() * headlines.length)];

  const criticVariance = Math.floor((Math.random() - 0.5) * 20);
  const fanVariance = Math.floor((Math.random() - 0.5) * 15);

  return {
    headline,
    summary: `The band delivered a ${category} performance with a score of ${score}/100.`,
    criticScore: Math.min(100, Math.max(0, score + criticVariance)),
    fanScore: Math.min(100, Math.max(0, score + fanVariance + 5)), // Fans slightly more generous
  };
}

export function useFestivalPerformance(participationId: string, bandId?: string) {
  const queryClient = useQueryClient();
  const [currentPhase, setCurrentPhase] = useState(0);
  const [crowdEnergy, setCrowdEnergy] = useState(50);
  const [crowdEnergyHistory, setCrowdEnergyHistory] = useState<number[]>([50]);
  const [eventResponses, setEventResponses] = useState<number[]>([]);
  const [isPerforming, setIsPerforming] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<PerformanceEvent | null>(null);

  // Fetch band chemistry and gear quality
  const { data: bandData } = useQuery({
    queryKey: ["band-performance-data", bandId],
    queryFn: async () => {
      if (!bandId) return null;

      const [bandResult, gearResult] = await Promise.all([
        (supabase as any).from("bands").select("chemistry, fame").eq("id", bandId).single(),
        (supabase as any).from("player_equipment").select("equipment:equipment_catalog(quality_rating)").eq("band_id", bandId).eq("is_equipped", true),
      ]);

      const chemistry = bandResult.data?.chemistry || 50;
      const gearItems = gearResult.data || [];
      const gearQuality = gearItems.length > 0
        ? gearItems.reduce((acc: number, item: any) => acc + (item.equipment?.quality_rating || 50), 0) / gearItems.length
        : 50;

      return { chemistry, gearQuality, fame: bandResult.data?.fame || 0 };
    },
    enabled: !!bandId,
  });

  // Fetch song familiarity
  const { data: familiarityData } = useQuery({
    queryKey: ["song-familiarity", bandId],
    queryFn: async () => {
      if (!bandId) return 50;

      const { data } = await (supabase as any)
        .from("band_song_familiarity")
        .select("familiarity_percentage")
        .eq("band_id", bandId);

      if (!data || data.length === 0) return 50;

      return data.reduce((acc: number, f: any) => acc + (f.familiarity_percentage || 0), 0) / data.length;
    },
    enabled: !!bandId,
  });

  const startPerformance = useCallback(() => {
    setIsPerforming(true);
    setCurrentPhase(0);
    setCrowdEnergy(50);
    setCrowdEnergyHistory([50]);
    setEventResponses([]);
    setPendingEvent(null);
  }, []);

  const advancePhase = useCallback(() => {
    if (currentPhase < PERFORMANCE_PHASES.length - 1) {
      setCurrentPhase((prev) => prev + 1);

      // Random chance for an event each phase
      if (Math.random() < 0.4) {
        const eventTemplate = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        setPendingEvent({
          ...eventTemplate,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        });
      }

      // Crowd energy naturally fluctuates
      const fluctuation = (Math.random() - 0.5) * 20;
      const newEnergy = Math.min(100, Math.max(0, crowdEnergy + fluctuation));
      setCrowdEnergy(newEnergy);
      setCrowdEnergyHistory((prev) => [...prev, newEnergy]);
    }
  }, [currentPhase, crowdEnergy]);

  const handleEventResponse = useCallback((score: number) => {
    setEventResponses((prev) => [...prev, score]);
    setPendingEvent(null);

    // Event response affects crowd energy
    const energyChange = (score - 50) / 2;
    const newEnergy = Math.min(100, Math.max(0, crowdEnergy + energyChange));
    setCrowdEnergy(newEnergy);
    setCrowdEnergyHistory((prev) => [...prev, newEnergy]);
  }, [crowdEnergy]);

  const adjustCrowdEnergy = useCallback((delta: number) => {
    const newEnergy = Math.min(100, Math.max(0, crowdEnergy + delta));
    setCrowdEnergy(newEnergy);
    setCrowdEnergyHistory((prev) => [...prev, newEnergy]);
  }, [crowdEnergy]);

  // Complete performance and save results
  const completePerformance = useMutation({
    mutationFn: async () => {
      const avgEventScore = eventResponses.length > 0
        ? eventResponses.reduce((a, b) => a + b, 0) / eventResponses.length
        : 70;

      const metrics: PerformanceMetrics = {
        songFamiliarity: familiarityData || 50,
        gearQuality: bandData?.gearQuality || 50,
        bandChemistry: bandData?.chemistry || 50,
        setlistFlow: 70 + (Math.random() * 20), // Simulate setlist scoring
        crowdManagement: (crowdEnergyHistory.reduce((a, b) => a + b, 0) / crowdEnergyHistory.length),
        eventResponses: avgEventScore,
      };

      const performanceScore = calculatePerformanceScore(metrics);
      const review = generateReview(performanceScore);

      const crowdEnergyPeak = Math.max(...crowdEnergyHistory);
      const crowdEnergyAvg = Math.round(crowdEnergyHistory.reduce((a, b) => a + b, 0) / crowdEnergyHistory.length);

      // Calculate rewards based on performance
      const basePayment = 5000;
      const baseFame = 500;
      const paymentMultiplier = 1 + (performanceScore / 100);
      const fameMultiplier = 1 + (performanceScore / 50);

      const result: PerformanceResult = {
        performanceScore,
        crowdEnergyPeak,
        crowdEnergyAvg,
        paymentEarned: Math.round(basePayment * paymentMultiplier),
        fameEarned: Math.round(baseFame * fameMultiplier),
        merchRevenue: Math.round(1000 * (performanceScore / 50) * (crowdEnergyAvg / 50)),
        newFansGained: Math.round(100 * fameMultiplier),
        criticScore: review.criticScore,
        fanScore: review.fanScore,
        reviewHeadline: review.headline,
        reviewSummary: review.summary,
        highlights: eventResponses.filter((s) => s >= 80).map(() => "Great crowd interaction!"),
      };

      // Save to festival_performance_history
      const { data: participation } = await (supabase as any)
        .from("festival_participants")
        .select("event_id, user_id, slot_type")
        .eq("id", participationId)
        .single();

      if (participation) {
        await (supabase as any).from("festival_performance_history").insert({
          participation_id: participationId,
          band_id: bandId,
          festival_id: participation.event_id,
          user_id: participation.user_id,
          performance_score: result.performanceScore,
          crowd_energy_peak: result.crowdEnergyPeak,
          crowd_energy_avg: result.crowdEnergyAvg,
          songs_performed: 8,
          payment_earned: result.paymentEarned,
          fame_earned: result.fameEarned,
          merch_revenue: result.merchRevenue,
          new_fans_gained: result.newFansGained,
          critic_score: result.criticScore,
          fan_score: result.fanScore,
          review_headline: result.reviewHeadline,
          review_summary: result.reviewSummary,
          highlight_moments: result.highlights,
          slot_type: participation.slot_type,
          performance_date: new Date().toISOString(),
        });

        // Update participant status to performed
        await (supabase as any)
          .from("festival_participants")
          .update({ status: "performed" })
          .eq("id", participationId);

        // Update band fame and balance
        if (bandId) {
          const { data: bandUpdate } = await (supabase as any)
            .from("bands")
            .select("fame, band_balance")
            .eq("id", bandId)
            .single();

          if (bandUpdate) {
            await (supabase as any)
              .from("bands")
              .update({
                fame: (bandUpdate.fame || 0) + result.fameEarned,
                band_balance: (bandUpdate.band_balance || 0) + result.paymentEarned + result.merchRevenue,
              })
              .eq("id", bandId);
          }
        }
      }

      setIsPerforming(false);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["festival-participations"] });
      queryClient.invalidateQueries({ queryKey: ["festival-performance-history"] });
      toast.success(`Performance Complete! Score: ${result.performanceScore}/100`);
    },
    onError: (error: any) => {
      toast.error("Failed to complete performance", { description: error.message });
    },
  });

  return {
    phases: PERFORMANCE_PHASES,
    currentPhase,
    currentPhaseData: PERFORMANCE_PHASES[currentPhase],
    crowdEnergy,
    crowdEnergyHistory,
    isPerforming,
    pendingEvent,
    startPerformance,
    advancePhase,
    handleEventResponse,
    adjustCrowdEnergy,
    completePerformance,
    isCompleting: completePerformance.isPending,
    performanceResult: completePerformance.data,
  };
}
