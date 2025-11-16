import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { TrendingUp, Users, Zap, Heart, Award } from "lucide-react";

interface SongPerformanceData {
  position: number;
  title: string;
  performanceScore: number;
  crowdResponse: string;
  chemistry: number;
  rehearsal: number;
  equipment: number;
}

interface GigAnalyticsDetailedProps {
  gigData: {
    venueName: string;
    date: string;
    attendance: number;
    revenue: number;
    fameGained: number;
  };
  songPerformances: SongPerformanceData[];
  contributionBreakdown: {
    chemistry: number;
    rehearsal: number;
    equipment: number;
    crew: number;
    memberSkills: number;
  };
}

export const GigAnalyticsDetailed = ({ 
  gigData, 
  songPerformances,
  contributionBreakdown 
}: GigAnalyticsDetailedProps) => {
  // Prepare data for performance trend chart
  const performanceTrendData = songPerformances.map((song, index) => ({
    name: `Song ${index + 1}`,
    score: song.performanceScore,
    title: song.title.substring(0, 15) + (song.title.length > 15 ? '...' : '')
  }));

  // Prepare data for contribution breakdown radar chart
  const radarData = [
    { subject: 'Chemistry', value: contributionBreakdown.chemistry, fullMark: 25 },
    { subject: 'Rehearsal', value: contributionBreakdown.rehearsal, fullMark: 25 },
    { subject: 'Equipment', value: contributionBreakdown.equipment, fullMark: 25 },
    { subject: 'Crew', value: contributionBreakdown.crew, fullMark: 25 },
    { subject: 'Skills', value: contributionBreakdown.memberSkills, fullMark: 25 },
  ];

  // Prepare crowd response distribution
  const crowdResponseCounts = songPerformances.reduce((acc, song) => {
    acc[song.crowdResponse] = (acc[song.crowdResponse] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const crowdDistributionData = Object.entries(crowdResponseCounts).map(([response, count]) => ({
    response: response.charAt(0).toUpperCase() + response.slice(1),
    count,
    fill: response === 'ecstatic' ? '#f97316' :
          response === 'enthusiastic' ? '#eab308' :
          response === 'engaged' ? '#3b82f6' :
          response === 'mixed' ? '#6b7280' : '#ef4444'
  }));

  // Calculate momentum (how performance changed throughout show)
  const calculateMomentum = () => {
    if (songPerformances.length < 2) return 0;
    
    const firstHalf = songPerformances.slice(0, Math.floor(songPerformances.length / 2));
    const secondHalf = songPerformances.slice(Math.floor(songPerformances.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, s) => sum + s.performanceScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.performanceScore, 0) / secondHalf.length;
    
    return ((secondAvg - firstAvg) / firstAvg) * 100;
  };

  const momentum = calculateMomentum();

  return (
    <div className="space-y-6">
      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Show Momentum</span>
                <TrendingUp className={`h-4 w-4 ${momentum > 0 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <div className={`text-2xl font-bold ${momentum > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {momentum > 0 ? '+' : ''}{momentum.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {momentum > 10 ? 'Strong finish!' : momentum > 0 ? 'Improved over time' : 
                 momentum > -10 ? 'Steady performance' : 'Lost steam'}
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Consistency</span>
                <Zap className="h-4 w-4 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold">
                {calculateConsistency(songPerformances)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Performance variation
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Crowd Favorite</span>
                <Heart className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-sm font-bold line-clamp-2">
                {songPerformances.reduce((best, curr) => 
                  curr.performanceScore > best.performanceScore ? curr : best
                ).title}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Throughout Show</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="title" 
                angle={-45}
                textAnchor="end"
                height={100}
                fontSize={12}
              />
              <YAxis domain={[0, 25]} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Performance Score"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Contribution Breakdown Radar */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Factors</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis domain={[0, 25]} />
              <Radar 
                name="Contribution" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))" 
                fillOpacity={0.6}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            {radarData.map((item) => (
              <div key={item.subject} className="text-center p-2 rounded-lg border">
                <p className="text-xs text-muted-foreground">{item.subject}</p>
                <p className="text-lg font-bold">{item.value.toFixed(1)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Crowd Response Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Crowd Response Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={crowdDistributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="response" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Song-by-Song Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Song-by-Song Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {songPerformances.map((song, index) => (
              <div 
                key={index}
                className="p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{song.position}</Badge>
                      <h4 className="font-semibold">{song.title}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{song.performanceScore.toFixed(1)}/25</div>
                    <Badge variant={
                      song.crowdResponse === 'ecstatic' ? 'default' :
                      song.crowdResponse === 'enthusiastic' ? 'default' :
                      song.crowdResponse === 'engaged' ? 'secondary' : 'outline'
                    }>
                      {song.crowdResponse}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Chemistry:</span>
                    <span className="font-medium ml-1">{song.chemistry.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rehearsal:</span>
                    <span className="font-medium ml-1">{song.rehearsal.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equipment:</span>
                    <span className="font-medium ml-1">{song.equipment.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium ml-1">{song.performanceScore.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper function to calculate consistency
function calculateConsistency(performances: SongPerformanceData[]): number {
  if (performances.length === 0) return 0;
  
  const avg = performances.reduce((sum, p) => sum + p.performanceScore, 0) / performances.length;
  const variance = performances.reduce((sum, p) => sum + Math.pow(p.performanceScore - avg, 2), 0) / performances.length;
  const stdDev = Math.sqrt(variance);
  
  // Convert to a 0-100 scale where lower variance = higher consistency
  // Maximum reasonable std dev is ~5 (when scores vary wildly between 0-25)
  const consistencyPercent = Math.max(0, 100 - (stdDev / 5) * 100);
  
  return Math.round(consistencyPercent);
}
