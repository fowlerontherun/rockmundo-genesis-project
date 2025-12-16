import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, TrendingUp, TrendingDown, Star, Music } from "lucide-react";
import type { GigMoment } from "@/utils/momentHighlightsGenerator";

interface MomentHighlightsCardProps {
  moments: GigMoment[] | null;
}

export const MomentHighlightsCard = ({ moments }: MomentHighlightsCardProps) => {
  if (!moments || moments.length === 0) {
    return null;
  }

  const highlights = moments.filter(m => m.type === 'highlight' || m.type === 'special');
  const lowlights = moments.filter(m => m.type === 'lowlight');

  const getMomentBadge = (moment: GigMoment) => {
    if (moment.type === 'special') {
      return <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white">Special</Badge>;
    }
    if (moment.type === 'highlight') {
      return <Badge variant="default" className="bg-green-600">Highlight</Badge>;
    }
    return <Badge variant="destructive">Challenge</Badge>;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'crowd': return '👥';
      case 'performance': return '🎵';
      case 'technical': return '⚙️';
      case 'merchandise': return '👕';
      case 'milestone': return '🏆';
      default: return '✨';
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          Gig Moments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Highlights Section */}
        {highlights.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-500">
              <TrendingUp className="w-4 h-4" />
              <span>Highlights ({highlights.length})</span>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {highlights.map((moment, idx) => (
                  <div
                    key={moment.id || idx}
                    className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{moment.icon}</span>
                        <span className="font-semibold text-sm">{moment.title}</span>
                      </div>
                      {getMomentBadge(moment)}
                    </div>
                    <p className="text-sm text-muted-foreground">{moment.description}</p>
                    {moment.songTitle && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Music className="w-3 h-3" />
                        <span>Song #{moment.songPosition}: {moment.songTitle}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs text-muted-foreground">
                        Impact: +{moment.impactScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Lowlights Section */}
        {lowlights.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-red-500">
              <TrendingDown className="w-4 h-4" />
              <span>Challenges ({lowlights.length})</span>
            </div>
            <ScrollArea className="max-h-[150px]">
              <div className="space-y-2">
                {lowlights.map((moment, idx) => (
                  <div
                    key={moment.id || idx}
                    className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{moment.icon}</span>
                        <span className="font-semibold text-sm">{moment.title}</span>
                      </div>
                      {getMomentBadge(moment)}
                    </div>
                    <p className="text-sm text-muted-foreground">{moment.description}</p>
                    {moment.songTitle && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Music className="w-3 h-3" />
                        <span>Song #{moment.songPosition}: {moment.songTitle}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Summary Stats */}
        <div className="pt-3 border-t border-border/50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-500">{highlights.length}</p>
              <p className="text-xs text-muted-foreground">Highlights</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{lowlights.length}</p>
              <p className="text-xs text-muted-foreground">Challenges</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {moments.reduce((sum, m) => sum + m.impactScore, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Net Impact</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
