import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Calendar, MapPin, Users, DollarSign, Clock, Star, Music, Volume2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { applyEquipmentWear } from "@/utils/equipmentWear";
import { fetchEnvironmentModifiers, type EnvironmentModifierSummary, type AppliedEnvironmentEffect } from "@/utils/worldEnvironment";
import type { Database, Json } from "@/integrations/supabase/types";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type GigRow = Database["public"]["Tables"]["gigs"]["Row"];
type GigInsertPayload = Database["public"]["Tables"]["gigs"]["Insert"] & {
  environment_modifiers?: EnvironmentModifierSummary | null;
};
type GigUpdatePayload = Database["public"]["Tables"]["gigs"]["Update"] & {
  environment_modifiers?: EnvironmentModifierSummary | null;
};
type GigRecord = GigRow & {
  venues: VenueRow | null;
  environment_modifiers?: EnvironmentModifierSummary | null;
};

type JsonRequirementRecord = Extract<Json, Record<string, number | boolean | string | null>>;
type VenueRequirements = JsonRequirementRecord & {
  min_popularity?: number | null;
};

type VenueRequirements = Record<string, number>;

interface Venue {
  id: string;
  name: string;
  location: string;
  capacity: number;
  venue_type: string;
  base_payment: number;
  prestige_level: number;
  requirements: VenueRequirements;
}

interface Gig {
  id: string;
  venue_id: string;
  band_id?: string;
  scheduled_date: string;
  payment: number;
  status: string;
  attendance: number;
  fan_gain: number;
  venue: Venue;
  environment_modifiers?: EnvironmentModifierSummary | null;
}

const normalizeVenueRequirements = (
  requirements: VenueRow["requirements"] | VenueRequirements | null | undefined,
): VenueRequirements => {
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) {
    return {};
  }

  const normalized: VenueRequirements = {};

  for (const [key, value] of Object.entries(requirements)) {
    if (key === "min_popularity") {
      if (typeof value === "number") {
        normalized.min_popularity = value;
      } else if (typeof value === "string") {
        const parsedValue = Number(value);
        if (!Number.isNaN(parsedValue)) {
          normalized.min_popularity = parsedValue;
        }
      }
      continue;
    }

    if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
      normalized[key] = value;
    }
  }

  return normalized;
};

const GigBooking = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, skills, updateProfile, addActivity } = useGameData();
  
  const [venues, setVenues] = useState<Venue[]>([]);
  const [playerGigs, setPlayerGigs] = useState<Gig[]>([]);
  const [selectedGig, setSelectedGig] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const loadVenues = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('prestige_level, capacity');

      if (error) throw error;
      const venueRows = (data ?? []) as VenueRow[];
      setVenues(venueRows.map(venue => ({
        id: venue.id,
        name: venue.name,
        location: venue.location ?? 'Unknown',
        capacity: venue.capacity ?? 0,
        venue_type: venue.venue_type ?? 'general',
        base_payment: venue.base_payment ?? 0,
        prestige_level: venue.prestige_level ?? 1,
        requirements: (venue.requirements as VenueRequirements | null) ?? ({} as VenueRequirements)
      })));
    } catch (error: unknown) {
      const fallbackMessage = "Failed to load venues";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading venues:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    }
  }, [toast]);

  const loadPlayerGigs = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('gigs')
        .select(`
          *,
          venues!gigs_venue_id_fkey(*)
        `)
        .eq('band_id', user.id) // For solo artists, band_id can be user_id
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      const gigRows = (data ?? []) as GigRecord[];
      setPlayerGigs(gigRows.map(gig => {
        const venueDetails = gig.venues;
        const venue: Venue = {
          id: venueDetails?.id ?? gig.venue_id,
          name: venueDetails?.name ?? 'Unknown Venue',
          location: venueDetails?.location ?? 'Unknown',
          capacity: venueDetails?.capacity ?? 0,
          venue_type: venueDetails?.venue_type ?? 'general',
          base_payment: venueDetails?.base_payment ?? 0,
          prestige_level: venueDetails?.prestige_level ?? 1,
          requirements: (venueDetails?.requirements as VenueRequirements | null) ?? ({} as VenueRequirements)
        };

        return {
          id: gig.id,
          venue_id: gig.venue_id,
          band_id: gig.band_id ?? undefined,
          scheduled_date: gig.scheduled_date,
          payment: gig.payment ?? 0,
          status: gig.status ?? 'scheduled',
          attendance: gig.attendance ?? 0,
          fan_gain: gig.fan_gain ?? 0,
          venue,
          environment_modifiers: gig.environment_modifiers ?? null
        };
      }));
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to load player gigs';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading player gigs:', errorMessage, error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadVenues();
      loadPlayerGigs();
    }
  }, [user, loadVenues, loadPlayerGigs]);

  const calculateGigPayment = (venue: Venue) => {
    const popularityBonus = Math.round(venue.base_payment * ((profile?.fame || 0) / 1000));
    const skillBonus = Math.round(venue.base_payment * ((skills?.performance || 0) / 200));
    return venue.base_payment + popularityBonus + skillBonus;
  };

  const calculateSuccessChance = (venue: Venue) => {
    const skillFactor = ((skills?.performance || 0) + (skills?.vocals || 0)) / 2;
    const popularityFactor = Math.min(profile?.fame || 0, 100);
    const baseChance = 50;
    
    return Math.min(95, Math.max(10, baseChance + (skillFactor / 2) + (popularityFactor / 5)));
  };

  const meetsRequirements = (venue: Venue) => {
    const reqs = venue.requirements;
        if (reqs.min_popularity && (profile?.fame || 0) < reqs.min_popularity) {
      return false;
    }

    return true;
  };

  const bookGig = async (venue: Venue) => {
    if (!user || !profile) return;

    if (!meetsRequirements(venue)) {
      toast({
        variant: "destructive",
        title: "Requirements not met",
        description: "You don't meet the requirements for this venue",
      });
      return;
    }

    setBooking(true);

    try {
      // Generate a future date (1-14 days from now)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 14) + 1);
      
      const payment = calculateGigPayment(venue);

      let environmentSummary: EnvironmentModifierSummary | null = null;
      try {
        environmentSummary = await fetchEnvironmentModifiers(venue.location, futureDate.toISOString());
      } catch (envError) {
        console.error('Error fetching environment modifiers for gig:', envError);
      }

      const baseAttendance = Math.max(1, Math.round(venue.capacity * 0.6));
      const attendanceMultiplier = environmentSummary?.attendanceMultiplier ?? 1;
      const projectedAttendance = Math.max(1, Math.round(baseAttendance * attendanceMultiplier));

      const gigInsertPayload: GigInsertPayload = {
        venue_id: venue.id,
        band_id: user.id,
        scheduled_date: futureDate.toISOString(),
        payment,
        status: 'scheduled',
        attendance: projectedAttendance,
        environment_modifiers: environmentSummary
          ? {
              ...environmentSummary,
              projections: {
                attendance: projectedAttendance,
              },
            }
          : null,
      };

      const { data, error } = await supabase
        .from('gigs')
        .insert(gigInsertPayload)
        .select(`
          *,
          venues!gigs_venue_id_fkey(*)
        `)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create gig');

      const insertedGig: GigRecord = data as GigRecord;
      const environmentFromDb = insertedGig.environment_modifiers ?? null;
      const mergedEnvironment = environmentFromDb ?? (environmentSummary
        ? {
            ...environmentSummary,
            projections: {
              attendance: projectedAttendance,
            },
          }
        : null);

      const venueDetails = insertedGig.venues;
      const newGig: Gig = {
        id: insertedGig.id,
        venue_id: insertedGig.venue_id,
        band_id: insertedGig.band_id ?? undefined,
        scheduled_date: insertedGig.scheduled_date,
        payment: insertedGig.payment ?? payment,
        status: insertedGig.status ?? 'scheduled',
        attendance: insertedGig.attendance ?? projectedAttendance,
        fan_gain: insertedGig.fan_gain ?? 0,
        venue: {
          id: venueDetails?.id ?? venue.id,
          name: venueDetails?.name ?? venue.name,
          location: venueDetails?.location ?? venue.location,
          capacity: venueDetails?.capacity ?? venue.capacity,
          venue_type: venueDetails?.venue_type ?? venue.venue_type,
          base_payment: venueDetails?.base_payment ?? venue.base_payment,
          prestige_level: venueDetails?.prestige_level ?? venue.prestige_level,
          requirements: (venueDetails?.requirements as VenueRequirements | null) ?? venue.requirements,
        },
        environment_modifiers: mergedEnvironment,
      };

      const eventEndTime = new Date(futureDate);
      eventEndTime.setHours(eventEndTime.getHours() + 2);

      const environmentNotes = mergedEnvironment?.applied?.length
        ? mergedEnvironment.applied
            .map((effect) => {
              const parts: string[] = [];
              if (effect.source === 'weather') {
                parts.push(effect.name);
              } else {
                parts.push(effect.name);
              }

              const modifiers: string[] = [];
              if (effect.attendanceMultiplier && effect.attendanceMultiplier !== 1) {
                modifiers.push(`attendance ${Math.round((effect.attendanceMultiplier - 1) * 100)}%`);
              }
              if (effect.costMultiplier && effect.costMultiplier !== 1) {
                modifiers.push(`cost ${Math.round((effect.costMultiplier - 1) * 100)}%`);
              }
              if (effect.moraleModifier && effect.moraleModifier !== 1) {
                modifiers.push(`morale ${Math.round((effect.moraleModifier - 1) * 100)}%`);
              }

              if (modifiers.length) {
                parts.push(`(${modifiers.join(', ')})`);
              }

              return parts.join(' ');
            })
            .join(' | ')
        : null;

      const scheduleDescriptionBase = `Live performance at ${venue.name}`;
      const scheduleDescription = environmentNotes
        ? `${scheduleDescriptionBase} • Env: ${environmentNotes}`
        : scheduleDescriptionBase;

      const { error: scheduleError } = await supabase
        .from('schedule_events')
        .insert({
          user_id: user.id,
          event_type: 'gig',
          title: `Gig at ${venue.name}`,
          description: scheduleDescription,
          start_time: futureDate.toISOString(),
          end_time: eventEndTime.toISOString(),
          location: venue.location,
          status: 'scheduled',
          gig_id: data.id
        });

      if (scheduleError) {
        console.error('Error adding gig to schedule:', scheduleError);
        toast({
          variant: "destructive",
          title: "Schedule update failed",
          description: "Gig booked but the schedule couldn't be updated automatically."
        });
      }

      setPlayerGigs(prev => [...prev, newGig]);
      
      await addActivity('gig', `Booked gig at ${venue.name}`, 0);

      const toastParts = [
        `You're performing at ${venue.name} on ${futureDate.toLocaleDateString()}.`,
        `Projected attendance: ${projectedAttendance.toLocaleString()}.`,
      ];

      if (environmentNotes) {
        toastParts.push(`Environment: ${environmentNotes}.`);
      }

      toast({
        title: "Gig booked!",
        description: toastParts.join(' '),
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to book the gig";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error booking gig:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Booking failed",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setBooking(false);
    }
  };

  const performGig = async (gig: Gig) => {
    if (!user || !profile) return;

    try {
      const successChance = calculateSuccessChance(gig.venue);
      const isSuccess = Math.random() * 100 < successChance;

      const environmentModifiers = gig.environment_modifiers;
      const attendanceMultiplier = environmentModifiers?.attendanceMultiplier ?? 1;
      const moraleMultiplier = environmentModifiers?.moraleModifier ?? 1;

      let attendance, fanGain, actualPayment;

      if (isSuccess) {
        attendance = Math.round(gig.venue.capacity * (0.6 + Math.random() * 0.4)); // 60-100% capacity
        fanGain = Math.round(attendance * 0.1 * (gig.venue.prestige_level / 5));
        actualPayment = gig.payment;
      } else {
        attendance = Math.round(gig.venue.capacity * (0.2 + Math.random() * 0.3)); // 20-50% capacity
        fanGain = Math.round(attendance * 0.05);
        actualPayment = Math.round(gig.payment * 0.5); // Half payment for poor performance
      }

      attendance = Math.max(1, Math.round(attendance * attendanceMultiplier));
      fanGain = Math.max(0, Math.round(fanGain * moraleMultiplier));

      // Update gig status
      const updatedEnvironment = environmentModifiers
        ? {
            ...environmentModifiers,
            projections: {
              ...environmentModifiers.projections,
              attendance,
            },
          }
        : null;

      const gigUpdatePayload: GigUpdatePayload = {
        status: 'completed',
        attendance,
        fan_gain: fanGain,
        payment: actualPayment,
        environment_modifiers: updatedEnvironment,
      };

      const { error } = await supabase
        .from('gigs')
        .update(gigUpdatePayload)
        .eq('id', gig.id);

      if (error) throw error;

      // Update player stats
      const newCash = (profile.cash || 0) + actualPayment;
      const newFame = (profile.fame || 0) + fanGain;
      const expGain = Math.round(attendance / 10);
      
      await updateProfile({ 
        cash: newCash,
        fame: newFame,
        experience: (profile.experience || 0) + expGain
      });

      // Update local state
      setPlayerGigs(prev => prev.map(g =>
        g.id === gig.id
          ? {
              ...g,
              status: 'completed',
              attendance,
              fan_gain: fanGain,
              payment: actualPayment,
              environment_modifiers: updatedEnvironment ?? g.environment_modifiers,
            }
          : g
      ));

      await addActivity(
        'gig',
        `Performed at ${gig.venue.name} (${attendance} attendance)`,
        actualPayment
      );

      let wearNotice = '';

      try {
        const wearSummary = await applyEquipmentWear(user.id, 'gig');
        if (wearSummary?.updates.length) {
          wearNotice = ` Gear wear detected on ${wearSummary.updates.length} item${wearSummary.updates.length > 1 ? 's' : ''}. Check the inventory manager for repairs.`;
        }
      } catch (wearError) {
        console.error('Failed to apply equipment wear after gig', wearError);
      }

      toast({
        title: isSuccess ? "Great performance!" : "Performance complete",
        description: `Earned $${actualPayment}, +${fanGain} fans, +${expGain} XP.${wearNotice}`,
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to complete the gig";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error performing gig:', errorMessage, error);
      toast({
        variant: "destructive",
        title: "Performance failed",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    }
  };

  const getDifficultyBadge = (prestige: number) => {
    if (prestige <= 2) return <Badge variant="outline" className="bg-green-500/10 text-green-500">Easy</Badge>;
    if (prestige <= 3) return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">Medium</Badge>;
    if (prestige <= 4) return <Badge variant="outline" className="bg-orange-500/10 text-orange-500">Hard</Badge>;
    return <Badge variant="outline" className="bg-red-500/10 text-red-500">Expert</Badge>;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-primary text-primary-foreground';
      case 'completed': return 'bg-success text-success-foreground';
      case 'cancelled': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const formatEnvironmentDelta = (value?: number, label?: string) => {
    if (!value || value === 1 || !label) {
      return null;
    }

    const percent = Math.round((value - 1) * 100);
    if (percent === 0) {
      return null;
    }

    const sign = percent > 0 ? '+' : '';
    return `${label} ${sign}${percent}%`;
  };

  const summarizeEnvironmentEffect = (effect: AppliedEnvironmentEffect) => {
    const changes = [
      formatEnvironmentDelta(effect.attendanceMultiplier, 'Attendance'),
      formatEnvironmentDelta(effect.costMultiplier, 'Costs'),
      formatEnvironmentDelta(effect.moraleModifier, 'Morale'),
    ].filter(Boolean);

    return changes.join(' • ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading venues...</p>
        </div>
      </div>
    );
  }

  const upcomingGigs = playerGigs.filter(gig => gig.status === 'scheduled');
  const pastGigs = playerGigs.filter(gig => gig.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Gig Booking
            </h1>
            <p className="text-muted-foreground">Book performances and build your fanbase</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-primary/20 rounded-lg px-4 py-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">{upcomingGigs.length} Upcoming</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="venues" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="venues">Available Venues</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming Gigs</TabsTrigger>
            <TabsTrigger value="history">Performance History</TabsTrigger>
          </TabsList>

          <TabsContent value="venues">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {venues.map((venue) => {
                const payment = calculateGigPayment(venue);
                const successChance = calculateSuccessChance(venue);
                const canBook = meetsRequirements(venue);

                return (
                  <Card key={venue.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{venue.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {venue.location}
                          </CardDescription>
                        </div>
                        {getDifficultyBadge(venue.prestige_level)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Capacity</div>
                          <div className="font-semibold">{venue.capacity.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Type</div>
                          <div className="font-semibold capitalize">{venue.venue_type}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Payment:</span>
                          <span className="font-bold text-success">${payment.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Success Rate:</span>
                          <span className="font-bold">{successChance.toFixed(0)}%</span>
                        </div>
                      </div>

                      <Progress value={successChance} className="h-2" />

                      {venue.requirements && Object.keys(venue.requirements).length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Requirements:</div>
                          {Object.entries(venue.requirements).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              {key === 'min_popularity' && `${value} Fame minimum`}
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        onClick={() => bookGig(venue)}
                        disabled={!canBook || booking}
                        className="w-full"
                        variant={canBook ? "default" : "secondary"}
                      >
                        {!canBook ? "Requirements Not Met" : booking ? "Booking..." : "Book Gig"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="upcoming">
            <div className="space-y-4">
              {upcomingGigs.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Upcoming Gigs</h3>
                    <p className="text-muted-foreground">Book some venues to start performing!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {upcomingGigs.map((gig) => (
                    <Card key={gig.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{gig.venue.name}</CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {gig.venue.location}
                            </CardDescription>
                          </div>
                          <Badge className={getStatusColor(gig.status)} variant="outline">
                            {gig.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Date</div>
                            <div className="font-semibold">
                              {new Date(gig.scheduled_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Payment</div>
                            <div className="font-semibold text-success">${gig.payment.toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Success Rate:</span>
                            <span className="font-bold">{calculateSuccessChance(gig.venue).toFixed(0)}%</span>
                          </div>
                          <Progress value={calculateSuccessChance(gig.venue)} className="h-2" />
                        </div>

                        {gig.environment_modifiers?.projections?.attendance && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Projected Attendance</span>
                            <span className="font-semibold">
                              {gig.environment_modifiers.projections.attendance.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {gig.environment_modifiers?.applied?.length ? (
                          <div className="space-y-1 border-t border-border/40 pt-3 text-xs">
                            <div className="text-sm font-semibold text-foreground">Environment Effects</div>
                            <div className="space-y-1">
                              {gig.environment_modifiers.applied.map((effect) => {
                                const summary = summarizeEnvironmentEffect(effect);
                                const detail = summary || effect.description;
                                return (
                                  <div key={`${gig.id}-${effect.id}`} className="flex items-start justify-between gap-2">
                                    <span className="font-medium text-foreground">{effect.name}</span>
                                    {detail && (
                                      <span className="text-muted-foreground text-right">
                                        {detail}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <Button
                          onClick={() => performGig(gig)}
                          className="w-full bg-gradient-primary"
                        >
                          <Music className="h-4 w-4 mr-2" />
                          Perform Now
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              {pastGigs.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Performance History</h3>
                    <p className="text-muted-foreground">Complete some gigs to see your performance history!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pastGigs.map((gig) => (
                    <Card key={gig.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{gig.venue.name}</CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {gig.venue.location}
                            </CardDescription>
                          </div>
                          <Badge className={getStatusColor(gig.status)} variant="outline">
                            {gig.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Date</div>
                            <div className="font-semibold">
                              {new Date(gig.scheduled_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Earned</div>
                            <div className="font-semibold text-success">${gig.payment.toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Attendance</div>
                            <div className="font-semibold">{gig.attendance.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">New Fans</div>
                            <div className="font-semibold text-accent">+{gig.fan_gain}</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Venue Fill Rate</div>
                          <Progress 
                            value={(gig.attendance / gig.venue.capacity) * 100} 
                            className="h-2" 
                          />
                          <div className="text-xs text-right">
                            {Math.round((gig.attendance / gig.venue.capacity) * 100)}% capacity
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GigBooking;