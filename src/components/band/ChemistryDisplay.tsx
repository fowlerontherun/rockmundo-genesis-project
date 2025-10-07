import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { getChemistryLabel, getChemistryColor, getChemistryBenefits } from '@/utils/bandChemistry';

interface ChemistryDisplayProps {
  bandId: string;
}

export function ChemistryDisplay({ bandId }: ChemistryDisplayProps) {
  const [chemistry, setChemistry] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChemistryData();
  }, [bandId]);

  const loadChemistryData = async () => {
    try {
      const { data: band } = await supabase
        .from('bands')
        .select('chemistry_level')
        .eq('id', bandId)
        .single();

      const { data: chemEvents } = await supabase
        .from('band_chemistry_events')
        .select('*')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false })
        .limit(10);

      setChemistry(band?.chemistry_level || 0);
      setEvents(chemEvents || []);
    } catch (error) {
      console.error('Error loading chemistry data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  const benefits = getChemistryBenefits(chemistry);
  const label = getChemistryLabel(chemistry);
  const colorClass = getChemistryColor(chemistry);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Band Chemistry
          </CardTitle>
          <CardDescription>How well your band works together</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-3xl font-bold">{chemistry}/100</span>
            <span className={`text-lg font-semibold ${colorClass}`}>{label}</span>
          </div>
          <Progress value={chemistry} className="h-3" />
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Performance Quality</p>
              <p className="text-lg font-semibold">+{((benefits.performanceQuality - 1) * 100).toFixed(0)}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Skill Rating Bonus</p>
              <p className="text-lg font-semibold">+{((benefits.skillRatingBonus - 1) * 100).toFixed(0)}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fan Growth</p>
              <p className="text-lg font-semibold">+{((benefits.fanGrowth - 1) * 100).toFixed(0)}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Special Events</p>
              <p className="text-lg font-semibold">{benefits.isHighChemistry ? 'Unlocked' : 'Locked'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Chemistry Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chemistry events yet</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex items-center justify-between pb-3 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {event.chemistry_change > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {event.event_data?.description || event.event_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${event.chemistry_change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {event.chemistry_change > 0 ? '+' : ''}{event.chemistry_change}
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
