import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Music, Calendar, MapPin, ArrowLeft, Users, DollarSign } from 'lucide-react';
import { LiveGigPerformance } from '@/components/gig/LiveGigPerformance';
import { GigOutcomeReport } from '@/components/gig/GigOutcomeReport';
import { executeGigPerformance } from '@/utils/gigExecution';
import type { Database } from '@/lib/supabase-types';
import { format } from 'date-fns';

type GigWithVenue = Database['public']['Tables']['gigs']['Row'] & {
  venues: Database['public']['Tables']['venues']['Row'] | null;
};

export default function PerformGig() {
  const { gigId } = useParams<{ gigId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [gig, setGig] = useState<GigWithVenue | null>(null);
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [isPerforming, setIsPerforming] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcome, setOutcome] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadGig = useCallback(async () => {
    if (!gigId || !user) return;

    try {
      // Load gig details
      const { data: gigData, error: gigError } = await supabase
        .from('gigs')
        .select('*, venues!gigs_venue_id_fkey(*)')
        .eq('id', gigId)
        .single();

      if (gigError) throw gigError;

      // Check if gig already has an outcome
      const { data: existingOutcome } = await supabase
        .from('gig_outcomes')
        .select('*, gig_song_performances(*, songs(title))')
        .eq('gig_id', gigId)
        .single();

      if (existingOutcome) {
        // Gig already performed, show outcome
        const transformedOutcome = {
          ...existingOutcome,
          breakdown_data: {
            equipment_quality: existingOutcome.equipment_quality_avg || 0,
            crew_skill: existingOutcome.crew_skill_avg || 0,
            band_chemistry: existingOutcome.band_chemistry_level || 0,
            member_skills: existingOutcome.member_skill_avg || 0,
            merch_items_sold: existingOutcome.merch_items_sold || 0
          },
          chemistry_impact: existingOutcome.chemistry_change || 0,
          equipment_wear_cost: existingOutcome.equipment_cost || 0
        };
        setOutcome(transformedOutcome);
        setShowOutcome(true);
        setGig(gigData as any);
        setLoading(false);
        return;
      }

      setGig(gigData as any);

      // Load setlist songs if not performed yet
      if (gigData.setlist_id) {
        const { data: songs, error: songsError } = await supabase
          .from('setlist_songs')
          .select('*, songs!inner(id, title, genre, quality_score)')
          .eq('setlist_id', gigData.setlist_id)
          .order('position');

        if (songsError) throw songsError;
        setSetlistSongs(songs || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading gig:', error);
      toast({
        title: "Error",
        description: "Failed to load gig details",
        variant: "destructive"
      });
      navigate('/gig-booking');
    }
  }, [gigId, user, navigate, toast]);

  useEffect(() => {
    loadGig();
  }, [loadGig]);

  const handlePerformanceComplete = async (performances: any[]) => {
    if (!gig || !gig.setlist_id) return;

    setIsPerforming(true);

    try {
      const result = await executeGigPerformance({
        gigId: gig.id,
        bandId: gig.band_id,
        setlistId: gig.setlist_id,
        venueCapacity: gig.venues?.capacity || 100,
        ticketPrice: gig.ticket_price || 20
      });

      // Transform outcome for display
      const transformedOutcome = {
        ...result.outcome,
        gig_song_performances: result.songPerformances.map((sp: any) => ({
          ...sp,
          songs: { title: sp.song_title }
        })),
        breakdown_data: {
          equipment_quality: result.outcome.equipment_quality_avg || 0,
          crew_skill: result.outcome.crew_skill_avg || 0,
          band_chemistry: result.outcome.band_chemistry_level || 0,
          member_skills: result.outcome.member_skill_avg || 0,
          merch_items_sold: result.outcome.merch_items_sold || 0
        },
        chemistry_impact: result.outcome.chemistry_change || 0,
        equipment_wear_cost: result.outcome.equipment_cost || 0
      };

      setOutcome(transformedOutcome);
      setShowOutcome(true);

      toast({
        title: "Performance Complete!",
        description: `You earned $${result.netProfit.toLocaleString()} and gained ${result.fameGained} fame!`
      });
    } catch (error) {
      console.error('Error executing gig:', error);
      toast({
        title: "Error",
        description: "Failed to complete gig performance",
        variant: "destructive"
      });
    } finally {
      setIsPerforming(false);
    }
  };

  const handleCancel = () => {
    navigate('/gig-booking');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading gig details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Gig not found</p>
            <Button onClick={() => navigate('/gig-booking')} className="mt-4 w-full">
              Back to Gig Booking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showOutcome && outcome) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/gig-booking')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Gig Booking
        </Button>

        <GigOutcomeReport
          isOpen={true}
          onClose={() => navigate('/gig-booking')}
          outcome={outcome}
          venueName={gig.venues?.name || 'Unknown Venue'}
          venueCapacity={gig.venues?.capacity || 0}
          songs={setlistSongs.map(s => ({ id: s.song_id, title: s.songs?.title || 'Unknown' }))}
        />
      </div>
    );
  }

  const venueName = gig.venues?.name || 'Unknown Venue';
  const venueLocation = gig.venues?.location || 'Unknown Location';
  const capacity = gig.venues?.capacity || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/gig-booking')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Gig Booking
      </Button>

      {/* Gig Info Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-3">
            <Music className="h-8 w-8" />
            {venueName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-semibold">
                  {format(new Date(gig.scheduled_date), 'PPP p')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-semibold">{venueLocation}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Capacity</p>
                <p className="font-semibold">{capacity}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              <DollarSign className="h-3 w-3 mr-1" />
              ${gig.ticket_price} per ticket
            </Badge>
            <Badge variant="outline">
              {setlistSongs.length} songs in setlist
            </Badge>
            <Badge variant="default">
              {gig.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Performance */}
      {!isPerforming && setlistSongs.length > 0 && (
        <LiveGigPerformance
          songs={setlistSongs.map(s => ({
            id: s.song_id,
            title: s.songs?.title || 'Unknown Song',
            quality_score: s.songs?.quality_score || 50
          }))}
          onComplete={handlePerformanceComplete}
          onCancel={handleCancel}
        />
      )}

      {isPerforming && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg font-semibold">Processing performance results...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
