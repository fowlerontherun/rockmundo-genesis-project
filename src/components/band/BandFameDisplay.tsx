import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Star, TrendingUp, TrendingDown } from 'lucide-react';
import { getBandFameTitle, BAND_FAME_THRESHOLDS } from '@/utils/bandFame';

interface BandFameDisplayProps {
  bandId: string;
}

export function BandFameDisplay({ bandId }: BandFameDisplayProps) {
  const [band, setBand] = useState<any>(null);
  const [fameEvents, setFameEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFameData();
  }, [bandId]);

  const loadFameData = async () => {
    try {
      const { data: bandData } = await supabase
        .from('bands')
        .select('fame, collective_fame_earned, fame_multiplier, chemistry_level')
        .eq('id', bandId)
        .single();

      const { data: events } = await supabase
        .from('band_fame_events')
        .select('*')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false })
        .limit(10);

      setBand(bandData);
      setFameEvents(events || []);
    } catch (error) {
      console.error('Error loading fame data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !band) return <div>Loading...</div>;

  const currentFame = band.fame || 0;
  const fameTitle = getBandFameTitle(currentFame);
  
  const thresholdValues = Object.values(BAND_FAME_THRESHOLDS).sort((a, b) => a - b);
  const nextThreshold = thresholdValues.find(t => t > currentFame) || thresholdValues[thresholdValues.length - 1];
  const prevThreshold = [...thresholdValues].reverse().find(t => t <= currentFame) || 0;
  const progress = ((currentFame - prevThreshold) / (nextThreshold - prevThreshold)) * 100;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Band Fame
          </CardTitle>
          <CardDescription>Your band's reputation and reach</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-3xl font-bold">{currentFame.toLocaleString()}</span>
              <Badge variant="default">{fameTitle}</Badge>
            </div>
            <Progress value={Math.min(progress, 100)} className="h-3" />
            <p className="text-sm text-muted-foreground mt-2">
              {nextThreshold !== currentFame 
                ? `${(nextThreshold - currentFame).toLocaleString()} more to next tier`
                : 'Maximum fame tier reached!'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Collective Fame</p>
              <p className="text-lg font-semibold">{band.collective_fame_earned?.toLocaleString() || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fame Multiplier</p>
              <p className="text-lg font-semibold">{band.fame_multiplier?.toFixed(2)}x</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Chemistry-based multiplier from {band.chemistry_level}/100 chemistry
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Fame Events</CardTitle>
          <CardDescription>How your band has been growing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {fameEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fame events yet. Perform gigs to earn fame!</p>
            ) : (
              fameEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between pb-3 border-b last:border-0">
                  <div className="flex items-center gap-2 flex-1">
                    {event.fame_gained > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{event.event_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-green-500 flex-shrink-0 ml-2">
                    +{event.fame_gained}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
