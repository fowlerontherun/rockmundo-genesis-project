import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

interface Venue {
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
  const { toast } = useToast();
  
  const [gig, setGig] = useState<Gig | null>(null);
  const [isPerforming, setIsPerforming] = useState(false);
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

  const loadGig = useCallback(async () => {
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
      if (data && data.venues) {
        setGig({
          ...data,
          venue: {
            name: data.venues.name,
            capacity: data.venues.capacity,
            prestige_level: data.venues.prestige_level
          }
        });
      }
    } catch (error: any) {
      console.error('Error loading gig:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load gig details"
      });
    }
  }, [gigId, supabase, toast]);

  useEffect(() => {
    if (gigId) {
      loadGig();
    }
  }, [gigId, loadGig]);

  const startPerformance = async () => {
    setIsPerforming(true);
    setPerformanceStage(1);
    
    // Simulate performance stages
    const stages = [
      { name: "Opening Song", duration: 2000 },
      { name: "Getting the Crowd Going", duration: 3000 },
      { name: "Main Set", duration: 4000 },
      { name: "Encore", duration: 2000 }
    ];

    for (let i = 0; i < stages.length; i++) {
      setPerformanceStage(i + 1);
      await new Promise(resolve => setTimeout(resolve, stages[i].duration));
      
      // Calculate performance metrics based on skills and random factors
      const baseSkill = Math.random() * 30 + 40; // 40-70 base range
      const crowdBonus = Math.random() * 20; // 0-20 crowd response
      const stagePresence = Math.random() * 25 + 25; // 25-50 range
      
      setPerformance(prev => ({
        crowd_energy: Math.min(100, prev.crowd_energy + crowdBonus),
        technical_skill: Math.min(100, prev.technical_skill + baseSkill / 4),
        stage_presence: Math.min(100, prev.stage_presence + stagePresence / 4),
        overall_score: 0
      }));
    }

    // Calculate final results
    calculateResults();
  };

  const calculateResults = async () => {
    if (!gig || !user) return;

    const finalScore = (performance.crowd_energy + performance.technical_skill + performance.stage_presence) / 3;
    
    // Calculate earnings based on performance and venue
    const basePayment = gig.payment || 500;
    const performanceMultiplier = finalScore / 100;
    const finalEarnings = Math.floor(basePayment * performanceMultiplier);
    
    // Calculate fan gain
    const baseFanGain = Math.floor(gig.venue.capacity * 0.1 * performanceMultiplier);
    
    // Calculate experience gain
    const expGain = Math.floor(50 + (finalScore * 2) + (gig.venue.prestige_level * 10));

    setPerformance(prev => ({ ...prev, overall_score: finalScore }));
    setEarnings(finalEarnings);
    setFanGain(baseFanGain);
    setExperienceGain(expGain);

    // Update database
    try {
      // Update gig status and results
      await supabase
        .from('gigs')
        .update({
          status: 'completed',
          attendance: Math.floor(gig.venue.capacity * performanceMultiplier),
          fan_gain: baseFanGain
        })
        .eq('id', gigId);

      // Update player profile with earnings and experience
      const { data: profile } = await supabase
        .from('profiles')
        .select('cash, experience, fame')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            cash: profile.cash + finalEarnings,
            experience: profile.experience + expGain,
            fame: profile.fame + baseFanGain
          })
          .eq('user_id', user.id);
      }

      // Add activity feed entry
      await supabase
        .from('activity_feed')
        .insert({
          user_id: user.id,
          activity_type: 'gig_performed',
          message: `Performed at ${gig.venue.name} and earned $${finalEarnings}!`,
          earnings: finalEarnings,
          metadata: {
            venue: gig.venue.name,
            score: finalScore,
            fanGain: baseFanGain
          }
        });

    } catch (error: any) {
      console.error('Error updating performance results:', error);
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
    const stageNames = ["Opening Song", "Getting the Crowd Going", "Main Set", "Encore"];
    const progress = (performanceStage / 4) * 100;

    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bebas tracking-wider">
              Live Performance at {gig.venue.name}
            </CardTitle>
            <CardDescription>
              {stageNames[performanceStage - 1] || "Preparing..."}
            </CardDescription>
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
                <p className="text-xl font-bold">~45 min</p>
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