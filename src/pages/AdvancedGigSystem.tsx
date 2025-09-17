import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { applyEquipmentWear } from '@/utils/equipmentWear';
import { toast } from 'sonner';
import { Music, Zap, Heart, Star, TrendingUp, Volume2, Mic, AlertTriangle } from 'lucide-react';

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

const STAGE_FAILURE_THRESHOLD = 50;
const OVERALL_FAILURE_THRESHOLD = 60;
const FAILURE_EARNINGS_MULTIPLIER = 0.25;
const FAILURE_FAME_PENALTY = 15;

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
  const [performanceFailed, setPerformanceFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [failedStage, setFailedStage] = useState<string | null>(null);
  const [fameChange, setFameChange] = useState(0);
  const [penaltyAmount, setPenaltyAmount] = useState(0);

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
    setShowResults(false);
    setPerformanceFailed(false);
    setFailureReason(null);
    setFailedStage(null);
    setFameChange(0);
    setPenaltyAmount(0);
    setAudienceReaction({
      energy: 50,
      satisfaction: 50,
      excitement: 50,
      singing_along: 0
    });
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

    const updatedResults = [...stageResults, result];
    setStageResults(updatedResults);

    if (result.score < STAGE_FAILURE_THRESHOLD) {
      finishPerformance(updatedResults, {
        forcedFailure: true,
        failedStage: stage.name,
        failureReason: `${stage.name} score fell below ${STAGE_FAILURE_THRESHOLD}%. The promoter ended the show early.`
      });
      return;
    }

    // Move to next stage or finish performance
    if (stageIndex < PERFORMANCE_STAGES.length - 1) {
      setTimeout(() => {
        setCurrentStage(stageIndex + 1);
        setStageProgress(0);
        performStage(stageIndex + 1);
      }, 1500);
    } else {
      finishPerformance(updatedResults);
    }
  };

  const finishPerformance = async (
    results: StageResult[],
    options: { forcedFailure?: boolean; failureReason?: string; failedStage?: string } = {}
  ) => {
    if (!gig || !profile || !user || results.length === 0) return;

    const averageScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
    const baseEarnings = gig.payment || 1000;
    const potentialEarnings = Math.floor(baseEarnings * (averageScore / 100));

    const forcedFailure = options.forcedFailure ?? false;
    let derivedFailureReason = options.failureReason ?? '';
    const isFailure = forcedFailure || averageScore < OVERALL_FAILURE_THRESHOLD;

    if (isFailure && !derivedFailureReason) {
      derivedFailureReason = `Overall performance score fell below ${OVERALL_FAILURE_THRESHOLD}%. The crowd left disappointed.`;
    }

    const failureEarnings = Math.floor(baseEarnings * FAILURE_EARNINGS_MULTIPLIER);
    const totalEarningsValue = isFailure
      ? Math.min(potentialEarnings, failureEarnings)
      : potentialEarnings;
    const fameDelta = isFailure
      ? -FAILURE_FAME_PENALTY
      : Math.floor(averageScore * 0.5);
    const experienceGain = Math.floor(isFailure ? averageScore : averageScore * 2);
    const penaltyValue = isFailure ? Math.max(0, potentialEarnings - totalEarningsValue) : 0;

    setFinalScore(averageScore);
    setTotalEarnings(totalEarningsValue);
    setFameChange(fameDelta);
    setPenaltyAmount(penaltyValue);
    setPerformanceFailed(isFailure);
    setFailureReason(isFailure ? derivedFailureReason : null);
    setFailedStage(isFailure ? options.failedStage ?? null : null);

    try {
      const updatedFame = Math.max(0, profile.fame + fameDelta);
      const attendance = Math.floor(gig.venue.capacity * Math.max(averageScore, 10) / 100);
      await supabase
        .from('gigs')
        .update({
          status: isFailure ? 'failed' : 'completed',
          attendance,
          fan_gain: fameDelta > 0 ? fameDelta : 0
        })
        .eq('id', gig.id);

      await updateProfile({
        cash: profile.cash + totalEarningsValue,
        experience: profile.experience + experienceGain,
        fame: updatedFame
      });

      await supabase.from('gig_performances').insert({
        user_id: user.id,
        gig_id: gig.id,
        performance_score: Math.round(averageScore),
        earnings: totalEarningsValue,
        fame_change: fameDelta,
        status: isFailure ? 'failed' : 'completed',
        penalty_applied: isFailure,
        penalty_amount: penaltyValue,
        failure_reason: isFailure ? derivedFailureReason : null
      });

      const activityMessage = isFailure
        ? `Performance at ${gig.venue.name} fell flat (${averageScore.toFixed(1)}%). Lost ${Math.abs(fameDelta)} fame.`
        : `Performed at ${gig.venue.name} - Score: ${averageScore.toFixed(1)}%`;

      await addActivity('gig_performance', activityMessage, totalEarningsValue);

      try {
        const wearSummary = await applyEquipmentWear(user.id, 'gig');
        if (wearSummary?.updates.length) {
          toast.info('Your equipment took some wear after the show. Check your inventory to keep it in top shape.');
        }
      } catch (wearError) {
        console.error('Failed to apply equipment wear after gig performance', wearError);
      }
    } catch (error: any) {
      console.error('Error finishing performance:', error);
      toast.error('Failed to save performance results');
    } finally {
      setIsPerforming(false);
      setShowResults(true);
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
              {performanceFailed ? (
                <AlertTriangle className="w-6 h-6 text-destructive" />
              ) : (
                <Star className="w-6 h-6" />
              )}
              {performanceFailed ? 'Performance Failed' : 'Performance Complete!'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {performanceFailed && failureReason && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
                {failureReason}
                {failedStage && (
                  <div className="mt-1 text-destructive/80">
                    The {failedStage} stage needs serious attention before your next gig.
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${performanceFailed ? 'text-destructive' : 'text-primary'}`}>
                  {finalScore.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${performanceFailed ? 'text-destructive' : 'text-green-500'}`}>
                  ${totalEarnings}
                </div>
                <div className="text-sm text-muted-foreground">
                  {performanceFailed ? 'Reduced Payout' : 'Earnings'}
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`text-3xl font-bold ${fameChange >= 0 ? 'text-blue-500' : 'text-destructive'}`}
                >
                  {fameChange >= 0 ? `+${fameChange}` : fameChange}
                </div>
                <div className="text-sm text-muted-foreground">
                  {fameChange >= 0 ? 'Fans Gained' : 'Fame Lost'}
                </div>
              </div>
            </div>

            {performanceFailed && penaltyAmount > 0 && (
              <div className="text-center p-4 bg-muted rounded-md">
                <div className="text-sm text-muted-foreground">Earnings Penalty</div>
                <div className="text-2xl font-semibold text-destructive">-${penaltyAmount}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Missed bonus pay due to the failed performance.
                </div>
              </div>
            )}

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
                    {performanceFailed && failedStage === result.stageName && (
                      <div className="mt-3 text-sm text-destructive">
                        This stage triggered the failed gig outcome.
                      </div>
                    )}
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
                    <Badge variant={result.score >= 80 ? "default" : result.score >= 60 ? "secondary" : "destructive"}>
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