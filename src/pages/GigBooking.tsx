import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, CheckCircle2, Clock, DollarSign, Filter, Flag, MapPin, Music, PlayCircle, RefreshCw, Star, Ticket, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/supabase-types';
import { useSetlists } from '@/hooks/useSetlists';
import { GigBookingDialog, GigBookingSubmission } from '@/components/gig/GigBookingDialog';
import { GigHistoryTab } from '@/components/band/GigHistoryTab';
import { getSlotById, getSlotBadgeVariant } from '@/utils/gigSlots';
import { useAutoGigStart } from '@/hooks/useAutoGigStart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { checkBandLockout } from '@/utils/bandLockout';
import { getVenueCooldowns, type VenueCooldownResult, VENUE_COOLDOWN_DAYS_EXPORT } from '@/utils/venueCooldown';
import { formatDistanceToNow, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { predictTotalTicketSales } from '@/utils/ticketSalesSimulation';
import { buildDateInTimezone } from '@/utils/timezoneUtils';
import { TicketSalesDisplay } from '@/components/gig/TicketSalesDisplay';

type VenueRow = Database['public']['Tables']['venues']['Row'];
type GigRow = Database['public']['Tables']['gigs']['Row'];
type BandRow = Database['public']['Tables']['bands']['Row'];
type CityRow = Database['public']['Tables']['cities']['Row'];

type VenueWithCity = VenueRow & { cities?: CityRow | null };
type GigWithVenue = GigRow & { venues: VenueRow | null };

const DEFAULT_GIG_OFFSET_DAYS = 7;

const VENUE_SIZE_FILTERS = [
  { label: 'All Sizes', value: 'all', min: 0, max: Infinity },
  { label: 'Small (<200)', value: 'small', min: 0, max: 199 },
  { label: 'Medium (200-1000)', value: 'medium', min: 200, max: 999 },
  { label: 'Large (1000-5000)', value: 'large', min: 1000, max: 4999 },
  { label: 'Arena (5000+)', value: 'arena', min: 5000, max: Infinity }
];

const GigBooking = () => {
  const { user } = useAuth();
  const { profile, skills, attributes, addActivity, currentCity } = useGameData();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState<VenueWithCity[]>([]);
  const [band, setBand] = useState<BandRow | null>(null);
  const [upcomingGigs, setUpcomingGigs] = useState<GigWithVenue[]>([]);
  const [bookingVenue, setBookingVenue] = useState<VenueRow | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bandLockout, setBandLockout] = useState<{ isLocked: boolean; lockedUntil?: Date; reason?: string }>({ isLocked: false });
  const [venueCooldowns, setVenueCooldowns] = useState<Map<string, VenueCooldownResult>>(new Map());
  
  // Filter state
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedVenueSize, setSelectedVenueSize] = useState<string>('all');
  const [countries, setCountries] = useState<string[]>([]);
  const [playerCountry, setPlayerCountry] = useState<string | null>(null);

  const { data: setlists } = useSetlists(band?.id || null);
  const eligibleSetlists = useMemo(() => (setlists ?? []).filter((sl) => (sl.song_count ?? 0) >= 6), [setlists]);
  const hasEligibleSetlists = eligibleSetlists.length > 0;
  
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

  // Set player's country as default filter when currentCity loads
  useEffect(() => {
    if (currentCity?.country && !playerCountry) {
      setPlayerCountry(currentCity.country);
      setSelectedCountry(currentCity.country);
    }
  }, [currentCity, playerCountry]);

  const loadVenues = useCallback(async () => {
    const { data, error } = await supabase
      .from('venues')
      .select(`
        *,
        cities!city_id (id, name, country, timezone)
      `)
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

    const venueData = (data ?? []) as VenueWithCity[];
    setVenues(venueData);
    
    // Extract unique countries from venues
    const uniqueCountries = [...new Set(
      venueData
        .map(v => v.cities?.country)
        .filter((c): c is string => !!c)
    )].sort();
    setCountries(uniqueCountries);
  }, [toast]);

  // Filter venues based on selected country and size
  const filteredVenues = useMemo(() => {
    return venues.filter(venue => {
      // Country filter
      if (selectedCountry !== 'all') {
        const venueCountry = venue.cities?.country;
        if (venueCountry !== selectedCountry) return false;
      }
      
      // Size filter
      if (selectedVenueSize !== 'all') {
        const sizeFilter = VENUE_SIZE_FILTERS.find(s => s.value === selectedVenueSize);
        if (sizeFilter && venue.capacity) {
          if (venue.capacity < sizeFilter.min || venue.capacity > sizeFilter.max) return false;
        }
      }
      
      return true;
    });
  }, [venues, selectedCountry, selectedVenueSize]);

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
      .in('status', ['scheduled', 'in_progress', 'ready_for_completion'])
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

  const updateBandLockout = useCallback(async (bandId: string) => {
    const lockout = await checkBandLockout(bandId);
    setBandLockout(lockout);
  }, []);

  const updateVenueCooldowns = useCallback(async (bandId: string, venueList: VenueRow[]) => {
    const venueIds = venueList.map(v => v.id);
    const cooldowns = await getVenueCooldowns(bandId, venueIds);
    setVenueCooldowns(cooldowns);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      await loadVenues();
      const resolvedBand = await resolveBand();
      setBand(resolvedBand);

      if (resolvedBand) {
        await Promise.all([
          loadUpcomingGigs(resolvedBand.id),
          updateBandLockout(resolvedBand.id)
        ]);
      } else {
        setUpcomingGigs([]);
        setBandLockout({ isLocked: false });
        setVenueCooldowns(new Map());
      }
    } finally {
      setLoading(false);
    }
  }, [loadVenues, resolveBand, loadUpcomingGigs, updateBandLockout]);

  useEffect(() => {
    void loadData();
    
    // Reload gigs every 10 seconds to catch status changes
    const interval = setInterval(() => {
      if (band?.id) {
        loadUpcomingGigs(band.id);
        updateBandLockout(band.id);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [loadData, band?.id, loadUpcomingGigs, updateBandLockout]);

  // Load venue cooldowns when band and venues are available
  useEffect(() => {
    if (band?.id && venues.length > 0) {
      updateVenueCooldowns(band.id, venues);
    }
  }, [band?.id, venues, updateVenueCooldowns]);
  
  const getNextAvailableDateForVenue = useCallback((venueId: string) => {
    const now = new Date();
    const candidateTimes: number[] = [now.getTime()];

    const venueGigTimes = upcomingGigs
      .filter((gig) => gig.venue_id === venueId)
      .map((gig) => new Date(gig.scheduled_date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => date.getTime());

    if (venueGigTimes.length) {
      const latestGigTime = Math.max(...venueGigTimes);
      const nextAfterLatest = new Date(latestGigTime);
      nextAfterLatest.setDate(nextAfterLatest.getDate() + DEFAULT_GIG_OFFSET_DAYS);
      candidateTimes.push(nextAfterLatest.getTime());
    } else {
      const defaultDate = new Date(now);
      defaultDate.setDate(defaultDate.getDate() + DEFAULT_GIG_OFFSET_DAYS);
      candidateTimes.push(defaultDate.getTime());
    }

    if (bandLockout.lockedUntil) {
      candidateTimes.push(bandLockout.lockedUntil.getTime());
    }

    // Check venue-specific cooldown
    const venueCooldown = venueCooldowns.get(venueId);
    if (venueCooldown?.isOnCooldown && venueCooldown.cooldownEndsAt) {
      candidateTimes.push(venueCooldown.cooldownEndsAt.getTime());
    }

    const target = new Date(Math.max(...candidateTimes));
    target.setHours(20, 0, 0, 0);
    return target;
  }, [upcomingGigs, bandLockout.lockedUntil, venueCooldowns]);

  const handleBookingDialogConfirm = useCallback(async ({
    setlistId,
    ticketPrice,
    selectedDate,
    selectedSlot,
    attendanceForecast,
    estimatedRevenue,
    riderId,
    venuePayout,
  }: GigBookingSubmission) => {
    if (!band || !bookingVenue) return;

    setIsBooking(true);

    try {
      const { getSlotById } = await import('@/utils/gigSlots');
      const { checkBandLockout } = await import('@/utils/bandLockout');
      const { checkVenueCooldown } = await import('@/utils/venueCooldown');
      
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

      // Check venue cooldown
      const venueCooldown = await checkVenueCooldown(band.id, bookingVenue.id);
      if (venueCooldown.isOnCooldown) {
        toast({
          title: 'Venue on cooldown',
          description: `You played here recently. You can book again in ${venueCooldown.daysRemaining} day${venueCooldown.daysRemaining !== 1 ? 's' : ''}.`,
          variant: 'destructive'
        });
        setIsBooking(false);
        return;
      }

      const slot = getSlotById(selectedSlot);
      if (!slot) {
        throw new Error('Invalid slot selected');
      }

      // Combine date with slot start time in the VENUE's timezone
      // so "8 PM" means 8 PM in Nashville, not 8 PM in the user's browser
      const venueCity = (bookingVenue as VenueWithCity).cities;
      const venueTimezone = venueCity?.timezone;
      
      const [hours, minutes] = slot.startTime.split(':');
      let scheduledDateTime: Date;
      
      if (venueTimezone) {
        // Interpret the selected date+time as being in the venue's timezone
        scheduledDateTime = buildDateInTimezone(
          selectedDate,
          parseInt(hours),
          parseInt(minutes),
          venueTimezone
        );
      } else {
        // Fallback: use local browser time if no timezone available
        scheduledDateTime = new Date(selectedDate);
        scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      // Check for double-booking: ensure band doesn't have another gig at the same date/time
      const { data: conflictingGig } = await supabase
        .from('gigs')
        .select('id, time_slot, venues(name)')
        .eq('band_id', band.id)
        .eq('time_slot', selectedSlot)
        .in('status', ['scheduled', 'in_progress'])
        .gte('scheduled_date', startOfDay(selectedDate).toISOString())
        .lt('scheduled_date', endOfDay(selectedDate).toISOString())
        .maybeSingle();

      if (conflictingGig) {
        const venueName = (conflictingGig.venues as any)?.name || 'another venue';
        toast({
          title: 'Scheduling Conflict',
          description: `Your band already has a gig at ${venueName} during this time slot on this date.`,
          variant: 'destructive'
        });
        setIsBooking(false);
        return;
      }

      // Calculate adjusted estimates with slot multiplier
      const venueCapacity = bookingVenue.capacity ?? attendanceForecast.realistic;
      const estimatedAttendance = Math.min(venueCapacity, attendanceForecast.realistic);
      
      // Calculate booking fee (10% of estimated revenue, min $50)
      const bookingFee = Math.max(50, Math.round(estimatedRevenue * 0.10));
      
      // Check if band can afford the booking fee
      const { data: bandData } = await supabase
        .from('bands')
        .select('band_balance')
        .eq('id', band.id)
        .single();
      
      if (!bandData || (bandData.band_balance || 0) < bookingFee) {
        toast({
          title: 'Insufficient funds',
          description: `You need $${bookingFee} to book this gig. Current balance: $${bandData?.band_balance || 0}`,
          variant: 'destructive'
        });
        setIsBooking(false);
        return;
      }
      
      // Deduct booking fee from band balance
      await supabase
        .from('bands')
        .update({ band_balance: (bandData.band_balance || 0) - bookingFee })
        .eq('id', band.id);

      // Calculate days booked in advance
      const daysBooked = differenceInDays(scheduledDateTime, new Date());
      
      // Calculate predicted ticket sales
      const predictedTickets = predictTotalTicketSales({
        bandFame: band.fame || 0,
        bandTotalFans: band.total_fans || 0,
        venueCapacity: venueCapacity,
        daysUntilGig: daysBooked,
        daysBooked: daysBooked,
        ticketPrice: ticketPrice
      });

      const { data: newGig, error } = await supabase.from('gigs').insert({
        band_id: band.id,
        venue_id: bookingVenue.id,
        scheduled_date: scheduledDateTime.toISOString(),
        status: 'scheduled',
        show_type: bookingVenue.venue_type ?? 'concert',
        payment: venuePayout || 0, // Venue payment based on fame/fans/venue size
        booking_fee: bookingFee,
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
        predicted_tickets: predictedTickets,
        tickets_sold: 0,
        last_ticket_update: new Date().toISOString(),
        rider_id: riderId || null,
      }).select().single();

      if (error) {
        throw error;
      }

      // Create scheduled activity for ALL band members (blocks everyone during performance)
      let gigEndTime: Date;
      if (venueTimezone) {
        gigEndTime = buildDateInTimezone(
          selectedDate,
          parseInt(slot.endTime.split(':')[0]),
          parseInt(slot.endTime.split(':')[1]),
          venueTimezone
        );
      } else {
        gigEndTime = new Date(scheduledDateTime);
        const [endHours, endMinutes] = slot.endTime.split(':');
        gigEndTime.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
      }

      const venueCityName = venueCity?.name;

      // Import and use band-wide scheduling
      const { createBandScheduledActivities } = await import('@/utils/bandActivityScheduling');
      
      await createBandScheduledActivities({
        bandId: band.id,
        activityType: 'gig',
        scheduledStart: scheduledDateTime,
        scheduledEnd: gigEndTime,
        title: `Gig at ${bookingVenue.name}`,
        location: bookingVenue.name,
        linkedGigId: newGig.id,
        metadata: {
          venueId: bookingVenue.id,
          slotId: selectedSlot,
          venue_timezone: venueTimezone,
          venue_city_name: venueCityName,
        },
      });

      toast({
        title: 'Gig booked!',
        description: `${slot.name} at ${bookingVenue.name} on ${scheduledDateTime.toLocaleString()}.`,
      });

      await addActivity(
        'gig_booking',
        `Booked ${slot.name} at ${bookingVenue.name} for ${band.name} (booking fee: $${bookingFee})`,
        bookingFee,
        {
          venue_id: bookingVenue.id,
          scheduled_date: scheduledDateTime.toISOString(),
          estimated_revenue: estimatedRevenue,
          time_slot: selectedSlot,
          attendance_forecast: attendanceForecast as any
        },
      );

      await loadUpcomingGigs(band.id);
      await updateBandLockout(band.id);
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
  }, [band, bookingVenue, toast, addActivity, loadUpcomingGigs, updateBandLockout]);

  const getGigStatusConfig = useCallback((status: string) => {
    switch (status) {
      case 'in_progress':
        return {
          badgeVariant: 'default' as const,
          badgeLabel: 'Live Now',
          icon: <PlayCircle className="h-3 w-3" />,
          buttonLabel: 'Watch Live',
          buttonVariant: 'default' as const,
        };
      case 'ready_for_completion':
        return {
          badgeVariant: 'outline' as const,
          badgeLabel: 'Needs Finalization',
          icon: <Flag className="h-3 w-3" />,
          buttonLabel: 'Finalize Outcome',
          buttonVariant: 'default' as const,
        };
      case 'completed':
        return {
          badgeVariant: 'secondary' as const,
          badgeLabel: 'Completed',
          icon: <CheckCircle2 className="h-3 w-3" />,
          buttonLabel: 'View Report',
          buttonVariant: 'outline' as const,
        };
      default:
        return {
          badgeVariant: 'secondary' as const,
          badgeLabel: status,
          icon: <Clock className="h-3 w-3" />,
          buttonLabel: 'View Details',
          buttonVariant: 'outline' as const,
        };
    }
  }, []);

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
          <h1 className="text-3xl font-bold">{t('gigs.title')}</h1>
          <p className="text-muted-foreground">{t('gigs.bookGig', 'Book performances, grow your fanbase, and earn rewards.')}</p>
        </div>
        {band ? (
          <Badge variant="secondary" className="w-fit">
            {t('band.title', 'Managing gigs for')} {band.name}
          </Badge>
        ) : (
          <Button asChild variant="outline">
            <Link to="/band">{t('band.createBand')}</Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="book" className="space-y-4">
        <TabsList>
          <TabsTrigger value="book">
            <MapPin className="h-4 w-4 mr-1" />
            Book
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            <Calendar className="h-4 w-4 mr-1" />
            Upcoming Gigs
            {upcomingGigs.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1">
                {upcomingGigs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <CheckCircle className="h-4 w-4 mr-1" />
            Gig History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="space-y-4">
          {/* Performance Readiness Card */}
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

          {/* Venue Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5 text-primary" />
                Filter Venues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Country</label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {countries.map(country => (
                        <SelectItem key={country} value={country}>
                          {country} {country === playerCountry && '(Your Location)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Venue Size</label>
                  <Select value={selectedVenueSize} onValueChange={setSelectedVenueSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENUE_SIZE_FILTERS.map(size => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Showing {filteredVenues.length} of {venues.length} venues
              </p>
            </CardContent>
          </Card>

          {/* Available Venues */}
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
              {band && !hasEligibleSetlists && (
                <Alert className="mb-4">
                  <AlertTitle>No qualifying setlists yet</AlertTitle>
                  <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>Create a setlist with at least six songs to unlock venue bookings.</span>
                    <Button asChild size="sm">
                      <Link to="/setlists">Create setlist</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {filteredVenues.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredVenues.map((venue) => {
                    const nextSlotDate = getNextAvailableDateForVenue(venue.id);
                    const cooldownLabel = bandLockout.isLocked && bandLockout.lockedUntil
                      ? formatDistanceToNow(bandLockout.lockedUntil, { addSuffix: true })
                      : null;
                    const venueCooldown = venueCooldowns.get(venue.id);
                    const isVenueOnCooldown = venueCooldown?.isOnCooldown ?? false;

                    return (
                      <Card key={venue.id} className={`border-border ${isVenueOnCooldown ? 'opacity-75' : ''}`}>
                        <CardHeader className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">{venue.name}</CardTitle>
                              {(venue.location || venue.cities?.name) ? (
                                <CardDescription className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {venue.cities?.name && venue.cities?.country 
                                    ? `${venue.cities.name}, ${venue.cities.country}`
                                    : venue.location}
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
                              Next slot {nextSlotDate.toLocaleDateString()}
                            </div>
                          </div>
                          {isVenueOnCooldown && venueCooldown && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
                              <Clock className="h-3 w-3" />
                              Venue cooldown: {venueCooldown.daysRemaining} day{venueCooldown.daysRemaining !== 1 ? 's' : ''} remaining ({VENUE_COOLDOWN_DAYS_EXPORT} day minimum between gigs)
                            </div>
                          )}
                          {bandLockout.isLocked && !isVenueOnCooldown && (
                            <div className="flex items-center gap-1 text-xs text-amber-600">
                              <Clock className="h-3 w-3" />
                              Band cooldown ends {cooldownLabel ?? 'soon'}
                            </div>
                          )}
                          {renderRequirements(venue.requirements)}
                        </CardHeader>
                        <CardContent>
                          <Button
                            className="w-full"
                            size="sm"
                            onClick={() => setBookingVenue(venue)}
                            disabled={!band || isBooking || bandLockout.isLocked || isVenueOnCooldown || !hasEligibleSetlists}
                          >
                            {isVenueOnCooldown ? 'On Cooldown' : 'Book Gig'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No venues match your current filters. Try adjusting your filters above.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    Upcoming Gigs
                  </CardTitle>
                  <CardDescription>
                    Manage your scheduled performances and head to the stage when ready.
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => band?.id && loadUpcomingGigs(band.id)}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {band ? (
                <div className="space-y-4">
                  {upcomingGigs.length ? (
                    upcomingGigs.map((gig) => {
                      const venue = gig.venues;
                      const scheduledDate = new Date(gig.scheduled_date);
                      const status = gig.status ?? 'scheduled';
                      const statusConfig = getGigStatusConfig(status);

                      return (
                        <div
                          key={gig.id}
                          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="space-y-2 flex-1">
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
                            
                            {/* Ticket Sales Display - Prominent */}
                            {gig.status === 'scheduled' && gig.predicted_tickets && venue?.capacity && (
                              <div className="mt-3 p-3 bg-card rounded-lg border">
                                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                                  <Ticket className="h-4 w-4 text-primary" />
                                  Ticket Sales
                                </div>
                                <TicketSalesDisplay
                                  ticketsSold={gig.tickets_sold || 0}
                                  predictedTickets={gig.predicted_tickets}
                                  venueCapacity={venue.capacity}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 sm:items-end">
                            <Badge variant={statusConfig.badgeVariant} className="flex items-center gap-1 capitalize w-fit">
                              {statusConfig.icon}
                              {statusConfig.badgeLabel}
                            </Badge>
                            <Button
                              size="sm"
                              variant={statusConfig.buttonVariant}
                              onClick={() => navigate(`/gigs/perform/${gig.id}`)}
                            >
                              {statusConfig.buttonLabel}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      No gigs scheduled yet. Book a venue to get started.
                      <Button asChild size="sm" className="mt-2">
                        <Link to="#" onClick={() => document.querySelector('[value="book"]')?.dispatchEvent(new MouseEvent('click'))}>
                          Browse Venues
                        </Link>
                      </Button>
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
          initialDate={getNextAvailableDateForVenue(bookingVenue.id)}
        />
      )}
    </div>
  );
};

export default GigBooking;
