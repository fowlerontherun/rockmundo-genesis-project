import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth-context";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useMajorEvents, useMajorEventPerformances, useAcceptMajorEvent } from "@/hooks/useMajorEvents";
import { MajorEventSongSelector } from "@/components/major-events/MajorEventSongSelector";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Trophy, 
  Users, 
  Star, 
  DollarSign, 
  TrendingUp, 
  Loader2, 
  Play,
  CheckCircle,
  Lock,
  Sparkles,
  Music
} from "lucide-react";

const categoryIcons: Record<string, string> = {
  sports: '🏟️',
  music: '🎵',
  tv: '📺',
  holiday: '🎆',
};

const categoryColors: Record<string, string> = {
  sports: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  music: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  tv: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  holiday: 'bg-red-500/10 text-red-500 border-red-500/30',
};

export default function MajorEvents() {
  const { user } = useAuth();
  const { data: primaryBand } = usePrimaryBand();
  const activeBand = primaryBand?.bands ? { id: primaryBand.band_id, ...primaryBand.bands } as any : null;
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useMajorEvents();
  const { data: performances = [] } = useMajorEventPerformances(user?.id);
  const acceptEvent = useAcceptMajorEvent();

  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [songSelectorOpen, setSongSelectorOpen] = useState(false);

  const bandFame = activeBand?.fame || 0;

  const handleAcceptInvitation = (instanceId: string) => {
    setSelectedInstance(instanceId);
    setSongSelectorOpen(true);
  };

  const handleSongConfirm = (song1Id: string, song2Id: string, song3Id: string) => {
    if (!selectedInstance || !activeBand) return;
    acceptEvent.mutate({
      instanceId: selectedInstance,
      bandId: activeBand.id,
      song1Id,
      song2Id,
      song3Id,
    });
  };

  const getPerformanceForInstance = (instanceId: string) => {
    return performances.find(p => p.instance_id === instanceId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          Major Events
        </h1>
        <p className="text-muted-foreground mt-1">
          Perform at the world's biggest events for massive cash, fame, and fans.
        </p>
      </div>

      {!activeBand && (
        <Alert>
          <Music className="h-4 w-4" />
          <AlertDescription>
            You need a band to perform at major events. Create or join a band first!
          </AlertDescription>
        </Alert>
      )}

      {activeBand && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-sm">Your Band Fame: <strong>{bandFame.toLocaleString()}</strong></span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className={bandFame >= 5000 ? 'border-yellow-500 text-yellow-500' : 'opacity-50'}>
                  Tier 1 (5000+)
                </Badge>
                <Badge variant="outline" className={bandFame >= 2000 ? 'border-blue-500 text-blue-500' : 'opacity-50'}>
                  Tier 2 (2000+)
                </Badge>
                <Badge variant="outline" className={bandFame >= 800 ? 'border-green-500 text-green-500' : 'opacity-50'}>
                  Tier 3 (800+)
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Performances */}
      {performances.filter(p => p.status === 'completed').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Past Performances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {performances.filter(p => p.status === 'completed').map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">{p.instance?.event?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Rating: {(p.overall_rating || 0).toFixed(1)}% · ${(p.cash_earned || 0).toLocaleString()} earned
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/major-events/perform/${p.id}`)}>
                  View Report
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Available Events */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Available Events</h2>
        {events.map((instance) => {
          const event = instance.event;
          if (!event) return null;

          const qualified = bandFame >= event.min_fame_required;
          const existingPerformance = getPerformanceForInstance(instance.id);
          const catColor = categoryColors[event.category] || categoryColors.sports;

          return (
            <Card key={instance.id} className={`transition-all ${!qualified ? 'opacity-60' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{categoryIcons[event.category] || '🎤'}</span>
                      <div>
                        <h3 className="text-lg font-bold">{event.name}</h3>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={catColor}>
                        {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" />
                        {event.audience_size.toLocaleString()} audience
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${(event.base_cash_reward / 1000).toFixed(0)}K - ${(event.max_cash_reward / 1000).toFixed(0)}K
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {event.fame_multiplier}x fame
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3" />
                        Min Fame: {event.min_fame_required.toLocaleString()}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {existingPerformance ? (
                      existingPerformance.status === 'completed' ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" /> Completed
                        </Badge>
                      ) : (
                        <Button 
                          onClick={() => navigate(`/major-events/perform/${existingPerformance.id}`)}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" />
                          {existingPerformance.status === 'in_progress' ? 'Continue' : 'Perform Now'}
                        </Button>
                      )
                    ) : qualified ? (
                      <Button
                        onClick={() => handleAcceptInvitation(instance.id)}
                        disabled={!activeBand || acceptEvent.isPending}
                        className="gap-2"
                      >
                        {acceptEvent.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Accept Invitation
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" /> Need {event.min_fame_required} Fame
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeBand && (
        <MajorEventSongSelector
          open={songSelectorOpen}
          onOpenChange={setSongSelectorOpen}
          bandId={activeBand.id}
          onConfirm={handleSongConfirm}
        />
      )}
    </div>
  );
}
