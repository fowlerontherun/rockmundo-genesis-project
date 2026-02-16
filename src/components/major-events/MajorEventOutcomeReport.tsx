import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Trophy, 
  Users, 
  Music, 
  TrendingUp,
  PartyPopper,
  DollarSign,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MajorEventPerformance, MajorEventSongPerformance } from "@/hooks/useMajorEvents";

interface MajorEventOutcomeReportProps {
  performance: MajorEventPerformance;
  songPerformances: MajorEventSongPerformance[];
}

const crowdResponseConfig: Record<string, { label: string; color: string; emoji: string }> = {
  ecstatic: { label: 'Ecstatic', color: 'bg-green-500', emoji: '🤩' },
  enthusiastic: { label: 'Enthusiastic', color: 'bg-emerald-500', emoji: '😄' },
  engaged: { label: 'Engaged', color: 'bg-blue-500', emoji: '👏' },
  mixed: { label: 'Mixed', color: 'bg-yellow-500', emoji: '😐' },
  disappointed: { label: 'Disappointed', color: 'bg-red-500', emoji: '😞' },
};

function getPerformanceGrade(rating: number): { grade: string; label: string; color: string } {
  if (rating >= 90) return { grade: 'S', label: 'Legendary', color: 'text-yellow-500' };
  if (rating >= 80) return { grade: 'A', label: 'Excellent', color: 'text-green-500' };
  if (rating >= 70) return { grade: 'B', label: 'Good', color: 'text-blue-500' };
  if (rating >= 60) return { grade: 'C', label: 'Average', color: 'text-orange-500' };
  if (rating >= 50) return { grade: 'D', label: 'Poor', color: 'text-red-500' };
  return { grade: 'F', label: 'Terrible', color: 'text-red-700' };
}

export function MajorEventOutcomeReport({ performance, songPerformances }: MajorEventOutcomeReportProps) {
  const navigate = useNavigate();
  const rating = performance.overall_rating || 0;
  const grade = getPerformanceGrade(rating);
  const eventName = performance.instance?.event?.name || 'Major Event';

  const songs = [performance.song_1, performance.song_2, performance.song_3];

  return (
    <div className="space-y-6">
      {/* Header with grade */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-6xl font-black ${grade.color}`}>
                {grade.grade}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{grade.label} Performance!</h2>
                <p className="text-muted-foreground">
                  {eventName} — Overall Rating: {rating.toFixed(1)}%
                </p>
              </div>
            </div>
            <PartyPopper className="h-12 w-12 text-primary opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Rewards Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/20">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Earned</p>
                <p className="text-2xl font-bold text-green-500">
                  ${(performance.cash_earned || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-yellow-500/20">
                <TrendingUp className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fame Gained</p>
                <p className="text-2xl font-bold text-yellow-500">
                  +{(performance.fame_gained || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-pink-500/30 bg-pink-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-pink-500/20">
                <Users className="h-6 w-6 text-pink-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">New Fans</p>
                <p className="text-2xl font-bold text-pink-500">
                  +{(performance.fans_gained || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Song-by-Song Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Song Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {songPerformances.map((sp, index) => {
            const response = crowdResponseConfig[sp.crowd_response || 'engaged'];
            const song = songs[index];

            return (
              <div key={sp.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Song {sp.position}</Badge>
                    <span className="font-medium">{song?.title || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{response.emoji}</span>
                    <Badge className={response.color}>{response.label}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={sp.performance_score || 0} className="flex-1" />
                  <span className="text-sm font-medium w-12 text-right">
                    {(sp.performance_score || 0).toFixed(0)}%
                  </span>
                </div>
                {sp.commentary && Array.isArray(sp.commentary) && sp.commentary.length > 0 && (
                  <div className="pl-4 border-l-2 border-muted">
                    {(sp.commentary as string[]).map((comment: string, i: number) => (
                      <p key={i} className="text-sm text-muted-foreground italic">
                        "{comment}"
                      </p>
                    ))}
                  </div>
                )}
                {index < songPerformances.length - 1 && <Separator className="my-3" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button onClick={() => navigate('/major-events')} className="gap-2">
          Back to Major Events
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
