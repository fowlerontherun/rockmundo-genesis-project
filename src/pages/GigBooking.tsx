import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, Clock, DollarSign, MapPin, Music, Star, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/supabase-types';
import { useSetlists } from '@/hooks/useSetlists';
import { GigBookingDialog } from '@/components/gig/GigBookingDialog';
import { GigHistoryTab } from '@/components/band/GigHistoryTab';
import { getSlotById, getSlotBadgeVariant } from '@/utils/gigSlots';
import { useAutoGigStart } from '@/hooks/useAutoGigStart';

type VenueRow = Database['public']['Tables']['venues']['Row'];
type GigRow = Database['public']['Tables']['gigs']['Row'];
type BandRow = Database['public']['Tables']['bands']['Row'];

type GigWithVenue = GigRow & { venues: VenueRow | null };

const DEFAULT_GIG_OFFSET_DAYS = 7;

const GigBooking = () => {
  const { user } = useAuth();
  const { profile, skills, attributes, addActivity } = useGameData();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [band, setBand] = useState<BandRow | null>(null);
  const [upcomingGigs, setUpcomingGigs] = useState<GigWithVenue[]>([]);
  const [bookingVenue, setBookingVenue] = useState<VenueRow | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  const { data: setlists } = useSetlists(band?.id || null);
  
  // Auto-start gigs that are past their scheduled time
  useAutoGigStart();

  const performanceSkill = skills?.performance ?? 0;
  const stagePresence = attributes?.stage_presence ?? 0;
  const crowdEngagement = attributes?.crowd_engagement ?? 0;
  const fame = profile?.fame ?? 0;

  const readinessScore = useMemo(() => {
    const attributeAverage = (stagePresence + crowdEngagement) / 2;
    const attributeScore = Math.min(100, Math.round(attributeAverage * 10));
    const fameScore = Math.min(100, Math.round(fame / 50));
    const combined = (performanceSkill + attributeScore + fameScore) / 3;

    if (!Number.isFinite(combined)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(combined)));
  }, [performanceSkill, stagePresence, crowdEngagement, fame]);

  const loadVenues = useCallback(async () => {
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .order('prestige_level', { ascending: true });

    if (error) {
      console.error('Error loading venues:', error);
      toast({
        title: 'Unable to load venues',
        description: 'There was a problem loading the available venues. Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    setVenues(data ?? []);
  }, [toast]);

  const resolveBand = useCallback(async (): Promise<BandRow | null> => {
    if (!user?.id) {
      return null;
    }

    // Check if user is a band leader with an active band
    const { data: leaderBand, error: leaderError } = await supabase
      .from('bands')
      .select('*')
      .eq('leader_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (leaderError && leaderError.code !== 'PGRST116') {
      console.error('Error loading band leadership info:', leaderError);
    }

    if (leaderBand) {
      return leaderBand as BandRow;
    }

    // Check if user is a band member in an active band
    const { data: memberRecord, error: memberError } = await supabase
      .from('band_members')
      .select('band_id, bands:bands!band_members_band_id_fkey(*)')
      .eq('user_id', user.id)
      .eq('bands.status', 'active')
      .maybeSingle();

    if (memberError && memberError.code !== 'PGRST116') {
      console.error('Error loading band membership info:', memberError);
    }

    if (memberRecord?.bands) {
      return memberRecord.bands as any;
    }

    return null;
  }, [user?.id]);

  const loadUpcomingGigs = useCallback(async (bandId: string) => {
    const { data, error } = await supabase
      .from('gigs')
      .select(`
        *,
        venues:venues!gigs_venue_id_fkey (*)
      `)
      .eq('band_id', bandId)
      .in('status', ['scheduled', 'in_progress'])
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Error loading gigs:', error);
      toast({
        title: 'Unable to load gigs',
        description: 'We could not fetch your scheduled performances. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setUpcomingGigs((data ?? []) as any);
  }, [toast]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      await loadVenues();
      const resolvedBand = await resolveBand();
      setBand(resolvedBand);

      if (resolvedBand) {
        await loadUpcomingGigs(resolvedBand.id);
      } else {
        setUpcomingGigs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadVenues, resolveBand, loadUpcomingGigs]);

  useEffect(() => {
    void loadData();
    
    // Reload gigs every 10 seconds to catch status changes
    const interval = setInterval(() => {
      if (band?.id) {
        loadUpcomingGigs(band.id);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [loadData, band?.id, loadUpcomingGigs]);

  const getNextGigDate = useCallback(() => {
    const now = new Date();
    const scheduledDates = upcomingGigs
      .map((gig) => new Date(gig.scheduled_date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const baseDate = scheduledDates.length ? scheduledDates[scheduledDates.length - 1] : now;
    const proposed = new Date(baseDate);
    proposed.setDate(proposed.getDate() + DEFAULT_GIG_OFFSET_DAYS);
    proposed.setHours(20, 0, 0, 0);

    return proposed;
  }, [upcomingGigs]);

  const previewNextGigDate = useMemo(() => getNextGigDate(), [getNextGigDate]);

  const handleBookingDialogConfirm = useCallback(async (
    setlistId: string, 
    ticketPrice: number,
    selectedDate: Date,
    selectedSlot: string
  ) => {
    if (!band || !bookingVenue) return;

    setIsBooking(true);

    try {
      const { getSlotById } = await import('@/utils/gigSlots');
      const { checkBandLockout } = await import('@/utils/bandLockout');
      
      // Check band lockout
      const lockout = await checkBandLockout(band.id);
      if (lockout.isLocked) {
        toast({
          title: 'Band is busy',
          description: lockout.reason,
          variant: 'destructive'
        });
        setIsBooking(false);
        return;
      }

      const slot = getSlotById(selectedSlot);
      if (!slot) {
        throw new Error('Invalid slot selected');
      }

      // Combine date with slot start time
      const scheduledDateTime = new Date(selectedDate);
      const [hours, minutes] = slot.startTime.split(':');
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate adjusted estimates with slot multiplier
      const baseAttendance = Math.floor(
        Math.min(
          bookingVenue.capacity || 100,
          ((band.fame || 0) * 2 + (band.popularity || 0) * 3) * (0.7 + Math.random() * 0.3)
        )
      );
      const estimatedAttendance = Math.floor(baseAttendance * slot.attendanceMultiplier);
      const adjustedPayment = Math.round((bookingVenue.base_payment || 0) * slot.paymentMultiplier);
      const estimatedRevenue = estimatedAttendance * ticketPrice;

      const { error } = await supabase.from('gigs').insert({
        band_id: band.id,
        venue_id: bookingVenue.id,
        scheduled_date: scheduledDateTime.toISOString(),
        status: 'scheduled',
        show_type: bookingVenue.venue_type ?? 'concert',
        payment: adjustedPayment,
        setlist_id: setlistId,
        ticket_price: ticketPrice,
        time_slot: selectedSlot,
        slot_start_time: slot.startTime,
        slot_end_time: slot.endTime,
        slot_attendance_multiplier: slot.attendanceMultiplier,
        estimated_attendance: estimatedAttendance,
        estimated_revenue: estimatedRevenue,
        attendance: 0,
        fan_gain: 0,
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Gig booked!',
        description: `${slot.name} at ${bookingVenue.name} on ${scheduledDateTime.toLocaleString()}.`,
      });

      await addActivity(
        'gig_booking',
        `Booked ${slot.name} at ${bookingVenue.name} for ${band.name}`,
        adjustedPayment ?? undefined,
        {
          venue_id: bookingVenue.id,
          scheduled_date: scheduledDateTime.toISOString(),
          estimated_revenue: estimatedRevenue,
          time_slot: selectedSlot
        },
      );

      await loadUpcomingGigs(band.id);
      setBookingVenue(null);
    } catch (error) {
      console.error('Error booking gig:', error);
      toast({
        title: 'Booking failed',
        description: 'We could not schedule that gig. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsBooking(false);
    }
  }, [band, bookingVenue, getNextGigDate, toast, addActivity, loadUpcomingGigs]);

  const renderRequirements = (requirements: VenueRow['requirements']) => {
    if (!requirements || typeof requirements !== 'object') {
      return null;
    }

    const entries = Object.entries(requirements as Record<string, unknown>);
    if (!entries.length) {
      return null;
    }

    return (
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Requirements</p>
        <ul className="list-disc space-y-1 pl-4">
          {entries.map(([key, value]) => (
            <li key={key}>
              <span className="capitalize">{key.replace(/_/g, ' ')}</span>: {String(value)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gig Booking</h1>
          <p className="text-muted-foreground">Book performances, grow your fanbase, and earn rewards.</p>
        </div>
        {band ? (
          <Badge variant="secondary" className="w-fit">
            Managing gigs for {band.name}
          </Badge>
        ) : (
          <Button asChild variant="outline">
            <Link to="/band">Create a band</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5 text-primary" />
              Performance Readiness
            </CardTitle>
            <CardDescription>
              Track how prepared your act is for upcoming shows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Overall readiness</span>
                <span>{readinessScore}%</span>
              </div>
              <Progress value={readinessScore} className="mt-2 h-2" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                Performance skill: {skills?.performance ?? 0}
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Crowd engagement: {attributes?.crowd_engagement ?? 0}
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Stage presence: {attributes?.stage_presence ?? 0}
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Fame: {profile?.fame ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Gigs
            </CardTitle>
            <CardDescription>
              Manage your scheduled performances and head to the stage when ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {band ? (
              <div className="space-y-4">
                {upcomingGigs.length ? (
                  upcomingGigs.map((gig) => {
                    const venue = gig.venues;
                    const scheduledDate = new Date(gig.scheduled_date);
                    const status = gig.status ?? 'scheduled';

                    return (
                        <div
                          key={gig.id}
                          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <Music className="h-4 w-4 text-primary" />
                              {venue?.name ?? 'Unassigned Venue'}
                              {gig.time_slot && (
                                <Badge variant={getSlotBadgeVariant(gig.time_slot)}>
                                  {getSlotById(gig.time_slot)?.name || gig.time_slot}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {scheduledDate.toLocaleDateString()}
                            </div>
                            {gig.slot_start_time && gig.slot_end_time && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {gig.slot_start_time} - {gig.slot_end_time}
                              </div>
                            )}
                            {venue?.location ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {venue.location}
                              </div>
                            ) : null}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <DollarSign className="h-4 w-4" />
                              {gig.payment ? `$${gig.payment.toLocaleString()}` : 'Payment TBD'}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Badge variant={
                              status === 'completed' ? 'default' : 
                              status === 'in_progress' ? 'default' : 
                              'secondary'
                            } className="capitalize">
                              {status === 'in_progress' ? 'Live Now' : status}
                            </Badge>
                            {(status === 'scheduled' || status === 'in_progress') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/gigs/perform/${gig.id}`)}
                              >
                                {status === 'in_progress' ? 'Watch Live' : 'View Details'}
                              </Button>
                            )}
                          </div>
                        </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    No gigs scheduled yet. Book a venue below to get started.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Join or create a band to start booking gigs.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="venues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="venues">Available Venues</TabsTrigger>
          <TabsTrigger value="history">Gig History</TabsTrigger>
        </TabsList>

        <TabsContent value="venues">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Available Venues
              </CardTitle>
              <CardDescription>
                Choose a venue that fits your level. We'll automatically schedule the next available slot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {venues.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {venues.map((venue) => (
                <Card key={venue.id} className="border-border">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{venue.name}</CardTitle>
                        {venue.location ? (
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {venue.location}
                          </CardDescription>
                        ) : null}
                      </div>
                      <Badge variant="outline">Prestige {venue.prestige_level ?? 'N/A'}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Capacity {venue.capacity ?? '—'}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Base pay {venue.base_payment ? `$${venue.base_payment.toLocaleString()}` : 'TBD'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Music className="h-3 w-3" />
                        {venue.venue_type ? venue.venue_type.replace(/_/g, ' ') : 'Concert'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Next slot {previewNextGigDate.toLocaleDateString()}
                      </div>
                    </div>
                    {renderRequirements(venue.requirements)}
                  </CardHeader>
                  <CardContent>
                     <Button
                       className="w-full"
                       size="sm"
                       onClick={() => setBookingVenue(venue)}
                       disabled={!band || isBooking}
                     >
                       Book Gig
                     </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No venues are currently available. Check back soon.
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          {band ? (
            <GigHistoryTab bandId={band.id} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Join or create a band to view gig history</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {bookingVenue && setlists && band && (
        <GigBookingDialog
          venue={bookingVenue}
          band={band}
          setlists={setlists.map(s => ({ id: s.id, name: s.name, song_count: s.song_count || 0 }))}
          onConfirm={handleBookingDialogConfirm}
          onClose={() => setBookingVenue(null)}
          isBooking={isBooking}
        />
      )}
    </div>
  );
};

export default GigBooking;