import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData, type PlayerSkills, type SkillDefinition, type SkillProgressRow } from '@/hooks/useGameData';
import { calculateFanGain, calculateGigPayment, type PerformanceAttributeBonuses } from '@/utils/gameBalance';
import { resolveAttributeValue } from '@/utils/attributeModifiers';
import { applyEquipmentWear } from '@/utils/equipmentWear';
import { toast } from '@/components/ui/sonner-toast';
import { Music, Zap, Heart, Star, TrendingUp, Volume2, Mic, AlertTriangle, Lock } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type GigRow = Database['public']['Tables']['gigs']['Row'];
type VenueRow = Database['public']['Tables']['venues']['Row'];
type ShowType = Database['public']['Enums']['show_type'];
const DEFAULT_SHOW_TYPE: ShowType = 'standard';

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
  show_type: ShowType;
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

interface StageSkillRequirementDetail {
  slug: string;
  skillName: string;
  requiredLevel: number;
  currentLevel: number;
  locked: boolean;
}

const STAGE_FAILURE_THRESHOLD = 50;
const OVERALL_FAILURE_THRESHOLD = 60;
const FAILURE_EARNINGS_MULTIPLIER = 0.25;
const FAILURE_FAME_PENALTY = 15;

const STAGE_PRESETS: Record<ShowType, PerformanceStage[]> = {
  standard: [
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
  ],
  acoustic: [
    {
      name: "Acoustic Tuning",
      description: "Dialing in warm, intimate tones",
      duration: 2600,
      skillRequirements: { performance: 28, guitar: 20, songwriting: 25 }
    },
    {
      name: "Storytelling",
      description: "Connecting with the crowd between stripped songs",
      duration: 3600,
      skillRequirements: { performance: 35, vocals: 38, songwriting: 35 }
    },
    {
      name: "Unplugged Spotlight",
      description: "Showcasing vocals and dynamic control",
      duration: 5000,
      skillRequirements: { performance: 45, vocals: 50, songwriting: 40 }
    },
    {
      name: "Gentle Encore",
      description: "Ending with a crowd singalong",
      duration: 2800,
      skillRequirements: { performance: 42, vocals: 45, piano: 30 }
    }
  ]
};

const SHOW_TYPE_BEHAVIOR: Record<ShowType, {
  earnings: number;
  fan: number;
  experience: number;
  audienceEase: number;
  stageTolerance: number;
}> = {
  standard: { earnings: 1, fan: 1, experience: 1, audienceEase: 1, stageTolerance: 0 },
  acoustic: { earnings: 1, fan: 1.25, experience: 1.2, audienceEase: 1.15, stageTolerance: 5 },
};

const ADVANCED_GIG_ATTRIBUTES: AttributeKey[] = ['stage_presence', 'musical_ability'];

const getPerformanceStages = (showType: ShowType) => STAGE_PRESETS[showType] ?? STAGE_PRESETS[DEFAULT_SHOW_TYPE];

const AdvancedGigSystem: React.FC = () => {
  const { gigId } = useParams<{ gigId: string }>();
  const { user } = useAuth();
  const {
    profile,
    skills,
    attributes,
    unlockedSkills,
    skillProgress,
    skillDefinitions,
    updateProfile,
    addActivity,
  } = useGameData();
  const navigate = useNavigate();

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPerforming, setIsPerforming] = useState(false);
  const [performanceStages, setPerformanceStages] = useState<PerformanceStage[]>(getPerformanceStages(DEFAULT_SHOW_TYPE));
  const [currentShowType, setCurrentShowType] = useState<ShowType>(DEFAULT_SHOW_TYPE);
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
  const lockedFailureRef = useRef<string | null>(null);

  const humanizeSkillSlug = useCallback((slug: string) => {
    return slug
      .split('_')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, []);

  const skillDefinitionMap = useMemo(() => {
    return skillDefinitions.reduce<Map<string, SkillDefinition>>((accumulator, definition) => {
      accumulator.set(definition.slug.toLowerCase(), definition);
      return accumulator;
    }, new Map());
  }, [skillDefinitions]);

  const skillProgressMap = useMemo(() => {
    return skillProgress.reduce<Map<string, SkillProgressRow>>((accumulator, row) => {
      if (row.skill_slug) {
        accumulator.set(row.skill_slug.toLowerCase(), row);
      }
      return accumulator;
    }, new Map());
  }, [skillProgress]);

  const getSkillLabel = useCallback(
    (slug: string) => {
      const normalizedSlug = slug.toLowerCase();
      const definition = skillDefinitionMap.get(normalizedSlug);
      if (definition?.name) {
        return definition.name;
      }
      return humanizeSkillSlug(normalizedSlug);
    },
    [humanizeSkillSlug, skillDefinitionMap]
  );

  const getCurrentSkillLevel = useCallback(
    (slug: string) => {
      const normalizedSlug = slug.toLowerCase();
      const value = skills?.[normalizedSlug as keyof PlayerSkills];
      return typeof value === 'number' ? value : 0;
    },
    [skills]
  );

  const isSkillUnlocked = useCallback(
    (slug: string) => {
      const normalizedSlug = slug.toLowerCase();

      if (!skillDefinitionMap.has(normalizedSlug)) {
        return true;
      }

      if (unlockedSkills?.[normalizedSlug]) {
        return true;
      }

      if (skillProgressMap.has(normalizedSlug)) {
        return true;
      }

      return false;
    },
    [skillDefinitionMap, skillProgressMap, unlockedSkills]
  );

  const stageRequirementDetails = useMemo(() => {
    return performanceStages.map(stage => ({
      stage,
      requirements: Object.entries(stage.skillRequirements).map(([skillSlug, requiredLevel]) => {
        const normalizedSlug = skillSlug.toLowerCase();
        return {
          slug: normalizedSlug,
          skillName: getSkillLabel(normalizedSlug),
          requiredLevel,
          currentLevel: getCurrentSkillLevel(normalizedSlug),
          locked: !isSkillUnlocked(normalizedSlug),
        } satisfies StageSkillRequirementDetail;
      }),
    }));
  }, [getCurrentSkillLevel, getSkillLabel, isSkillUnlocked, performanceStages]);

  const handleLockedSkillFailure = useCallback(
    (stage: PerformanceStage, skillSlug: string) => {
      const normalizedSlug = skillSlug.toLowerCase();
      const failureKey = `${stage.name}:${normalizedSlug}`;
      if (lockedFailureRef.current === failureKey) {
        return;
      }

      lockedFailureRef.current = failureKey;
      const skillLabel = getSkillLabel(normalizedSlug);
      const message = `Unlock the ${skillLabel} skill to perform the ${stage.name} stage.`;

      setPerformanceFailed(true);
      setFailureReason(message);
      setFailedStage(stage.name);
      setIsPerforming(false);
      setShowResults(true);
      setTotalEarnings(0);
      setFameChange(0);
      setPenaltyAmount(0);

      const failureFeedback = `The ${skillLabel} skill is currently locked. Unlock it to progress.`;
      const failureResult: StageResult = {
        stageName: stage.name,
        score: 0,
        audienceReaction: { ...audienceReaction },
        feedback: [failureFeedback],
        bonuses: [],
      };

      const existingIndex = stageResults.findIndex(result => result.stageName === stage.name);
      const nextResults = existingIndex >= 0
        ? stageResults.map((result, index) => (index === existingIndex ? failureResult : result))
        : [...stageResults, failureResult];

      setStageResults(nextResults);
      const totalScore = nextResults.reduce((sum, result) => sum + result.score, 0);
      const averageScore = nextResults.length > 0 ? totalScore / nextResults.length : 0;
      setFinalScore(averageScore);
    },
    [audienceReaction, getSkillLabel, stageResults]
  );

  const ensureStageRequirementsUnlocked = useCallback(
    (stage: PerformanceStage) => {
      const lockedEntry = Object.keys(stage.skillRequirements).find(skillSlug => !isSkillUnlocked(skillSlug));

      if (lockedEntry) {
        handleLockedSkillFailure(stage, lockedEntry);
        return false;
      }

      return true;
    },
    [handleLockedSkillFailure, isSkillUnlocked]
  );

  const resolvePlayerSkillValue = useCallback(
    (stage: PerformanceStage, skillSlug: string) => {
      const normalizedSlug = skillSlug.toLowerCase();

      if (!isSkillUnlocked(normalizedSlug)) {
        handleLockedSkillFailure(stage, normalizedSlug);
        return 0;
      }

      const value = skills?.[normalizedSlug as keyof PlayerSkills];
      if (typeof value === 'number') {
        return value;
      }

      handleLockedSkillFailure(stage, normalizedSlug);
      return 0;
    },
    [handleLockedSkillFailure, isSkillUnlocked, skills]
  );

  const lockedStageWarnings = useMemo(() => {
    return stageRequirementDetails.flatMap(detail =>
      detail.requirements
        .filter(requirement => requirement.locked)
        .map(requirement => ({
          stageName: detail.stage.name,
          skillName: requirement.skillName,
        }))
    );
  }, [stageRequirementDetails]);
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
      setLoading(true);
      const { data: gigRow, error: gigError } = await supabase
        .from('gigs')
        .select('*')
        .eq('id', gigId)
        .single();

      if (gigError) throw gigError;
      if (!gigRow) throw new Error('Gig not found');

      const { data: venueRow, error: venueError } = await supabase
        .from('venues')
        .select('*')
        .eq('id', gigRow.venue_id)
        .single();

      if (venueError) throw venueError;
      if (!venueRow) throw new Error('Venue not found');

      const showType = (gigRow.show_type ?? DEFAULT_SHOW_TYPE) as ShowType;
      const transformedGig: Gig = {
        id: gigRow.id,
        venue: {
          id: venueRow.id,
          name: venueRow.name ?? 'Unknown Venue',
          capacity: venueRow.capacity ?? 0,
          prestige_level: venueRow.prestige_level ?? 0
        },
        scheduled_date: gigRow.scheduled_date ?? new Date().toISOString(),
        payment: gigRow.payment ?? 0,
        status: gigRow.status ?? 'scheduled',
        show_type: showType
      };

      setGig(transformedGig);
      setCurrentShowType(showType);
      setPerformanceStages(getPerformanceStages(showType));
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to load gig details';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading gig:', errorMessage, error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [gigId]);

  useEffect(() => {
    if (user) {
      loadGig();
    }
  }, [user, loadGig]);

  const startPerformance = () => {
    lockedFailureRef.current = null;
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
    const stage = performanceStages[stageIndex];
    if (!stage) return;
    if (!ensureStageRequirementsUnlocked(stage)) {
      return;
    }
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

    const stage = performanceStages[stageIndex];
    if (!stage) return;
    if (!ensureStageRequirementsUnlocked(stage)) {
      return;
    }
    const behavior = SHOW_TYPE_BEHAVIOR[currentShowType] ?? SHOW_TYPE_BEHAVIOR[DEFAULT_SHOW_TYPE];
    const skillEntries = Object.entries(stage.skillRequirements);
    const skillLevel = skillEntries.reduce((avg, [skill, req]) => {
      const playerSkill = resolvePlayerSkillValue(stage, skill);
      if (req <= 0) {
        return avg;
      }
      return avg + playerSkill / req;
    }, 0) / Math.max(skillEntries.length, 1);

    const venuePrestige = gig.venue.prestige_level;
    const baseReaction = Math.min(100, skillLevel * 80 * behavior.audienceEase + Math.random() * 20);

    setAudienceReaction(prev => ({
      energy: Math.max(0, Math.min(100, baseReaction + (progress * 0.2 * behavior.audienceEase) - (venuePrestige * 5 / behavior.audienceEase))),
      satisfaction: Math.max(0, Math.min(100, baseReaction + Math.random() * 20 - (10 / behavior.audienceEase))),
      excitement: Math.max(0, Math.min(100, baseReaction + (progress * 0.3 * behavior.audienceEase))),
      singing_along: Math.max(0, Math.min(100, (progress > 50 ? baseReaction * 0.85 * behavior.audienceEase : 0)))
    }));
  };

  const completeStage = (stageIndex: number) => {
    if (!skills || !gig) return;

    const stage = performanceStages[stageIndex];
    if (!stage) return;
    if (!ensureStageRequirementsUnlocked(stage)) {
      return;
    }
    const behavior = SHOW_TYPE_BEHAVIOR[currentShowType] ?? SHOW_TYPE_BEHAVIOR[DEFAULT_SHOW_TYPE];

    // Calculate stage score based on skills vs requirements
    let stageScore = 0;
    const feedback: string[] = [];
    const bonuses: string[] = [];

    Object.entries(stage.skillRequirements).forEach(([skill, requirement]) => {
      const normalizedSkill = skill.toLowerCase();
      const playerSkill = resolvePlayerSkillValue(stage, normalizedSkill);
      const skillLabel = getSkillLabel(normalizedSkill);
      const skillRatio = requirement > 0 ? playerSkill / requirement : 0;
      const weight = currentShowType === 'acoustic' && (normalizedSkill === 'vocals' || normalizedSkill === 'songwriting') ? 30 : 25;
      stageScore += skillRatio * weight;

      if (skillRatio >= 1.5) {
        feedback.push(`Exceptional ${skillLabel} performance!`);
        bonuses.push(`+20% ${skillLabel} bonus`);
      } else if (skillRatio >= 1.0) {
        feedback.push(`Great ${skillLabel} work!`);
      } else if (skillRatio >= 0.7) {
        feedback.push(`Decent ${skillLabel} performance`);
      } else {
        feedback.push(`${skillLabel} needs improvement`);
      }
    });

    // Add audience reaction bonus
    const reactionBonus = ((audienceReaction.energy + audienceReaction.satisfaction) / 10) * behavior.audienceEase;
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

    const stageFailureThreshold = Math.max(35, STAGE_FAILURE_THRESHOLD - behavior.stageTolerance);
    if (result.score < stageFailureThreshold) {
      finishPerformance(updatedResults, {
        forcedFailure: true,
        failedStage: stage.name,
        failureReason: `${stage.name} score fell below ${stageFailureThreshold}%. The promoter ended the show early.`
      });
      return;
    }

    // Move to next stage or finish performance
    if (stageIndex < performanceStages.length - 1) {
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
    const behavior = SHOW_TYPE_BEHAVIOR[currentShowType] ?? SHOW_TYPE_BEHAVIOR[DEFAULT_SHOW_TYPE];
    const baseEarnings = (gig.payment || 1000) * behavior.earnings;
    const potentialEarnings = Math.floor(baseEarnings * (averageScore / 100));

    const forcedFailure = options.forcedFailure ?? false;
    let derivedFailureReason = options.failureReason ?? '';
    const failureThreshold = Math.max(50, OVERALL_FAILURE_THRESHOLD - behavior.stageTolerance);
    const isFailure = forcedFailure || averageScore < failureThreshold;

    if (isFailure && !derivedFailureReason) {
      derivedFailureReason = `Overall performance score fell below ${failureThreshold}%. The crowd left disappointed.`;
    }

    const successRatio = Math.min(Math.max(averageScore / 100, 0), 1);
    const baselineGigPayment = calculateGigPayment(
      baseEarnings,
      skills?.performance ?? 0,
      profile.fame ?? 0,
      successRatio,
    );
    const adjustedGigPayment = calculateGigPayment(
      baseEarnings,
      skills?.performance ?? 0,
      profile.fame ?? 0,
      successRatio,
      attributeBonuses,
    );
    const payoutAdjustment = baselineGigPayment > 0 ? adjustedGigPayment / baselineGigPayment : 1;

    const failureBase = Math.floor(baseEarnings * FAILURE_EARNINGS_MULTIPLIER);
    const adjustedPotentialEarnings = Math.floor(potentialEarnings * payoutAdjustment);
    const adjustedFailureEarnings = Math.floor(failureBase * payoutAdjustment);
    const totalEarningsValue = isFailure
      ? Math.min(adjustedPotentialEarnings, adjustedFailureEarnings)
      : adjustedPotentialEarnings;

    const baseFanGain = Math.max(0, Math.floor(averageScore * 0.5 * behavior.fan));
    const baselineFanGain = calculateFanGain(
      baseFanGain,
      skills?.performance ?? 0,
      skills?.vocals ?? 0,
    );
    const adjustedFanGain = calculateFanGain(
      baseFanGain,
      skills?.performance ?? 0,
      skills?.vocals ?? 0,
      attributeBonuses,
    );
    const fanAdjustment = baselineFanGain > 0 ? adjustedFanGain / baselineFanGain : 1;
    const successFanGain = Math.max(0, Math.round(baseFanGain * fanAdjustment));
    const failurePenalty = Math.max(1, Math.round(FAILURE_FAME_PENALTY * fanAdjustment));
    const fameDelta = isFailure ? -failurePenalty : successFanGain;
    const experienceGain = Math.floor((isFailure ? averageScore : averageScore * 2) * behavior.experience);
    const penaltyValue = isFailure ? Math.max(0, adjustedPotentialEarnings - totalEarningsValue) : 0;

    setFinalScore(averageScore);
    setTotalEarnings(totalEarningsValue);
    setFameChange(fameDelta);
    setPenaltyAmount(penaltyValue);
    setPerformanceFailed(isFailure);
    setFailureReason(isFailure ? derivedFailureReason : null);
    setFailedStage(isFailure ? options.failedStage ?? null : null);

    try {
      const updatedFame = Math.max(0, profile.fame + fameDelta);
      const attendance = Math.floor(
        gig.venue.capacity * Math.max(averageScore, 10) / 100 * (currentShowType === 'acoustic' ? 0.85 : 1)
      );
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

      const showTypeLabel = currentShowType === 'acoustic' ? 'acoustic' : 'standard';
      const activityMessage = isFailure
        ? `Performance at ${gig.venue.name} fell flat (${averageScore.toFixed(1)}%). Lost ${Math.abs(fameDelta)} fame.`
        : `Performed a ${showTypeLabel} set at ${gig.venue.name} - Score: ${averageScore.toFixed(1)}%`;

      await addActivity('gig_performance', activityMessage, totalEarningsValue);

      try {
        const wearSummary = await applyEquipmentWear(user.id, 'gig');
        if (wearSummary?.updates.length) {
          toast.info('Your equipment took some wear after the show. Check your inventory to keep it in top shape.');
        }
      } catch (wearError) {
        console.error('Failed to apply equipment wear after gig performance', wearError);
      }
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to save performance results';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error finishing performance:', errorMessage, error);
      toast.error(errorMessage);
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
    const totalStages = Math.max(1, performanceStages.length);
    const currentStageData = performanceStages[currentStage] ?? performanceStages[0];
    const showTypeLabel = currentShowType === 'acoustic' ? 'Acoustic Set' : 'Standard Show';
    const currentStageRequirements = stageRequirementDetails[currentStage]?.requirements ?? [];

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-6 h-6" />
              {currentStageData.name}
            </CardTitle>
            <p className="text-muted-foreground">{currentStageData.description}</p>
            <Badge
              variant="outline"
              className={`w-fit border ${currentShowType === 'acoustic' ? 'bg-amber-500/10 text-amber-500 border-amber-500/40' : 'bg-blue-500/10 text-blue-500 border-blue-500/40'} text-xs uppercase tracking-wide`}
            >
              {showTypeLabel}
            </Badge>
            <div className="mt-2 flex flex-wrap gap-2">
              {currentStageRequirements.map(requirement => (
                <Badge
                  key={requirement.slug}
                  variant={requirement.locked ? 'destructive' : 'outline'}
                  className={`text-xs flex items-center gap-1 ${requirement.locked ? 'bg-destructive/10 text-destructive border-destructive/40' : ''}`}
                  title={requirement.locked
                    ? `Unlock ${requirement.skillName} to continue to this stage.`
                    : `Required level ${requirement.requiredLevel}. Current level ${requirement.currentLevel}.`
                  }
                >
                  {requirement.locked && <Lock className="w-3 h-3" />}
                  {requirement.skillName}: {requirement.currentLevel}/{requirement.requiredLevel}
                </Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Stage Progress</span>
                <span className="text-sm text-muted-foreground">Stage {currentStage + 1} of {totalStages}</span>
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
                Stage {currentStage + 1} of {totalStages}
              </div>
              <div className="flex justify-center gap-2">
                {performanceStages.map((_, index) => (
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

  const stagePlan = performanceStages;
  const showTypeLabel = currentShowType === 'acoustic' ? 'Acoustic Set' : 'Standard Show';
  const estimatedMinutes = Math.max(1, Math.round(stagePlan.reduce((sum, stage) => sum + stage.duration, 0) / 60000));

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
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Show Type:</span>
                <Badge
                  variant="outline"
                  className={`border ${currentShowType === 'acoustic' ? 'bg-amber-500/10 text-amber-500 border-amber-500/40' : 'bg-blue-500/10 text-blue-500 border-blue-500/40'} text-xs uppercase tracking-wide`}
                >
                  {showTypeLabel}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Duration:</span>
                <span className="font-medium">~{estimatedMinutes} minutes</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Performance Stages</h3>
            <div className="space-y-2">
                {stagePlan.map((stage, index) => {
                  const requirementDetails = stageRequirementDetails[index]?.requirements ?? [];
                  return (
                    <div key={index} className="p-3 bg-muted rounded-lg">
                      <div className="font-medium">{stage.name}</div>
                      <div className="text-sm text-muted-foreground">{stage.description}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {requirementDetails.map(requirement => (
                          <Badge
                            key={requirement.slug}
                            variant={requirement.locked ? 'destructive' : 'outline'}
                            className={`text-xs flex items-center gap-1 ${requirement.locked ? 'bg-destructive/10 text-destructive border-destructive/40' : ''}`}
                            title={requirement.locked
                              ? `Unlock ${requirement.skillName} to attempt the ${stage.name} stage.`
                              : `Required level ${requirement.requiredLevel}. Current level ${requirement.currentLevel}.`
                            }
                          >
                            {requirement.locked && <Lock className="w-3 h-3" />}
                            {requirement.skillName}: {requirement.currentLevel}/{requirement.requiredLevel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-center">
            {lockedStageWarnings.length > 0 && (
              <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/40 rounded-md p-3 text-left">
                <div className="font-medium">Locked skill requirements detected:</div>
                <ul className="mt-1 space-y-1">
                  {lockedStageWarnings.map((warning, index) => (
                    <li key={`${warning.stageName}-${warning.skillName}-${index}`}>
                      • {warning.stageName}: Unlock {warning.skillName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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