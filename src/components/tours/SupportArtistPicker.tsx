import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { calculateSupportArtistSplit } from '@/lib/tourTypes';
import { Users, Search, Music, Star, X, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupportArtistPickerProps {
  value: string | null;
  valueName: string | null;
  onChange: (bandId: string | null, bandName: string | null, revenueShare: number) => void;
  headlinerBandId: string;
  headlinerFame: number;
  tourDates: string[];
}

export function SupportArtistPicker({
  value,
  valueName,
  onChange,
  headlinerBandId,
  headlinerFame,
  tourDates,
}: SupportArtistPickerProps) {
  const [search, setSearch] = useState('');
  
  // Fetch potential support bands (lower fame than headliner)
  const { data: bands, isLoading } = useQuery({
    queryKey: ['support-artist-candidates', headlinerBandId, headlinerFame],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bands')
        .select('id, name, fame, total_fans, genre')
        .neq('id', headlinerBandId)
        .lt('fame', headlinerFame)
        .gte('fame', Math.max(100, headlinerFame * 0.1)) // At least 10% of headliner fame
        .order('fame', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
  });

  // TODO: Check availability for each band against tour dates
  // This would require checking player_scheduled_activities for all band members

  const filteredBands = bands?.filter(band => 
    band.name.toLowerCase().includes(search.toLowerCase()) ||
    band.genre?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleSelectBand = (band: typeof bands[0]) => {
    const split = calculateSupportArtistSplit(headlinerFame, band.fame);
    onChange(band.id, band.name, split.supportPercent / 100);
  };

  const handleClear = () => {
    onChange(null, null, 0.1);
  };

  // Show selected band info
  if (value && valueName) {
    const selectedBand = bands?.find(b => b.id === value);
    const split = calculateSupportArtistSplit(headlinerFame, selectedBand?.fame || 0);
    
    return (
      <div className="space-y-4">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Support Artist
        </Label>
        
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Music className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{valueName}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-3 w-3" />
                    {selectedBand?.fame?.toLocaleString() || 0} fame
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {split.supportPercent}% revenue share
                </Badge>
                <Button variant="ghost" size="icon" onClick={handleClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              <p>
                Support artist receives {split.supportPercent}% of ticket revenue. 
                They will open each show and share the tour schedule.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4" />
          Invite Support Artist (Optional)
        </Label>
        <p className="text-sm text-muted-foreground">
          Invite a less famous band to open your shows. They get a share of ticket revenue.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bands by name or genre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-[300px] border rounded-lg">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading bands...
          </div>
        ) : filteredBands.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No eligible support bands found
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredBands.map(band => {
              const split = calculateSupportArtistSplit(headlinerFame, band.fame);
              
              return (
                <div
                  key={band.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleSelectBand(band)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Music className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{band.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {band.fame?.toLocaleString() || 0}
                        </span>
                        {band.genre && (
                          <Badge variant="outline" className="text-xs">
                            {band.genre}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {split.supportPercent}% share
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <Button variant="outline" className="w-full" onClick={handleClear}>
        Skip - No Support Artist
      </Button>
    </div>
  );
}
