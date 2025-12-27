import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Music, MapPin, DollarSign, Users, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { useGigCancellation } from '@/hooks/useGigCancellation';
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
  const { isLoading: isCancelling, calculateCancellationDetails, cancelGig } = useGigCancellation();

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
                  
                  {/* Ticket Sales Info */}
                  {gig.predicted_tickets > 0 && (
                    <div className="mt-2 rounded-md bg-muted/50 p-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tickets Sold</span>
                        <span className="font-semibold">
                          {gig.tickets_sold} / {gig.predicted_tickets}
                          <span className="ml-1 text-muted-foreground">
                            ({Math.round((gig.tickets_sold / gig.predicted_tickets) * 100)}%)
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (gig.tickets_sold / gig.predicted_tickets) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isPast && (
                    <Badge variant="secondary">Ready</Badge>
                  )}
                  
                  {/* Cancel Gig Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={isCancelling}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Gig?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          {(() => {
                            const details = calculateCancellationDetails(
                              gig.id,
                              gig.band_id,
                              gig.scheduled_date,
                              gig.payment || 0
                            );
                            return (
                              <>
                                <p>Are you sure you want to cancel this gig at <strong>{venue?.name}</strong>?</p>
                                <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
                                  <p><strong>Days until gig:</strong> {details.daysUntilGig}</p>
                                  <p><strong>Booking fee:</strong> ${details.bookingFee.toLocaleString()}</p>
                                  <p><strong>Refund amount:</strong> ${details.refundAmount.toLocaleString()} ({Math.round(details.refundPercentage * 100)}%)</p>
                                  {details.famePenalty > 0 && (
                                    <p className="text-destructive"><strong>Fame penalty:</strong> -{details.famePenalty}</p>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Earlier cancellations receive better refunds and lower penalties.
                                </p>
                              </>
                            );
                          })()}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Gig</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={async () => {
                            const details = calculateCancellationDetails(
                              gig.id,
                              gig.band_id,
                              gig.scheduled_date,
                              gig.payment || 0
                            );
                            const success = await cancelGig(details);
                            if (success) {
                              loadScheduledGigs();
                            }
                          }}
                        >
                          Cancel Gig
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

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
