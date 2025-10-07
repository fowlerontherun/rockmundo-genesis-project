import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Users, Star, TrendingUp, Activity } from 'lucide-react';
import { getBandFameTitle } from '@/utils/bandFame';
import { getChemistryLabel, getChemistryColor } from '@/utils/bandChemistry';

interface BandOverviewProps {
  bandId: string;
}

export function BandOverview({ bandId }: BandOverviewProps) {
  const [band, setBand] = useState<any>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBandData();
  }, [bandId]);

  const loadBandData = async () => {
    try {
      const { data: bandData } = await supabase
        .from('bands')
        .select('*')
        .eq('id', bandId)
        .single();

      const { data: members } = await supabase
        .from('band_members')
        .select('*')
        .eq('band_id', bandId);

      setBand(bandData);
      setMemberCount(members?.length || 0);
    } catch (error) {
      console.error('Error loading band:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !band) {
    return <div>Loading...</div>;
  }

  const fameProgress = ((band.fame % 1000) / 1000) * 100;
  const chemistryLabel = getChemistryLabel(band.chemistry_level);
  const chemistryColor = getChemistryColor(band.chemistry_level);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Band Fame
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold">{band.fame}</span>
            <Badge>{getBandFameTitle(band.fame)}</Badge>
          </div>
          <Progress value={fameProgress} className="h-2" />
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Collective Fame: {band.collective_fame_earned || 0}</div>
            <div>Fame Multiplier: {band.fame_multiplier?.toFixed(2)}x</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Band Chemistry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold">{band.chemistry_level}</span>
            <Badge className={chemistryColor}>{chemistryLabel}</Badge>
          </div>
          <Progress value={band.chemistry_level} className="h-2" />
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Performances: {band.performance_count || 0}</div>
            <div>Jam Sessions: {band.jam_count || 0}</div>
            <div>Days Together: {band.days_together || 0}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Band Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Members</span>
              <span className="font-medium">{memberCount}/{band.max_members}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Skill Rating</span>
              <span className="font-medium">{band.hidden_skill_rating || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Weekly Fans</span>
              <span className="font-medium">{band.weekly_fans || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Popularity</span>
              <span className="font-medium">{band.popularity || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>{band.is_solo_artist ? band.artist_name || band.name : band.name}</CardTitle>
          <CardDescription>
            {band.genre} {band.is_solo_artist ? '• Solo Artist' : '• Band'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{band.description || 'No description yet.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
