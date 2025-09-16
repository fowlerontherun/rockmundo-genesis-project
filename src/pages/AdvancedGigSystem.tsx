import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGameData } from '@/hooks/useGameData';
import { applyEquipmentWear } from '@/utils/equipmentWear';
import { toast } from 'sonner';
import { Music, Users, Zap, Heart, Star, TrendingUp, Volume2, Mic } from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  capacity: number;
  prestige_level: number;
}

interface Gig {
  id: string;
  venue: Venue;
  scheduled_date: string;
  payment: number;
  status: string;
}

interface PerformanceStage {
  name: string;
  description: string;
  duration: number;
  skillRequirements: Record<string, number>;
}

interface AudienceReaction {
  energy: number;
  satisfaction: number;
  excitement: number;
  singing_along: number;
}

interface StageResult {
  stageName: string;
  score: number;
  audienceReaction: AudienceReaction;
  feedback: string[];
  bonuses: string[];
}

const PERFORMANCE_STAGES: PerformanceStage[] = [
  {
    name: "Sound Check",
    description: "Getting the technical setup right",
    duration: 3000,
    skillRequirements: { performance: 30, guitar: 25 }
  },
  {
    name: "Opening Act",
    description: "Warming up the crowd",
    duration: 4000,
    skillRequirements: { performance: 40, vocals: 35 }
  },
  {
    name: "Main Performance",
    description: "The heart of the show",
    duration: 6000,
    skillRequirements: { performance: 50, songwriting: 40, vocals: 45 }
  },
  {
    name: "Encore",
    description: "Leaving them wanting more",
    duration: 3000,
    skillRequirements: { performance: 60, guitar: 50, drums: 40 }
  }
];

const AdvancedGigSystem: React.FC = () => {
  const { gigId } = useParams<{ gigId: string }>();
  const { user } = useAuth();
  const { profile, skills, updateProfile, addActivity } = useGameData();
  const navigate = useNavigate();

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPerforming, setIsPerforming] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);
  const [audienceReaction, setAudienceReaction] = useState<AudienceReaction>({
    energy: 50,
    satisfaction: 50,
    excitement: 50,
    singing_along: 0
  });
  const [showResults, setShowResults] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);

  useEffect(() => {
    if (gigId && user) {
      loadGig();
    }
  }, [gigId, user]);

  const loadGig = async () => {
    if (!gigId) return;

    try {
      setLoading(true);
      const { data: gigData, error: gigError } = await supabase
        .from('gigs')
        .select('*')
        .eq('id', gigId)
        .single();

      if (gigError) throw gigError;

      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .select('*')
        .eq('id', gigData.venue_id)
        .single();

      if (venueError) throw venueError;
      
      const transformedGig = {
        ...gigData,
        venue: {
          id: venueData.id,
          name: venueData.name,
          capacity: venueData.capacity,
          prestige_level: venueData.prestige_level
        }
      };
      
      setGig(transformedGig);
    } catch (error: any) {
      console.error('Error loading gig:', error);
      toast.error('Failed to load gig details');
    } finally {
      setLoading(false);
    }
  };

  const startPerformance = () => {
    setIsPerforming(true);
    setCurrentStage(0);
    setStageProgress(0);
    setStageResults([]);
    performStage(0);
  };

  const performStage = async (stageIndex: number) => {
    const stage = PERFORMANCE_STAGES[stageIndex];
    const stageDuration = stage.duration;
    const interval = stageDuration / 100;

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 1;
      setStageProgress(progress);

      // Simulate real-time audience reaction
      if (progress % 10 === 0) {
        updateAudienceReaction(stageIndex, progress);
      }

      if (progress >= 100) {
        clearInterval(progressInterval);
        completeStage(stageIndex);
      }
    }, interval);
  };

  const updateAudienceReaction = (stageIndex: number, progress: number) => {
    if (!skills || !gig) return;

    const stage = PERFORMANCE_STAGES[stageIndex];
    const skillLevel = Object.entries(stage.skillRequirements).reduce((avg, [skill, req]) => {
      const playerSkill = (skills as any)[skill] || 0;
      return avg + (playerSkill / req);
    }, 0) / Object.keys(stage.skillRequirements).length;

    const venuePrestige = gig.venue.prestige_level;
    const baseReaction = Math.min(100, skillLevel * 80 + Math.random() * 20);
    
    setAudienceReaction(prev => ({
      energy: Math.max(0, Math.min(100, baseReaction + (progress * 0.2) - (venuePrestige * 5))),
      satisfaction: Math.max(0, Math.min(100, baseReaction + Math.random() * 20 - 10)),
      excitement: Math.max(0, Math.min(100, baseReaction + (progress * 0.3))),
      singing_along: Math.max(0, Math.min(100, (progress > 50 ? baseReaction * 0.8 : 0)))
    }));
  };

  const completeStage = (stageIndex: number) => {
    if (!skills || !gig) return;

    const stage = PERFORMANCE_STAGES[stageIndex];
    
    // Calculate stage score based on skills vs requirements
    let stageScore = 0;
    const feedback: string[] = [];
    const bonuses: string[] = [];

    Object.entries(stage.skillRequirements).forEach(([skill, requirement]) => {
      const playerSkill = (skills as any)[skill] || 0;
      const skillRatio = playerSkill / requirement;
      stageScore += skillRatio * 25;

      if (skillRatio >= 1.5) {
        feedback.push(`Exceptional ${skill} performance!`);
        bonuses.push(`+20% ${skill} bonus`);
      } else if (skillRatio >= 1.0) {
        feedback.push(`Great ${skill} work!`);
      } else if (skillRatio >= 0.7) {
        feedback.push(`Decent ${skill} performance`);
      } else {
        feedback.push(`${skill} needs improvement`);
      }
    });

    // Add audience reaction bonus
    const reactionBonus = (audienceReaction.energy + audienceReaction.satisfaction) / 10;
    stageScore += reactionBonus;

    if (audienceReaction.energy > 80) bonuses.push("High Energy Bonus!");
    if (audienceReaction.singing_along > 60) bonuses.push("Crowd Participation Bonus!");

    const result: StageResult = {
      stageName: stage.name,
      score: Math.min(100, stageScore),
      audienceReaction: { ...audienceReaction },
      feedback,
      bonuses
    };

    setStageResults(prev => [...prev, result]);

    // Move to next stage or finish performance
    if (stageIndex < PERFORMANCE_STAGES.length - 1) {
      setTimeout(() => {
        setCurrentStage(stageIndex + 1);
        setStageProgress(0);
        performStage(stageIndex + 1);
      }, 1500);
    } else {
      finishPerformance();
    }
  };

  const finishPerformance = async () => {
    if (!gig || !profile || !user) return;

    const averageScore = stageResults.reduce((sum, result) => sum + result.score, 0) / stageResults.length;
    const baseEarnings = gig.payment || 1000;
    const scoreMultiplier = averageScore / 100;
    const totalEarnings = Math.floor(baseEarnings * scoreMultiplier);
    const experienceGain = Math.floor(averageScore * 2);
    const fanGain = Math.floor(averageScore * 0.5);

    setFinalScore(averageScore);
    setTotalEarnings(totalEarnings);

    try {
      // Update gig status
      await supabase
        .from('gigs')
        .update({
          status: 'completed',
          attendance: Math.floor(gig.venue.capacity * (averageScore / 100)),
          fan_gain: fanGain
        })
        .eq('id', gig.id);

      // Update player profile
      await updateProfile({
        cash: profile.cash + totalEarnings,
        experience: profile.experience + experienceGain,
        fame: profile.fame + fanGain
      });

      // Add activity
      await addActivity(
        'gig_performance',
        `Performed at ${gig.venue.name} - Score: ${averageScore.toFixed(1)}%`,
        totalEarnings
      );

      try {
        const wearSummary = await applyEquipmentWear(user.id, 'gig');
        if (wearSummary?.updates.length) {
          toast.info('Your equipment took some wear after the show. Check your inventory to keep it in top shape.');
        }
      } catch (wearError) {
        console.error('Failed to apply equipment wear after gig performance', wearError);
      }

      setIsPerforming(false);
      setShowResults(true);
    } catch (error: any) {
      console.error('Error finishing performance:', error);
      toast.error('Failed to save performance results');
    }
  };

  const getReactionColor = (value: number) => {
    if (value >= 80) return 'text-green-500';
    if (value >= 60) return 'text-yellow-500';
    if (value >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'energy': return <Zap className="w-4 h-4" />;
      case 'satisfaction': return <Heart className="w-4 h-4" />;
      case 'excitement': return <TrendingUp className="w-4 h-4" />;
      case 'singing_along': return <Volume2 className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Gig Not Found</h2>
        <Button onClick={() => navigate('/gigs')}>Back to Gigs</Button>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-6 h-6" />
              Performance Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{finalScore.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">${totalEarnings}</div>
                <div className="text-sm text-muted-foreground">Earnings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{Math.floor(finalScore * 0.5)}</div>
                <div className="text-sm text-muted-foreground">Fans Gained</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Stage Breakdown</h3>
              {stageResults.map((result, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{result.stageName}</h4>
                      <Badge variant={result.score >= 80 ? "default" : result.score >= 60 ? "secondary" : "destructive"}>
                        {result.score.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium mb-1">Feedback:</div>
                        <ul className="space-y-1">
                          {result.feedback.map((feedback, i) => (
                            <li key={i} className="text-muted-foreground">• {feedback}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium mb-1">Bonuses:</div>
                        <ul className="space-y-1">
                          {result.bonuses.map((bonus, i) => (
                            <li key={i} className="text-green-600">• {bonus}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-4">
              <Button onClick={() => navigate('/gigs')} className="flex-1">
                Book Another Gig
              </Button>
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="flex-1">
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isPerforming) {
    const currentStageData = PERFORMANCE_STAGES[currentStage];
    
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-6 h-6" />
              {currentStageData.name}
            </CardTitle>
            <p className="text-muted-foreground">{currentStageData.description}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Stage Progress</span>
                <span className="text-sm text-muted-foreground">{stageProgress}%</span>
              </div>
              <Progress value={stageProgress} className="h-3" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(audienceReaction).map(([key, value]) => (
                <Card key={key}>
                  <CardContent className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {getReactionIcon(key)}
                      <span className="text-sm font-medium capitalize">
                        {key.replace('_', ' ')}
                      </span>
                    </div>
                    <div className={`text-2xl font-bold ${getReactionColor(value)}`}>
                      {Math.round(value)}%
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center">
              <div className="text-lg font-medium mb-2">
                Stage {currentStage + 1} of {PERFORMANCE_STAGES.length}
              </div>
              <div className="flex justify-center gap-2">
                {PERFORMANCE_STAGES.map((_, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full ${
                      index < currentStage
                        ? 'bg-green-500'
                        : index === currentStage
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            {stageResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Completed Stages:</h4>
                {stageResults.map((result, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">{result.stageName}</span>
                    <Badge variant={result.score >= 80 ? "default" : "secondary"}>
                      {result.score.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-6 h-6" />
            Advanced Performance System
          </CardTitle>
          <p className="text-muted-foreground">
            Experience multi-stage performances with real-time audience reactions
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Gig Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Venue:</span>
                  <span className="font-medium">{gig.venue.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacity:</span>
                  <span className="font-medium">{gig.venue.capacity} people</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prestige:</span>
                  <Badge variant="outline">{gig.venue.prestige_level}/5</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment:</span>
                  <span className="font-medium text-green-600">${gig.payment}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Performance Stages</h3>
              <div className="space-y-2">
                {PERFORMANCE_STAGES.map((stage, index) => (
                  <div key={index} className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">{stage.name}</div>
                    <div className="text-sm text-muted-foreground">{stage.description}</div>
                    <div className="flex gap-2 mt-1">
                      {Object.entries(stage.skillRequirements).map(([skill, level]) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}: {level}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button 
              onClick={startPerformance} 
              size="lg"
              className="w-full md:w-auto"
            >
              <Music className="w-4 h-4 mr-2" />
              Start Advanced Performance
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedGigSystem;