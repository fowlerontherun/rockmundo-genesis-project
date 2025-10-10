import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Music, MapPin, DollarSign, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/supabase-types';

type GigRow = Database['public']['Tables']['gigs']['Row'];
type VenueRow = Database['public']['Tables']['venues']['Row'];

type GigWithVenue = GigRow & {
  venues: VenueRow | null;
};

export function GigPerformanceTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scheduledGigs, setScheduledGigs] = useState<GigWithVenue[]>([]);

  const loadScheduledGigs = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Get user's band(s)
      const { data: bandMemberships, error: memberError } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const bandIds = bandMemberships?.map(m => m.band_id) ?? [];

      if (bandIds.length === 0) {
        setScheduledGigs([]);
        setLoading(false);
        return;
      }

      // Get scheduled gigs for those bands
      const { data: gigs, error: gigsError } = await supabase
        .from('gigs')
        .select(`
          *,
          venues:venues!gigs_venue_id_fkey (*)
        `)
        .in('band_id', bandIds)
        .eq('status', 'scheduled')
        .gte('scheduled_date', new Date().toISOString())
        .order('scheduled_date', { ascending: true });

      if (gigsError) throw gigsError;

      setScheduledGigs((gigs as any) ?? []);
    } catch (error) {
      console.error('Error loading scheduled gigs:', error);
      toast({
        title: 'Unable to load gigs',
        description: 'Failed to fetch your scheduled performances.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    void loadScheduledGigs();
  }, [loadScheduledGigs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (scheduledGigs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Music className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No scheduled gigs</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Book your first gig to start performing and earning.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/gigs">Book a Gig</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Scheduled Gigs</CardTitle>
          <CardDescription>
            Upcoming performances ready for you to take the stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduledGigs.map((gig) => {
            const venue = gig.venues;
            const scheduledDate = new Date(gig.scheduled_date);
            const isPast = scheduledDate.getTime() < Date.now();

            return (
              <div
                key={gig.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{venue?.name ?? 'Unknown Venue'}</span>
                    {gig.show_type && (
                      <Badge variant="outline" className="capitalize">
                        {gig.show_type.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {scheduledDate.toLocaleString()}
                    </div>
                    {venue?.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        {venue.location}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      {gig.payment ? `$${gig.payment.toLocaleString()}` : 'TBD'}
                    </div>
                    {venue?.capacity && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        Capacity: {venue.capacity}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isPast && (
                    <Badge variant="secondary">Ready</Badge>
                  )}
                  <Button asChild size="sm">
                    <Link to={`/performance/gig/${gig.id}`}>
                      Perform Now
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="text-center">
        <Button asChild variant="outline">
          <Link to="/gigs">Book More Gigs</Link>
        </Button>
      </div>
    </div>
  );
}
