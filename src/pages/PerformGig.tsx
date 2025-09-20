import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Music, DollarSign, Users, Star, Play, TrendingUp, Calendar, MapPin } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type GigWithVenue = Database['public']['Tables']['gigs']['Row'] & {
  venues: Database['public']['Tables']['venues']['Row'] | null;
};

interface PerformanceStageConfig {
  name: string;
  duration: number; // in seconds
  description: string;
  weight: number; // impact on overall performance
}

const STAGE_PRESETS: Record<string, PerformanceStageConfig[]> = {
  concert: [
    { name: "Sound Check", duration: 3, description: "Setting up equipment and checking audio", weight: 0.15 },
    { name: "Opening", duration: 4, description: "First impression and crowd warm-up", weight: 0.25 },
    { name: "Main Set", duration: 8, description: "Core performance with main songs", weight: 0.45 },
    { name: "Encore", duration: 3, description: "Final impression and crowd send-off", weight: 0.15 }
  ],
  festival: [
    { name: "Stage Setup", duration: 2, description: "Quick setup in festival environment", weight: 0.1 },
    { name: "High Energy Opening", duration: 3, description: "Grabbing festival crowd attention", weight: 0.3 },
    { name: "Festival Set", duration: 6, description: "Condensed high-energy performance", weight: 0.6 }
  ],
  private: [
    { name: "Intimate Setup", duration: 2, description: "Personal connection with small audience", weight: 0.2 },
    { name: "Personal Performance", duration: 8, description: "Close, personal musical experience", weight: 0.8 }
  ],
  street: [
    { name: "Crowd Gathering", duration: 5, description: "Attracting passersby with music", weight: 0.4 },
    { name: "Street Performance", duration: 10, description: "Energetic busking performance", weight: 0.6 }
  ]
};

const SHOW_TYPE_RESULT_MODIFIERS: Record<string, { payment: number; fanGain: number; experience: number }> = {
  concert: { payment: 1.0, fanGain: 1.0, experience: 1.0 },
  festival: { payment: 1.5, fanGain: 2.0, experience: 1.3 },
  private: { payment: 0.8, fanGain: 0.3, experience: 0.7 },
  street: { payment: 0.2, fanGain: 0.8, experience: 0.5 }
};

const getStagePreset = (showType: string): PerformanceStageConfig[] => {
  return STAGE_PRESETS[showType] || STAGE_PRESETS.concert;
};

export default function PerformGig() {
  const { gigId } = useParams<{ gigId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, skills, attributes } = useGameData();
  const { toast } = useToast();

  const [gig, setGig] = useState<GigWithVenue | null>(null);
  const [isPerforming, setIsPerforming] = useState(false);
  const [stageSequence, setStageSequence] = useState<PerformanceStageConfig[]>([]);
  const [currentShowType, setCurrentShowType] = useState<string>('concert');
  const [performance, setPerformance] = useState({
    crowd_energy: 50,
    technical_skill: 50,
    stage_presence: 50
  });
  const [performanceStage, setPerformanceStage] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [fanGain, setFanGain] = useState(0);
  const [experienceGain, setExperienceGain] = useState(0);

  const loadGig = useCallback(async () => {
    if (!gigId || !user) return;

    try {
      const { data, error } = await supabase
        .from('gigs')
        .select(`
          *,
          venues (*)
        `)
        .eq('id', gigId)
        .single();

      if (error) {
        console.error('Error loading gig:', error);
        toast({
          title: "Error",
          description: "Failed to load gig details",
          variant: "destructive"
        });
        navigate('/gig-booking');
        return;
      }

      if (data) {
        const showType = data.show_type ?? 'concert';
        setGig(data);
        setCurrentShowType(showType);
        setStageSequence(getStagePreset(showType));
      }
    } catch (error) {
      console.error('Unexpected error loading gig:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
      navigate('/gig-booking');
    }
  }, [gigId, user, navigate, toast]);


  useEffect(() => {
    void loadGig();
  }, [loadGig]);

  const startPerformance = async () => {
    if (!stageSequence.length) return;
    
    setIsPerforming(true);
    setPerformanceStage(0);
    
    let currentPerformance = { ...performance };
    
    for (let i = 0; i < stageSequence.length; i++) {
      setPerformanceStage(i);
      const stage = stageSequence[i];
      
      // Simulate stage duration (shortened for demo)
      await new Promise(resolve => setTimeout(resolve, stage.duration * 500));
      
      // Update performance metrics based on stage and show type
      const crowdBonus = Math.random() * 20 - 10; // -10 to +10
      const techBonus = Math.random() * 20 - 10;
      const presenceBonus = Math.random() * 20 - 10;
      
      currentPerformance = {
        crowd_energy: Math.max(0, Math.min(100, currentPerformance.crowd_energy + crowdBonus)),
        technical_skill: Math.max(0, Math.min(100, currentPerformance.technical_skill + techBonus)),
        stage_presence: Math.max(0, Math.min(100, currentPerformance.stage_presence + presenceBonus))
      };
      
      setPerformance(currentPerformance);
    }
    
    setIsPerforming(false);
    await calculateResults(currentPerformance);
  };

  const calculateResults = async (finalPerformance: typeof performance) => {
    if (!gig || !profile || !skills) return;

    // Calculate overall performance score (0-100)
    const avgPerformance = (
      finalPerformance.crowd_energy + 
      finalPerformance.technical_skill + 
      finalPerformance.stage_presence
    ) / 3;

    // Apply skill bonuses
    const skillBonus = (skills.performance || 0) / 100 * 20; // Max 20% bonus
    const finalScore = Math.min(100, avgPerformance + skillBonus);

    // Get modifiers for show type
    const modifiers = SHOW_TYPE_RESULT_MODIFIERS[currentShowType];

    // Calculate earnings based on venue payment, performance score, and show type
    const basePayment = gig.venues?.base_payment ?? gig.payment ?? 1000;
    const performanceMultiplier = 0.5 + (finalScore / 100) * 1.0; // 50% to 150% of base
    const calculatedEarnings = Math.round(basePayment * performanceMultiplier * modifiers.payment);

    // Calculate fan gain based on venue capacity and performance
    const venueCapacity = gig.venues?.capacity ?? 100;
    const baseFanGain = Math.round(venueCapacity * 0.01 * (finalScore / 100));
    const calculatedFanGain = Math.round(baseFanGain * modifiers.fanGain);

    // Calculate experience gain
    const baseXp = 100;
    const calculatedXpGain = Math.round(baseXp * (finalScore / 100) * modifiers.experience);

    setEarnings(calculatedEarnings);
    setFanGain(calculatedFanGain);
    setExperienceGain(calculatedXpGain);

    try {
      // Update gig status to completed
      await supabase
        .from('gigs')
        .update({ 
          status: 'completed',
          attendance: Math.round(venueCapacity * (finalScore / 100) * 0.8),
          fan_gain: calculatedFanGain
        })
        .eq('id', gig.id);

      // Update player profile with earnings and fans
      const newCash = (profile.cash || 0) + calculatedEarnings;
      const newFame = (profile.fame || 0) + calculatedFanGain;
      
      await supabase
        .from('profiles')
        .update({
          cash: newCash,
          fame: newFame
        })
        .eq('id', profile.id);

      // Add activity to feed
      await supabase
        .from('activity_feed')
        .insert({
          user_id: user.id,
          profile_id: profile.id,
          activity_type: 'gig_performance',
          message: `Performed at ${gig.venues?.name ?? 'a venue'} and earned $${calculatedEarnings.toLocaleString()}`,
          earnings: calculatedEarnings,
          metadata: {
            venue_name: gig.venues?.name ?? 'Unknown Venue',
            performance_score: Math.round(finalScore),
            show_type: currentShowType,
            fan_gain: calculatedFanGain
          }
        });

      setShowResults(true);

      toast({
        title: "Performance Complete!",
        description: `You earned $${calculatedEarnings.toLocaleString()} and gained ${calculatedFanGain} fans!`
      });

    } catch (error) {
      console.error('Error updating performance results:', error);
      toast({
        title: "Error",
        description: "Failed to save performance results",
        variant: "destructive"
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { label: 'Legendary', variant: 'default' as const };
    if (score >= 80) return { label: 'Excellent', variant: 'default' as const };
    if (score >= 70) return { label: 'Great', variant: 'secondary' as const };
    if (score >= 60) return { label: 'Good', variant: 'secondary' as const };
    return { label: 'Needs Work', variant: 'destructive' as const };
  };

  if (!gig) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading gig details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const venueName = gig.venues?.name ?? 'Unknown Venue';
  const displayCapacity = gig.venues?.capacity ?? 'N/A';
  const prestigeDisplay =
    gig.venues?.prestige_level != null ? `${gig.venues.prestige_level}/10` : 'N/A';
  const displayBasePayment = gig.venues?.base_payment ?? gig.payment;
  const basePaymentDisplay =
    displayBasePayment != null ? `$${displayBasePayment.toLocaleString()}` : 'N/A';
  const displayLocation = gig.venues?.location ?? 'N/A';

  if (showResults) {
    const avgScore = (performance.crowd_energy + performance.technical_skill + performance.stage_presence) / 3;
    const scoreBadge = getScoreBadge(avgScore);

    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Performance Complete!</h1>
          <Badge variant={scoreBadge.variant} className="text-lg px-4 py-2">
            {scoreBadge.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>
                {avgScore.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${earnings.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Fans</CardTitle>
              <Users className="h-4 w-4 text-pink-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-600">
                +{fanGain}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Experience</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                +{experienceGain} XP
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Performance Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Crowd Energy</span>
                <span className={getScoreColor(performance.crowd_energy)}>{performance.crowd_energy.toFixed(1)}%</span>
              </div>
              <Progress value={performance.crowd_energy} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Technical Skill</span>
                <span className={getScoreColor(performance.technical_skill)}>{performance.technical_skill.toFixed(1)}%</span>
              </div>
              <Progress value={performance.technical_skill} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Stage Presence</span>
                <span className={getScoreColor(performance.stage_presence)}>{performance.stage_presence.toFixed(1)}%</span>
              </div>
              <Progress value={performance.stage_presence} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button onClick={() => navigate('/dashboard')} size="lg">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isPerforming) {
    const currentStage = stageSequence[performanceStage];
    const progress = ((performanceStage + 1) / stageSequence.length) * 100;

    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Performing at {venueName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold">{currentStage?.name}</h3>
              <p className="text-muted-foreground">{currentStage?.description}</p>
            </div>

            <Progress value={progress} className="h-4" />
            
            <div className="text-center text-sm text-muted-foreground">
              Stage {performanceStage + 1} of {stageSequence.length}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Crowd Energy</span>
                  <span>{performance.crowd_energy.toFixed(1)}%</span>
                </div>
                <Progress value={performance.crowd_energy} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Technical Skill</span>
                  <span>{performance.technical_skill.toFixed(1)}%</span>
                </div>
                <Progress value={performance.technical_skill} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Stage Presence</span>
                  <span>{performance.stage_presence.toFixed(1)}%</span>
                </div>
                <Progress value={performance.stage_presence} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Perform Gig</h1>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {currentShowType}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {venueName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Capacity</p>
              <p className="font-semibold">{displayCapacity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prestige</p>
              <p className="font-semibold">{prestigeDisplay}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Base Payment</p>
              <p className="font-semibold">{basePaymentDisplay}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-semibold">{displayLocation}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Scheduled Date</p>
            <p className="font-semibold">{new Date(gig.scheduled_date).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stage Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stageSequence.map((stage, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-medium">{stage.name}</h4>
                  <p className="text-sm text-muted-foreground">{stage.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{stage.duration}s</p>
                  <p className="text-sm font-medium">{(stage.weight * 100).toFixed(0)}% weight</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={startPerformance} size="lg" disabled={isPerforming}>
          <Play className="h-4 w-4 mr-2" />
          Start Performance
        </Button>
      </div>
    </div>
  );
}