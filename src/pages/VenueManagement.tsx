import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import {
  MapPin,
  Users,
  Star,
  Calendar,
  DollarSign, 
  TrendingUp, 
  Music, 
  Clock,
  Heart,
  Award
} from "lucide-react";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];

interface VenueRelationshipRow {
  id: string;
  user_id: string;
  venue_id: string;
  relationship_score: number | null;
  last_interaction?: string | null;
  updated_at?: string | null;
}

interface VenueRelationshipState {
  score: number;
  lastInteraction?: string | null;
}

interface VenueBookingRow {
  id: string;
  venue_id: string;
  user_id: string;
  event_date: string | null;
  status: string | null;
  ticket_price: number | null;
  expected_attendance: number | null;
  tickets_sold: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  notes?: string | null;
}

interface VenueMeta {
  perks: string[];
  baseRevenue: number;
  defaultTicketPrice: number;
  requirementsText?: string;
  minimumReputation?: number;
  alwaysUnlocked?: boolean;
}

interface NextBookingInfo {
  date: string;
  time: string;
  status: string;
}

interface VenueCardData {
  id: string;
  name: string;
  capacity: number;
  location: string;
  relationship: number;
  relationshipLevel: string;
  bookedShows: number;
  upcomingShows: number;
  revenue: number;
  unlocked: boolean;
  requirements: string;
  perks: string[];
  prestigeLevel: number;
  defaultTicketPrice: number;
  nextBooking: NextBookingInfo | null;
}

interface BookingDisplay {
  id: string;
  venue: string;
  date: string;
  time: string;
  capacity: number;
  ticketPrice: number;
  soldTickets: number;
  status: string;
  revenue: number;
}

const fallbackVenueMeta: VenueMeta = {
  perks: [],
  baseRevenue: 0,
  defaultTicketPrice: 25,
  requirementsText: "None",
};

const venueMetaMap: Record<string, VenueMeta> = {
  "Local Coffee Shop": {
    perks: ["Cozy atmosphere", "Loyal locals", "Low pressure gigs"],
    baseRevenue: 400,
    defaultTicketPrice: 12,
    alwaysUnlocked: true,
    requirementsText: "None",
  },
  "Community Center": {
    perks: ["Family friendly", "Community support", "Flexible scheduling"],
    baseRevenue: 850,
    defaultTicketPrice: 18,
    alwaysUnlocked: true,
  },
  "The Underground": {
    perks: ["Intimate setting", "Great acoustics", "Loyal fanbase"],
    baseRevenue: 1200,
    defaultTicketPrice: 25,
    minimumReputation: 60,
  },
  "City Music Hall": {
    perks: ["Professional sound", "VIP area", "Merchandise booth"],
    baseRevenue: 4800,
    defaultTicketPrice: 45,
    minimumReputation: 70,
  },
  "The Arena": {
    perks: ["Massive exposure", "Premium sound system", "Media coverage"],
    baseRevenue: 12500,
    defaultTicketPrice: 65,
    minimumReputation: 80,
  },
  "Festival Grounds": {
    perks: ["Festival circuit access", "International exposure", "Record deal opportunities"],
    baseRevenue: 18000,
    defaultTicketPrice: 75,
    minimumReputation: 90,
  },
  Stadium: {
    perks: ["Worldwide audience", "Major sponsors", "Prime media coverage"],
    baseRevenue: 55000,
    defaultTicketPrice: 90,
    minimumReputation: 95,
  },
};

const formatKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatRequirements = (requirements: unknown, fallbackText?: string) => {
  if (fallbackText) {
    return fallbackText;
  }

  if (!requirements) {
    return "None";
  }

  if (typeof requirements === "string") {
    return requirements.length > 0 ? requirements : "None";
  }

  if (typeof requirements === "object") {
    const entries = Object.entries(requirements as Record<string, unknown>);
    if (entries.length === 0) {
      return "None";
    }
    return entries
      .map(([key, value]) => `${formatKey(key)}: ${value}`)
      .join(", ");
  }

  return "None";
};

const safeNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseEventDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatStatusLabel = (status: string | null | undefined) => {
  if (!status) return "Scheduled";
  return status
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDateDisplay = (date: Date | null) => {
  if (!date) return "To Be Announced";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTimeDisplay = (date: Date | null) => {
  if (!date) return "TBA";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toSortableTime = (date: Date | null) => {
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
};

const getVenueMeta = (name: string | null | undefined) => {
  return venueMetaMap[name ?? ""] ?? fallbackVenueMeta;
};

const getRelationshipLevel = (relationship: number) => {
  if (relationship >= 90) return "Legendary";
  if (relationship >= 75) return "Trusted Partner";
  if (relationship >= 50) return "Collaborator";
  if (relationship >= 25) return "Acquaintance";
  return "New Contact";
};

const isVenueUnlocked = (
  venue: VenueRow,
  relationship: number,
  reputation: number,
  meta: VenueMeta,
) => {
  if (meta.alwaysUnlocked) return true;
  if (relationship >= 70) return true;
  if (meta.minimumReputation !== undefined && reputation >= meta.minimumReputation) return true;
  if (!venue.prestige_level) return true;
  const requiredReputation = venue.prestige_level * 25;
  return reputation >= requiredReputation;
};

const VenueManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [playerReputation] = useState(75);
  const [activeTab, setActiveTab] = useState("venues");
  const [venueRows, setVenueRows] = useState<VenueRow[]>([]);
  const [relationships, setRelationships] = useState<Record<string, VenueRelationshipState>>({});
  const [bookingRows, setBookingRows] = useState<VenueBookingRow[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const loadVenues = useCallback(async () => {
    setLoadingVenues(true);

    try {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("prestige_level", { ascending: true });

      if (error) throw error;

      setVenueRows(((data ?? []) as VenueRow[]));
    } catch (error) {
      console.error("Error loading venues:", error);
      toast({
        variant: "destructive",
        title: "Unable to load venues",
        description: "There was a problem fetching available venues.",
      });
    } finally {
      setLoadingVenues(false);
    }
  }, [toast]);

  const loadRelationships = useCallback(async () => {
    if (!user) return;

    setLoadingRelationships(true);

    try {
      const { data, error } = await supabase
        .from("venue_relationships")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;

      const relationshipMap = ((data ?? []) as VenueRelationshipRow[]).reduce(
        (acc, row) => {
          const score = Math.min(100, Math.max(0, safeNumber(row.relationship_score)));
          acc[row.venue_id] = {
            score,
            lastInteraction: row.last_interaction ?? row.updated_at ?? null,
          };
          return acc;
        },
        {} as Record<string, VenueRelationshipState>
      );

      setRelationships(relationshipMap);
    } catch (error) {
      console.error("Error loading venue relationships:", error);
      toast({
        variant: "destructive",
        title: "Unable to load relationships",
        description: "We couldn't fetch your venue relationship data.",
      });
    } finally {
      setLoadingRelationships(false);
    }
  }, [user, toast]);

  const loadBookings = useCallback(async () => {
    if (!user) return;

    setLoadingBookings(true);

    try {
      const { data, error } = await supabase
        .from("venue_bookings")
        .select("*")
        .eq("user_id", user.id)
        .order("event_date", { ascending: true });

      if (error) throw error;

      setBookingRows(((data ?? []) as VenueBookingRow[]));
    } catch (error) {
      console.error("Error loading venue bookings:", error);
      toast({
        variant: "destructive",
        title: "Unable to load bookings",
        description: "We couldn't fetch your upcoming bookings.",
      });
    } finally {
      setLoadingBookings(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void loadVenues();
  }, [loadVenues]);

  useEffect(() => {
    if (!user) {
      setRelationships({});
      setBookingRows([]);
      return;
    }
    void loadRelationships();
    void loadBookings();
  }, [user, loadRelationships, loadBookings]);

  const venuesWithDetails = useMemo<VenueCardData[]>(() => {
    if (venueRows.length === 0) return [];

    const now = new Date();

    return venueRows.map((venue) => {
      const meta = getVenueMeta(venue.name);
      const relationshipState = relationships[venue.id] ?? { score: 0 };
      const relationshipScore = Math.min(100, Math.max(0, relationshipState.score));
      const venueBookings = bookingRows.filter((booking) => booking.venue_id === venue.id);
      const upcomingBookingsForVenue = venueBookings
        .map((booking) => ({
          ...booking,
          parsedDate: parseEventDate(booking.event_date),
        }))
        .filter((booking) => {
          if (!booking.parsedDate) return true;
          return booking.parsedDate >= now;
        })
        .sort((a, b) => toSortableTime(a.parsedDate ?? null) - toSortableTime(b.parsedDate ?? null));

      const nextBookingRow = upcomingBookingsForVenue[0];
      const nextBooking: NextBookingInfo | null = nextBookingRow
        ? {
            date: formatDateDisplay(nextBookingRow.parsedDate ?? null),
            time: formatTimeDisplay(nextBookingRow.parsedDate ?? null),
            status: formatStatusLabel(nextBookingRow.status),
          }
        : null;

      const totalRevenue = venueBookings.reduce((sum, booking) => {
        const ticketsSold = safeNumber(booking.tickets_sold);
        const ticketPrice = safeNumber(booking.ticket_price ?? meta.defaultTicketPrice);
        return sum + ticketsSold * ticketPrice;
      }, 0);

      return {
        id: venue.id,
        name: venue.name ?? "Unknown Venue",
        capacity: safeNumber(venue.capacity),
        location: venue.location ?? "Unknown",
        relationship: relationshipScore,
        relationshipLevel: getRelationshipLevel(relationshipScore),
        bookedShows: venueBookings.length,
        upcomingShows: upcomingBookingsForVenue.length,
        revenue: totalRevenue,
        unlocked: isVenueUnlocked(venue, relationshipScore, playerReputation, meta),
        requirements: formatRequirements(venue.requirements, meta.requirementsText),
        perks: meta.perks,
        prestigeLevel: venue.prestige_level ?? 1,
        defaultTicketPrice: meta.defaultTicketPrice,
        nextBooking,
      };
    });
  }, [venueRows, relationships, bookingRows, playerReputation]);

  const upcomingBookings = useMemo<BookingDisplay[]>(() => {
    if (bookingRows.length === 0) return [];

    const venuesById = new Map(venueRows.map((venue) => [venue.id, venue]));
    const now = new Date();

    return bookingRows
      .map((booking) => {
        const eventDate = parseEventDate(booking.event_date);
        const venue = venuesById.get(booking.venue_id);
        const meta = getVenueMeta(venue?.name);
        const capacity = safeNumber(
          booking.expected_attendance ?? venue?.capacity ?? 0
        );
        const soldTickets = safeNumber(booking.tickets_sold);
        const ticketPrice = safeNumber(booking.ticket_price ?? meta.defaultTicketPrice);

        return {
          id: booking.id,
          venue: venue?.name ?? "Unknown Venue",
          eventDate,
          capacity,
          soldTickets,
          ticketPrice,
          status: formatStatusLabel(booking.status),
          revenue: soldTickets * ticketPrice,
        };
      })
      .filter((booking) => {
        if (!booking.eventDate) return true;
        return booking.eventDate >= now;
      })
      .sort((a, b) => toSortableTime(a.eventDate ?? null) - toSortableTime(b.eventDate ?? null))
      .map((booking) => ({
        id: booking.id,
        venue: booking.venue,
        date: formatDateDisplay(booking.eventDate ?? null),
        time: formatTimeDisplay(booking.eventDate ?? null),
        capacity: booking.capacity,
        ticketPrice: booking.ticketPrice,
        soldTickets: booking.soldTickets,
        status: booking.status,
        revenue: booking.revenue,
      }));
  }, [bookingRows, venueRows]);

  const analyticsData = useMemo(() => {
    if (upcomingBookings.length === 0) {
      return { totalShows: 0, averageAttendance: 0, totalRevenue: 0 };
    }

    const totalShows = upcomingBookings.length;
    const totalCapacity = upcomingBookings.reduce((sum, booking) => sum + booking.capacity, 0);
    const totalSold = upcomingBookings.reduce((sum, booking) => sum + booking.soldTickets, 0);
    const totalRevenue = upcomingBookings.reduce((sum, booking) => sum + booking.revenue, 0);
    const averageAttendance = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0;

    return { totalShows, averageAttendance, totalRevenue };
  }, [upcomingBookings]);

  const handleImproveRelationship = useCallback(
    async (venueId: string) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "Log in to manage venue relationships.",
        });
        return;
      }

      const currentScore = relationships[venueId]?.score ?? 0;
      const newScore = Math.min(100, currentScore + 10);
      const lastInteraction = new Date().toISOString();

      try {
        const { error } = await supabase
          .from("venue_relationships")
          .upsert(
            {
              user_id: user.id,
              venue_id: venueId,
              relationship_score: newScore,
              last_interaction: lastInteraction,
            },
            { onConflict: "user_id,venue_id" }
          );

        if (error) throw error;

        setRelationships((prev) => ({
          ...prev,
          [venueId]: {
            score: newScore,
            lastInteraction,
          },
        }));

        toast({
          title: "Relationship Improved!",
          description: `Relationship level is now ${getRelationshipLevel(newScore)} (${newScore}%).`,
        });
      } catch (error) {
        console.error("Error improving venue relationship:", error);
        toast({
          variant: "destructive",
          title: "Update failed",
          description: "Could not improve the venue relationship. Please try again.",
        });
      }
    },
    [user, relationships, toast]
  );

  const handleBookVenue = useCallback(
    async (venue: VenueCardData) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "Log in to book a venue.",
        });
        return;
      }

      if (!venue.unlocked) {
        toast({
          title: "Venue Locked",
          description: `Requirements: ${venue.requirements}`,
          variant: "destructive",
        });
        return;
      }

      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14);
      eventDate.setHours(20, 0, 0, 0);

      const expectedAttendance = venue.capacity > 0 ? Math.max(1, Math.round(venue.capacity * 0.75)) : undefined;
      const ticketPrice = venue.defaultTicketPrice;

      try {
        const { error } = await supabase.from("venue_bookings").insert({
          user_id: user.id,
          venue_id: venue.id,
          event_date: eventDate.toISOString(),
          status: "scheduled",
          ticket_price: ticketPrice,
          expected_attendance: expectedAttendance,
          tickets_sold: 0,
        });

        if (error) throw error;

        toast({
          title: "Show Booked!",
          description: `Your show at ${venue.name} is scheduled for ${formatDateDisplay(eventDate)}.`,
        });

        await loadBookings();
        setActiveTab("bookings");
      } catch (error) {
        console.error("Error booking venue:", error);
        toast({
          variant: "destructive",
          title: "Booking failed",
          description: "Unable to schedule the venue. Please try again.",
        });
      }
    },
    [user, toast, loadBookings]
  );

    try {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 7);

      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        venue_id: venue.id,
        status: "upcoming",
        event_date: eventDate.toISOString()
      };

      const { error } = await supabase
        .from("venue_bookings")
        .insert(insertPayload);
      if (error) throw error;

      await loadBookings();

      toast({
        title: "Show booked!",
        description: `Your performance at ${venue.name} has been scheduled.`
      });

  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    switch (normalized) {
      case "confirmed":
      case "completed":
        return "bg-green-500";
      case "selling":
      case "on sale":
        return "bg-blue-500";
      case "upcoming":
      case "scheduled":
        return "bg-purple-500";
      case "pending":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  }, [loadBookings, toast, user]);

  const isLoadingVenues = loadingVenues || loadingRelationships;
  const hasVenues = venuesWithDetails.length > 0;
  const hasUpcomingBookings = upcomingBookings.length > 0;

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            VENUE MANAGEMENT
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Build relationships and unlock bigger stages
          </p>
          <div className="flex justify-center items-center gap-4">
            <div className="flex items-center gap-2 text-cream">
              <Award className="h-6 w-6" />
              <span className="text-lg">Reputation: {playerReputation}/100</span>
            </div>
            <div className="flex items-center gap-2 text-cream/80 text-sm">
              <Calendar className="h-5 w-5" />
              <span>{upcomingBookingsCount} upcoming bookings</span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="venues" className="space-y-6">
            {isLoadingVenues ? (
              <div className="py-10 text-center text-cream/60">Loading venues...</div>
            ) : !hasVenues ? (
              <Card className="bg-card/60 border-accent/40">
                <CardContent className="py-8 text-center text-cream/70">
                  No venues available yet. Improve your reputation to unlock opportunities.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {venuesWithDetails.map((venue) => (
                  <Card
                    key={venue.id}
                    className={`border-2 transition-all ${
                      venue.unlocked
                        ? "bg-card/80 border-accent hover:bg-card/90"
                        : "bg-card/40 border-accent/40"
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className={`${venue.unlocked ? "text-cream" : "text-cream/60"}`}>
                            {venue.name}
                            {!venue.unlocked && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Locked
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {venue.location}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">{venue.relationshipLevel}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-cream/60">
                            <Users className="h-4 w-4" />
                            <span className="text-sm">Capacity</span>
                          </div>
                          <p className="text-xl font-bold text-accent">
                            {Math.round(venue.capacity).toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-cream/60">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-sm">Projected Revenue</span>
                          </div>
                          <p className="text-xl font-bold text-accent">
                            ${Math.round(venue.revenue).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-cream/60">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm">Upcoming Shows</span>
                          </div>
                          <p className="text-xl font-bold text-accent">{venue.upcomingShows}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-cream/60">
                            <Star className="h-4 w-4" />
                            <span className="text-sm">Relationship Level</span>
                          </div>
                          <p className="text-lg font-semibold text-cream">{venue.relationshipLevel}</p>
                        </div>
                      </div>

                      {venue.unlocked ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-cream/60">Relationship Progress</span>
                              <span className={`font-bold ${getRelationshipColor(venue.relationship)}`}>
                                {venue.relationship}%
                              </span>
                            </div>
                            <Progress value={venue.relationship} className="h-2" />
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm text-cream/60">Perks</p>
                            <div className="flex flex-wrap gap-1">
                              {venue.perks.length > 0 ? (
                                venue.perks.map((perk, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {perk}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-cream/50">No perks listed</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {venue.nextBooking ? (
                              <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/60">
                                  <Calendar className="h-3 w-3" />
                                  Next Booking
                                </div>
                                <p className="mt-1 text-sm font-semibold text-cream">
                                  {venue.nextBooking.date} • {venue.nextBooking.time}
                                </p>
                                <p className="text-xs text-cream/60">
                                  Status: {venue.nextBooking.status}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-accent/30 p-3 text-xs text-cream/60">
                                No upcoming bookings scheduled.
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleBookVenue(venue)}
                              className="flex-1 bg-accent hover:bg-accent/80 text-background"
                            >
                              Book Show
                            </Button>
                            <Button
                              onClick={() => handleImproveRelationship(venue.id)}
                              variant="outline"
                              className="border-accent text-accent hover:bg-accent/10"
                            >
                              <Heart className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <p className="text-sm text-cream/60">Requirements</p>
                            <p className="text-sm text-cream/80">{venue.requirements}</p>
                          </div>
                          <Button disabled className="w-full bg-accent/50 text-background/50">
                            Unlock Required
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="bookings" className="space-y-6">
            {loadingBookings ? (
              <div className="py-10 text-center text-cream/60">Loading bookings...</div>
            ) : hasUpcomingBookings ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <Card key={booking.id} className="bg-card/80 border-accent">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-5">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-cream">{booking.venue}</h3>
                          <div className="flex items-center gap-2 text-sm text-cream/60">
                            <Calendar className="h-4 w-4" />
                            {booking.date}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-cream/60">
                            <Clock className="h-4 w-4" />
                            {booking.time}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm text-cream/60">Capacity</p>
                          <p className="text-lg font-bold text-accent">{Math.round(booking.capacity)}</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm text-cream/60">Tickets Sold</p>
                          <div className="space-y-1">
                            <p className="text-lg font-bold text-accent">
                              {Math.round(booking.soldTickets)}/{Math.round(booking.capacity)}
                            </p>
                            <Progress
                              value={
                                booking.capacity > 0
                                  ? Math.min(100, (booking.soldTickets / booking.capacity) * 100)
                                  : 0
                              }
                              className="h-2"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm text-cream/60">Projected Revenue</p>
                          <p className="text-lg font-bold text-accent">
                            ${Math.round(booking.revenue).toLocaleString()}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Badge className={`${getStatusColor(booking.status)} text-white`}>
                            {booking.status}
                          </Badge>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="border-accent text-accent">
                              Edit
                            </Button>
                            <Button size="sm" className="bg-accent hover:bg-accent/80 text-background">
                              Promote
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card/60 border-accent/40">
                <CardContent className="py-8 text-center text-cream/70">
                  You don't have any upcoming bookings yet. Schedule a show to see it here.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Upcoming Shows</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{analyticsData.totalShows}</div>
                  <p className="text-cream/60 text-sm">
                    {analyticsData.totalShows === 1 ? "Upcoming booking" : "Upcoming bookings"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Average Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{analyticsData.averageAttendance}%</div>
                  <p className="text-cream/60 text-sm">Projected seat fill</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Projected Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    ${Math.round(analyticsData.totalRevenue).toLocaleString()}
                  </div>
                  <p className="text-cream/60 text-sm">From upcoming shows</p>

                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Venue Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {venuesWithDetails.filter((venue) => venue.unlocked && venue.bookedShows > 0).length === 0 ? (
                    <p className="text-sm text-cream/60">
                      No performance data yet. Book shows to see venue insights.
                    </p>
                  ) : (
                    venuesWithDetails
                      .filter((venue) => venue.unlocked && venue.bookedShows > 0)
                      .map((venue) => (
                        <div key={venue.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-cream">{venue.name}</span>
                            <span className="text-accent font-bold">
                              {venue.bookedShows} {venue.bookedShows === 1 ? "show" : "shows"}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-cream/60">Revenue: </span>
                              <span className="text-accent">
                                ${Math.round(venue.revenue).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-cream/60">Relationship: </span>

                              <span className={`${getRelationshipColor(venue.relationship)} font-semibold`}>
                                {venue.relationship}% ({venue.relationshipLevel})
                              </span>
                            </div>
                            <div>
                              <span className="text-cream/60">Upcoming: </span>
                              <span className="text-cream">{venue.upcomingShows}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VenueManagement;
