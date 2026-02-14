import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Music, Star, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SongPerformance {
  song_id: string;
  song_title: string;
  position: number;
  performance_score: number;
  crowd_response: string;
}

interface LiveGigPerformanceProps {
  songs: Array<{ id: string; title: string; quality_score: number }>;
  onComplete: (performances: SongPerformance[]) => void;
  onCancel: () => void;
}

export const LiveGigPerformance = ({ songs, onComplete, onCancel }: LiveGigPerformanceProps) => {
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [performances, setPerformances] = useState<SongPerformance[]>([]);
  const [isPerforming, setIsPerforming] = useState(false);
  const [showTransition, setShowTransition] = useState(false);

  const currentSong = songs[currentSongIndex];
  const isLastSong = currentSongIndex === songs.length - 1;

  const performSong = () => {
    setIsPerforming(true);

    // Simulate performance (2 seconds per song for demo)
    setTimeout(() => {
      // Calculate performance score with variance
      const baseScore = currentSong.quality_score / 1000 * 20; // Max 20 points from quality
      const variance = Math.random() * 5 - 2.5; // -2.5 to +2.5 variance
      const score = Math.max(0, Math.min(25, baseScore + variance));

      // Determine crowd response
      let crowdResponse = 'mixed';
      if (score >= 22) crowdResponse = 'ecstatic';
      else if (score >= 19) crowdResponse = 'enthusiastic';
      else if (score >= 15) crowdResponse = 'engaged';
      else if (score < 10) crowdResponse = 'disappointed';

      const performance: SongPerformance = {
        song_id: currentSong.id,
        song_title: currentSong.title,
        position: currentSongIndex + 1,
        performance_score: score,
        crowd_response: crowdResponse
      };

      setPerformances(prev => [...prev, performance]);
      setIsPerforming(false);

      if (isLastSong) {
        // Gig complete
        setTimeout(() => {
          onComplete([...performances, performance]);
        }, 1000);
      } else {
        // Show transition
        setShowTransition(true);
        setTimeout(() => {
          setShowTransition(false);
          setCurrentSongIndex(prev => prev + 1);
        }, 1500);
      }
    }, 2000);
  };

  const getCrowdBadge = (response: string) => {
    const variants: Record<string, { variant: any; label: string; icon: string }> = {
      ecstatic: { variant: 'default', label: 'Ecstatic', icon: '🔥' },
      enthusiastic: { variant: 'default', label: 'Enthusiastic', icon: '🎉' },
      engaged: { variant: 'secondary', label: 'Engaged', icon: '👍' },
      mixed: { variant: 'outline', label: 'Mixed', icon: '😐' },
      disappointed: { variant: 'destructive', label: 'Disappointed', icon: '😞' },
    };
    
    const config = variants[response] || variants.mixed;
    return <Badge variant={config.variant}>{config.icon} {config.label}</Badge>;
  };

  const avgScore = performances.length > 0
    ? performances.reduce((sum, p) => sum + p.performance_score, 0) / performances.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Progress Tracker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Live Performance
            </span>
            <Badge variant="outline">
              Song {currentSongIndex + 1} of {songs.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={((currentSongIndex + (isPerforming ? 0.5 : 0)) / songs.length) * 100} className="h-3" />
        </CardContent>
      </Card>

      {/* Current Song */}
      {!showTransition && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-2xl">
              {currentSongIndex + 1}. {currentSong.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Song Quality</span>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.floor(currentSong.quality_score / 200)
                        ? 'fill-yellow-500 text-yellow-500'
                        : 'text-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            {!isPerforming && performances.length === currentSongIndex && (
              <Button onClick={performSong} className="w-full" size="lg">
                <Music className="mr-2 h-5 w-5" />
                Perform Song
              </Button>
            )}

            {isPerforming && (
              <Alert>
                <Music className="h-4 w-4 animate-pulse" />
                <AlertDescription>
                  Performing... The crowd is listening intently!
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {showTransition && (
        <Card className="border-primary animate-pulse">
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-primary" />
            <p className="text-lg font-semibold">Great performance!</p>
            <p className="text-muted-foreground">Preparing next song...</p>
          </CardContent>
        </Card>
      )}

      {/* Performance Summary */}
      {performances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Performance Summary</span>
              <Badge variant="secondary">
                Avg: {avgScore.toFixed(1)}/25
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {performances.map((perf) => (
                <div key={perf.song_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold">{perf.position}. {perf.song_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-0.5">
                        {[...Array(25)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-2 w-2 ${
                              i < Math.floor(perf.performance_score)
                                ? 'fill-yellow-500 text-yellow-500'
                                : 'text-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{perf.performance_score.toFixed(1)}</span>
                    </div>
                  </div>
                  {getCrowdBadge(perf.crowd_response)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Option */}
      {!isPerforming && currentSongIndex === 0 && performances.length === 0 && (
        <Button onClick={onCancel} variant="outline" className="w-full">
          Cancel Performance
        </Button>
      )}
    </div>
  );
};
