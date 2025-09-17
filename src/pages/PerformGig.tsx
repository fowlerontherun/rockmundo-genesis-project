import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { calculateFanGain, calculateGigPayment, type PerformanceAttributeBonuses } from '@/utils/gameBalance';
import { resolveAttributeValue } from '@/utils/attributeModifiers';
import {
  Music,
  Users,
  Star,
  DollarSign,
  Clock,
  Zap,
  Heart,
  Trophy
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

interface Venue {
  name: string;
  capacity: number;
  prestige_level: number;
}

type ShowType = Database['public']['Enums']['show_type'];
const DEFAULT_SHOW_TYPE: ShowType = 'standard';

interface PerformanceStageConfig {
  name: string;
  description: string;
  duration: number;
}

const STAGE_PRESETS: Record<ShowType, PerformanceStageConfig[]> = {
  standard: [
    { name: 'Opening Song', description: 'Kick off the show with energy and amplification', duration: 2000 },
    { name: 'Getting the Crowd Going', description: 'Build hype with the full band sound', duration: 3000 },
    { name: 'Main Set', description: 'Full production and lighting cues', duration: 4000 },
    { name: 'Encore', description: 'High-energy finale to leave an impression', duration: 2000 },
  ],
  acoustic: [
    { name: 'Tuning & Warmth', description: 'Dial in the acoustic tones and connect with the room', duration: 1800 },
    { name: 'Storytelling Interlude', description: 'Share intimate stories between stripped-down songs', duration: 2600 },
    { name: 'Unplugged Spotlight', description: 'Showcase vocals and dynamics in a quieter setting', duration: 3200 },
    { name: 'Singalong Finale', description: 'Invite the crowd into a gentle encore', duration: 2000 },
  ],
};

const SHOW_TYPE_RESULT_MODIFIERS: Record<ShowType, { payment: number; fan: number; experience: number }> = {
  standard: { payment: 1, fan: 1, experience: 1 },
  acoustic: { payment: 1, fan: 1.3, experience: 1.15 },
};

const getStagePreset = (showType: ShowType) => STAGE_PRESETS[showType] ?? STAGE_PRESETS[DEFAULT_SHOW_TYPE];

interface Gig {
  id: string;
  venue: Venue;
  scheduled_date: string;
  payment: number;
  status: string;
  show_type: ShowType;
}

type GigRow = Database['public']['Tables']['gigs']['Row'];
type VenueRow = Database['public']['Tables']['venues']['Row'];
type GigWithVenue = GigRow & { venues: VenueRow | null };

interface PerformanceMetrics {
  crowd_energy: number;
  technical_skill: number;
  stage_presence: number;
  overall_score: number;
}

const PerformGig = () => {
  const { gigId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, skills, attributes, addActivity } = useGameData();
  const { toast } = useToast();
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  
  const [gig, setGig] = useState<Gig | null>(null);
  const [isPerforming, setIsPerforming] = useState(false);
  const [stageSequence, setStageSequence] = useState<PerformanceStageConfig[]>(getStagePreset(DEFAULT_SHOW_TYPE));
  const [currentShowType, setCurrentShowType] = useState<ShowType>(DEFAULT_SHOW_TYPE);
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    crowd_energy: 0,
    technical_skill: 0,
    stage_presence: 0,
    overall_score: 0
  });
  const [performanceStage, setPerformanceStage] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [fanGain, setFanGain] = useState(0);
  const [experienceGain, setExperienceGain] = useState(0);
  const attributeBonuses = useMemo<PerformanceAttributeBonuses>(() => {
    const source = attributes as unknown as Record<string, unknown> | null;
    return {
      stagePresence: resolveAttributeValue(source, 'stage_presence', 1),
      crowdEngagement: resolveAttributeValue(source, 'crowd_engagement', 1),
      socialReach: resolveAttributeValue(source, 'social_reach', 1),
    };
  }, [attributes]);

  const loadGig = useCallback(async (): Promise<void> => {
    if (!gigId) return;

    try {
      const { data, error } = await supabase
        .from('gigs')
        .select(`
          *,
          venues!gigs_venue_id_fkey(name, capacity, prestige_level)
        `)
        .eq('id', gigId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Gig not found');

      const gigData: GigWithVenue = data;
      const venueData = gigData.venues;

      if (!venueData) throw new Error('Venue details not found');

      const showType = (gigData.show_type ?? DEFAULT_SHOW_TYPE) as ShowType;
      const transformedGig: Gig = {
        id: gigData.id,
        venue: {
          name: venueData.name,
          capacity: venueData.capacity ?? 0,
          prestige_level: venueData.prestige_level ?? 0
        },
        scheduled_date: gigData.scheduled_date,
        payment: gigData.payment ?? 0,
        status: gigData.status ?? 'scheduled',
        show_type: showType
      };

      setGig(transformedGig);
      setCurrentShowType(showType);
      setStageSequence(getStagePreset(showType));
    } catch (error: unknown) {
      const fallbackMessage = "Failed to load gig details";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading gig:', errorMessage, error);
      toastRef.current?.({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`
      });
    }
  }, [gigId]);

  useEffect(() => {
    loadGig();
  }, [loadGig]);

  const startPerformance = async () => {
    if (!stageSequence.length) return;

    setIsPerforming(true);
    setPerformanceStage(1);

    const skillProfile = currentShowType === 'acoustic'
      ? { baseSkill: [45, 70], crowd: [5, 18], presence: [18, 32] }
      : { baseSkill: [40, 70], crowd: [0, 22], presence: [25, 45] };

    for (let i = 0; i < stageSequence.length; i++) {
      const stage = stageSequence[i];
      setPerformanceStage(i + 1);
      await new Promise(resolve => setTimeout(resolve, stage.duration));

      const baseSkill = Math.random() * (skillProfile.baseSkill[1] - skillProfile.baseSkill[0]) + skillProfile.baseSkill[0];
      const crowdBonus = Math.random() * (skillProfile.crowd[1] - skillProfile.crowd[0]) + skillProfile.crowd[0];
      const stagePresence = Math.random() * (skillProfile.presence[1] - skillProfile.presence[0]) + skillProfile.presence[0];

      setPerformance((prev) => ({
        crowd_energy: Math.min(100, prev.crowd_energy + crowdBonus),
        technical_skill: Math.min(100, prev.technical_skill + baseSkill / 4),
        stage_presence: Math.min(100, prev.stage_presence + stagePresence / 4),
        overall_score: 0,
      }));
    }

    calculateResults();
  };

  const calculateResults = async () => {
    if (!gig || !user) return;

    const finalScore = (performance.crowd_energy + performance.technical_skill + performance.stage_presence) / 3;

    const modifiers = SHOW_TYPE_RESULT_MODIFIERS[currentShowType] ?? SHOW_TYPE_RESULT_MODIFIERS[DEFAULT_SHOW_TYPE];

    const performanceMultiplier = finalScore / 100;
    const attendanceResult = Math.max(
      1,
      Math.floor(gig.venue.capacity * performanceMultiplier * (currentShowType === 'acoustic' ? 0.8 : 1)),
    );
    const basePayment = Math.max(1, Math.floor((gig.payment || 500) * modifiers.payment));
    const successRatio = Math.min(Math.max(finalScore / 100, 0), 1);
    const baselinePayment = calculateGigPayment(
      basePayment,
      skills?.performance ?? finalScore,
      profile?.fame ?? 0,
      successRatio,
    );
    const adjustedPayment = calculateGigPayment(
      basePayment,
      skills?.performance ?? finalScore,
      profile?.fame ?? 0,
      successRatio,
      attributeBonuses,
    );
    const payoutAdjustment = baselinePayment > 0 ? adjustedPayment / baselinePayment : 1;
    const finalEarnings = Math.floor(basePayment * performanceMultiplier * payoutAdjustment);

    const baseFanGain = Math.floor(attendanceResult * 0.1 * modifiers.fan);
    const stagePresenceMetric = performance.stage_presence || finalScore;
    const baselineFanGain = calculateFanGain(
      Math.max(1, baseFanGain),
      skills?.performance ?? finalScore,
      stagePresenceMetric,
    );
    const adjustedFanGain = calculateFanGain(
      Math.max(1, baseFanGain),
      skills?.performance ?? finalScore,
      stagePresenceMetric,
      attributeBonuses,
    );
    const fanAdjustment = baselineFanGain > 0 ? adjustedFanGain / baselineFanGain : 1;
    const finalFanGain = Math.max(0, Math.round(baseFanGain * fanAdjustment));
    const expGain = Math.max(1, Math.floor((50 + (finalScore * 2) + (gig.venue.prestige_level * 10)) * modifiers.experience));

    setPerformance(prev => ({ ...prev, overall_score: finalScore }));
    setEarnings(finalEarnings);
    setFanGain(finalFanGain);
    setExperienceGain(expGain);

    // Update database
    try {
      // Update gig status and results
      await supabase
        .from('gigs')
        .update({
          status: 'completed',
          attendance: attendanceResult,
          fan_gain: Math.max(0, finalFanGain)
        })
        .eq('id', gigId);

      // Update player profile with earnings and experience
      const { data: profile } = await supabase
        .from('profiles')
        .select('cash, experience, fame')
        .eq('user_id', user.id)
        .single();

      if (profile?.id) {
        await supabase
          .from('profiles')
          .update({
            cash: profile.cash + finalEarnings,
            experience: profile.experience + expGain,
            fame: profile.fame + finalFanGain
          })
          .eq('id', profile.id);
      }

      // Add activity feed entry
      await addActivity(
        'gig_performed',
        `Performed at ${gig.venue.name} and earned $${finalEarnings}!`,
        finalEarnings,
        {
          venue: gig.venue.name,
          score: finalScore,
          fanGain: finalFanGain
        }
      );

    } catch (error: unknown) {
      const fallbackMessage = 'Failed to update performance results';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error updating performance results:', errorMessage, error);
    }

    setIsPerforming(false);
    setShowResults(true);
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
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showResults) {
    const scoreBadge = getScoreBadge(performance.overall_score);
    const showTypeLabel = currentShowType === 'acoustic' ? 'Acoustic Set' : 'Standard Show';

    return (
      <div className="min-h-screen bg-gradient-stage p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Performance Complete!
            </h1>
            <Badge variant={scoreBadge.variant} className="text-lg px-4 py-2">
              {scoreBadge.label}
            </Badge>
            <Badge
              variant="outline"
              className={`mx-auto border ${currentShowType === 'acoustic' ? 'bg-amber-500/10 text-amber-500 border-amber-500/40' : 'bg-blue-500/10 text-blue-500 border-blue-500/40'} text-xs uppercase tracking-wide`}
            >
              {showTypeLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
                <Star className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor(performance.overall_score)}`}>
                  {performance.overall_score.toFixed(1)}%
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
                <Heart className="h-4 w-4 text-pink-600" />
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
                <Trophy className="h-4 w-4 text-yellow-600" />
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

          <div className="flex justify-center gap-4">
            <Button onClick={() => navigate('/gigs')} variant="outline">
              Book Another Gig
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isPerforming) {
    const totalStages = Math.max(1, stageSequence.length);
    const progress = Math.min(100, (performanceStage / totalStages) * 100);
    const currentStage = stageSequence[performanceStage - 1];
    const showTypeLabel = currentShowType === 'acoustic' ? 'Acoustic Set' : 'Standard Show';

    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bebas tracking-wider">
              Live Performance at {gig.venue.name}
            </CardTitle>
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className={`mt-2 border ${currentShowType === 'acoustic' ? 'bg-amber-500/10 text-amber-500 border-amber-500/40' : 'bg-blue-500/10 text-blue-500 border-blue-500/40'} text-xs tracking-wide uppercase`}
              >
                {showTypeLabel}
              </Badge>
            </div>
            <CardDescription>
              {currentStage?.name ?? "Preparing..."}
            </CardDescription>
            {currentStage?.description && (
              <p className="text-xs text-muted-foreground mt-1">{currentStage.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={progress} className="h-4" />

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <p className="text-sm text-muted-foreground">Crowd Energy</p>
                <p className="text-xl font-bold">{performance.crowd_energy.toFixed(0)}%</p>
              </div>
              <div>
                <Music className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <p className="text-sm text-muted-foreground">Technical Skill</p>
                <p className="text-xl font-bold">{performance.technical_skill.toFixed(0)}%</p>
              </div>
              <div>
                <Users className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm text-muted-foreground">Stage Presence</p>
                <p className="text-xl font-bold">{performance.stage_presence.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stagePlan = stageSequence;
  const showTypeLabel = currentShowType === 'acoustic' ? 'Acoustic Set' : 'Standard Show';
  const estimatedMinutes = Math.max(1, Math.round(stagePlan.reduce((sum, stage) => sum + stage.duration, 0) / 60000));

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Ready to Perform
          </h1>
          <p className="text-muted-foreground font-oswald">Show them what you've got!</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              {gig.venue.name}
            </CardTitle>
            <CardDescription>
              {new Date(gig.scheduled_date).toLocaleDateString()} at {new Date(gig.scheduled_date).toLocaleTimeString()}
            </CardDescription>
            <Badge
              variant="outline"
              className={`mt-2 w-fit border ${currentShowType === 'acoustic' ? 'bg-amber-500/10 text-amber-500 border-amber-500/40' : 'bg-blue-500/10 text-blue-500 border-blue-500/40'} text-xs uppercase tracking-wide`}
            >
              {showTypeLabel}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <p className="text-sm text-muted-foreground">Capacity</p>
                <p className="text-xl font-bold">{gig.venue.capacity}</p>
              </div>
              <div className="text-center">
                <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <p className="text-sm text-muted-foreground">Prestige</p>
                <p className="text-xl font-bold">{gig.venue.prestige_level}/5</p>
              </div>
              <div className="text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm text-muted-foreground">Payment</p>
                <p className="text-xl font-bold">${gig.payment?.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-xl font-bold">~{estimatedMinutes} min</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Stage Plan</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                {stagePlan.map((stage, index) => (
                  <div key={`${stage.name}-${index}`} className="flex items-start gap-2">
                    <span className="font-medium text-foreground">Stage {index + 1}:</span>
                    <span className="text-left">{stage.name} — {stage.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <Button
                onClick={startPerformance}
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              >
                Start Performance
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PerformGig;