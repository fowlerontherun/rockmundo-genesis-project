import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Star, 
  Heart,
  MessageCircle,
  Zap,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';

interface GigAnalytics {
  gig_id: string;
  performance_breakdown: any;
  crowd_reaction_highlights: string[];
  social_buzz_count: number;
  twaater_sentiment: number;
  compared_to_previous: any;
  energy_curve: any;
  mishap_events: any;
}

export function PostGigAnalytics({ gigId }: { gigId: string }) {
  const [analytics, setAnalytics] = useState<GigAnalytics | null>(null);
  const [outcome, setOutcome] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [gigId]);

  const loadAnalytics = async () => {
    setLoading(true);

    // Load gig outcome
    const { data: outcomeData } = await supabase
      .from('gig_outcomes')
      .select('*')
      .eq('gig_id', gigId)
      .single();

    setOutcome(outcomeData);

    // Load analytics
    const { data: analyticsData } = await supabase
      .from('gig_analytics')
      .select('*')
      .eq('gig_id', gigId)
      .single();

    setAnalytics(analyticsData);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading analytics...</div>;
  }

  if (!outcome) {
    return <div className="text-muted-foreground">No analytics available</div>;
  }

  const performanceGrade = outcome.performance_grade || 'C';
  const gradeColors = {
    'S': 'text-purple-500',
    'A': 'text-green-500',
    'B': 'text-blue-500',
    'C': 'text-yellow-500',
    'D': 'text-orange-500',
    'F': 'text-red-500',
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Performance Grade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${gradeColors[performanceGrade as keyof typeof gradeColors]}`}>
              {performanceGrade}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {(outcome.overall_rating || 0).toFixed(1)}/25 score
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Net Profit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                ${(outcome.net_profit || 0).toLocaleString()}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ${outcome.ticket_revenue || 0} tickets + ${outcome.merch_revenue || 0} merch
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Crowd Size</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{outcome.actual_attendance || 0}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {(outcome.attendance_percentage || 0).toFixed(0)}% capacity
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Fame Gained</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">+{outcome.fame_gained || 0}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Chemistry: {outcome.chemistry_change > 0 ? '+' : ''}{outcome.chemistry_change || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="breakdown" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="social">Social Buzz</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Factors</CardTitle>
              <CardDescription>How each element contributed to your score</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Member Skills</span>
                  <span className="text-sm font-medium">
                    {((outcome.skill_performance_avg || 0) / 100 * 25).toFixed(1)}/25
                  </span>
                </div>
                <Progress value={outcome.skill_performance_avg || 0} />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Band Synergy</span>
                  <span className="text-sm font-medium">
                    {((outcome.band_synergy_modifier || 1) * 10).toFixed(1)}/20
                  </span>
                </div>
                <Progress value={(outcome.band_synergy_modifier || 1) * 50} />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Crowd Engagement</span>
                  <span className="text-sm font-medium">
                    {((outcome.crowd_engagement || 1) * 10).toFixed(1)}/20
                  </span>
                </div>
                <Progress value={(outcome.crowd_engagement || 1) * 50} />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Setlist Quality</span>
                  <span className="text-sm font-medium">
                    {((outcome.setlist_quality_score || 0) / 100 * 15).toFixed(1)}/15
                  </span>
                </div>
                <Progress value={outcome.setlist_quality_score || 0} />
              </div>

              {outcome.promoter_modifier > 0 && (
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <span className="text-sm">Promoter Bonus</span>
                  <span className="text-sm font-medium text-green-500">
                    +{outcome.promoter_modifier}
                  </span>
                </div>
              )}

              {outcome.venue_loyalty_bonus > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                  <span className="text-sm">Venue Loyalty Bonus</span>
                  <span className="text-sm font-medium text-blue-500">
                    +{outcome.venue_loyalty_bonus}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manager's Suggestions */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Manager's Suggestions
              </CardTitle>
              <CardDescription>Your manager's tips for improving future gigs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const suggestions: { text: string; priority: 'high' | 'medium' | 'low' }[] = [];
                const skillAvg = outcome.skill_performance_avg || 0;
                const synergy = outcome.band_synergy_modifier || 1;
                const crowd = outcome.crowd_engagement || 1;
                const setlist = outcome.setlist_quality_score || 0;
                const rating = outcome.overall_rating || 0;
                const attendance = outcome.attendance_percentage || 0;

                if (skillAvg < 50) {
                  suggestions.push({ text: "Your band's instrument skills are dragging you down. Invest in skill training and better gear — it'll make a huge difference on stage.", priority: 'high' });
                } else if (skillAvg < 75) {
                  suggestions.push({ text: "Your musicianship is decent but there's room to grow. Keep practicing your instruments and upgrading your equipment.", priority: 'medium' });
                }

                if (synergy < 1.2) {
                  suggestions.push({ text: "Band chemistry needs work. Schedule more rehearsals together and try to resolve any drama between members.", priority: synergy < 0.8 ? 'high' : 'medium' });
                }

                if (setlist < 60) {
                  suggestions.push({ text: "Your setlist could be stronger. Focus on well-rehearsed, high-quality songs and consider the flow between tracks.", priority: 'high' });
                }

                if (crowd < 1.0) {
                  suggestions.push({ text: "The crowd wasn't fully engaged. Level up your stage presence and charisma attributes to connect better with the audience.", priority: 'medium' });
                }

                if (attendance < 60) {
                  suggestions.push({ text: "The venue felt empty. Consider playing smaller venues that match your fame level, or promote the gig more beforehand.", priority: 'medium' });
                } else if (attendance >= 95) {
                  suggestions.push({ text: "Sold out show — amazing! You might be ready to move up to bigger venues.", priority: 'low' });
                }

                if (rating < 12) {
                  suggestions.push({ text: "Tough gig. Focus on the basics: rehearse your songs until they're perfected, keep your band chemistry high, and make sure your gear is up to scratch.", priority: 'high' });
                } else if (rating >= 20) {
                  suggestions.push({ text: "Incredible performance! Keep this momentum going. Your fans will remember this one.", priority: 'low' });
                }

                if (!outcome.promoter_modifier || outcome.promoter_modifier <= 0) {
                  suggestions.push({ text: "Consider hiring a promoter for your next gig — they can boost your score and bring in more fans.", priority: 'low' });
                }

                if (suggestions.length === 0) {
                  suggestions.push({ text: "Solid all-around performance. Keep up the good work and keep pushing for bigger venues!", priority: 'low' });
                }

                const priorityColors = {
                  high: 'border-destructive/30 bg-destructive/10',
                  medium: 'border-yellow-500/30 bg-yellow-500/10',
                  low: 'border-green-500/30 bg-green-500/10'
                };
                const priorityLabels = { high: '⚠️ Priority', medium: '💡 Tip', low: '✨ Great' };

                return suggestions.map((s, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${priorityColors[s.priority]}`}>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 text-xs mt-0.5">
                        {priorityLabels[s.priority]}
                      </Badge>
                      <p className="text-sm">{s.text}</p>
                    </div>
                  </div>
                ));
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Impact</CardTitle>
              <CardDescription>Twaater buzz and fan reactions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Twaats Generated</span>
                </div>
                <Badge variant="outline">{analytics?.social_buzz_count || 0}</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  <span>Sentiment Score</span>
                </div>
                <Badge variant={
                  (analytics?.twaater_sentiment || 0) > 0.5 ? 'default' : 'secondary'
                }>
                  {((analytics?.twaater_sentiment || 0) * 100).toFixed(0)}%
                </Badge>
              </div>

              {analytics?.crowd_reaction_highlights && analytics.crowd_reaction_highlights.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Crowd Highlights</h4>
                  <div className="space-y-2">
                    {analytics.crowd_reaction_highlights.map((highlight, i) => (
                      <div key={i} className="p-3 bg-muted/50 rounded-lg text-sm">
                        "{highlight}"
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stage Events</CardTitle>
              <CardDescription>Special moments and mishaps during the show</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.mishap_events && Array.isArray(analytics.mishap_events) && analytics.mishap_events.length > 0 ? (
                <div className="space-y-3">
                  {analytics.mishap_events.map((event: any, i: number) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border ${
                        event.impact_score > 0
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-red-500/10 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant={event.impact_score > 0 ? 'default' : 'destructive'}>
                          {event.event_type.replace('_', ' ')}
                        </Badge>
                        <span className={`text-sm font-medium ${
                          event.impact_score > 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {event.impact_score > 0 ? '+' : ''}{event.impact_score}
                        </span>
                      </div>
                      <p className="text-sm">{event.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No special events occurred during this gig
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>How this gig compares to your previous shows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics?.compared_to_previous ? (
                <>
                  {Object.entries(analytics.compared_to_previous).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="capitalize">{key.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        {value > 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-green-500 font-medium">+{value}%</span>
                          </>
                        ) : value < 0 ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-red-500 font-medium">{value}%</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No change</span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Not enough data for comparison yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
