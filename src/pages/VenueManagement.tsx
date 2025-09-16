import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Users, Calendar, DollarSign, Clock, Heart, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];

interface VenueRelationshipRow {
  id: string;
  venue_id: string;
  user_id: string;
  relationship_score?: number | null;
  relationship_level?: string | null;
  [key: string]: unknown;
}

interface VenueBookingRow {
  id: string;
  venue_id: string;
  user_id: string;
  status?: string | null;
  event_date?: string | null;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  scheduled_for?: string | null;
  show_date?: string | null;
  ticket_price?: number | null;
  expected_attendance?: number | null;
  expected_revenue?: number | null;
  tickets_sold?: number | null;
  actual_attendance?: number | null;
  guaranteed_payment?: number | null;
  capacity?: number | null;
  created_at?: string | null;
  notes?: string | null;
  venues?: VenueRow | null;
  [key: string]: unknown;
}

type DisplayVenue = VenueRow & {
  perks: string[];
  reputation: string;
  unlocked: boolean;
  relationshipScore: number;
  relationshipLevel: string;
  bookedShows: number;
  revenue: number;
  nextBooking: VenueBookingRow | null;
  requirementsText: string;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getRelationshipColor = (score: number) => {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
};

const getStatusColor = (status: string) => {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "confirmed":
      return "bg-green-500";
    case "selling":
      return "bg-blue-500";
    case "upcoming":
    case "scheduled":
      return "bg-purple-500";
    case "completed":
      return "bg-emerald-500";
    case "cancelled":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

const getPerksForVenueType = (venueType?: string | null): string[] => {
  switch (venueType) {
    case "club":
      return ["Intimate setting", "Great acoustics", "Local buzz"];
    case "lounge":
      return ["VIP area", "Premium clientele", "Relaxed vibe"];
    case "arena":
      return ["Massive exposure", "Arena production", "Media coverage"];
    case "theater":
      return ["Professional lighting", "Premium seating", "Merchandising space"];
    case "festival":
      return ["Outdoor energy", "Festival circuit", "Sponsorship deals"];
    default:
      return ["Dedicated promotion", "Sound engineer support"];
  }
};

const getReputationLabel = (prestige?: number | null): string => {
  if (!prestige) return "Rising";
  if (prestige >= 5) return "Legendary";
  if (prestige >= 4) return "Major";
  if (prestige >= 3) return "Established";
  if (prestige >= 2) return "Emerging";
  return "Rising";
};

const formatRequirements = (requirements: VenueRow["requirements"]): string => {
  if (!requirements || typeof requirements !== "object") {
    return "None";
  }

  const req = requirements as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof req.min_popularity === "number") {
    parts.push(`Min popularity ${req.min_popularity}`);
  }

  if (typeof req.min_reputation === "number") {
    parts.push(`Min reputation ${req.min_reputation}`);
  }

  if (typeof req.special_access === "string") {
    parts.push(req.special_access);
  }

  return parts.length > 0 ? parts.join(" • ") : "Special requirements";
};

const calculateRelationshipLevelLabel = (score: number, fallback?: string | null): string => {
  if (fallback && fallback.length > 0) {
    return fallback;
  }

  if (score >= 90) return "Headliner Partner";
  if (score >= 70) return "Trusted Partner";
  if (score >= 50) return "Strong Ally";
  if (score >= 30) return "Friendly";
  if (score > 0) return "Acquainted";
  return "Unfamiliar";
};

const formatStatusLabel = (status?: string | null) => {
  if (!status || status.length === 0) {
    return "Upcoming";
  }

  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

const getBookingDate = (booking: VenueBookingRow): Date | null => {
  const candidates = [
    booking.event_date,
    booking.booking_date,
    booking.start_time,
    booking.scheduled_for,
    booking.show_date,
    booking.created_at
  ];

  for (const value of candidates) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

const getBookingDateValue = (booking: VenueBookingRow): number => {
  const date = getBookingDate(booking);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
};

const sortBookings = (records: VenueBookingRow[]): VenueBookingRow[] =>
  [...records].sort((a, b) => getBookingDateValue(a) - getBookingDateValue(b));

const calculateTicketsSold = (booking: VenueBookingRow): number => {
  if (typeof booking.tickets_sold === "number") return booking.tickets_sold;
  if (typeof booking.actual_attendance === "number") return booking.actual_attendance;
  if (typeof booking.expected_attendance === "number") return booking.expected_attendance;
  return 0;
};

const calculateTicketCapacity = (booking: VenueBookingRow): number => {
  if (typeof booking.capacity === "number") return booking.capacity;
  if (typeof booking.expected_attendance === "number") return booking.expected_attendance;
  if (booking.venues?.capacity) return booking.venues.capacity;
  return 0;
};

const calculateExpectedRevenue = (booking: VenueBookingRow): number => {
  if (typeof booking.expected_revenue === "number") return booking.expected_revenue;
  if (typeof booking.guaranteed_payment === "number") return booking.guaranteed_payment;

  const ticketPrice = typeof booking.ticket_price === "number" ? booking.ticket_price : 0;
  const attendance = calculateTicketsSold(booking);

  if (ticketPrice && attendance) {
    return ticketPrice * attendance;
  }

  return 0;
};

const formatBookingDate = (booking: VenueBookingRow) => {
  const date = getBookingDate(booking);

  if (!date) {
    return {
      date: "TBD",
      time: "--"
    };
  }

  return {
    date: format(date, "MMM d, yyyy"),
    time: format(date, "h:mm a")
  };
};

type VenueRelationshipRow = Tables<"venue_relationships">;

type VenueBaseConfig = {
  id: number;
  name: string;
  capacity: number;
  location: string;
  relationship: number;
  bookedShows: number;
  revenue: number;
  reputation: string;
  unlocked: boolean;
  requirements: string;
  perks: string[];
};

type VenueCardData = VenueBaseConfig & {
  supabaseId?: string;
  relationshipLevel: string;
};

type VenueBookingDisplay = {
  id: string;
  venueName: string;
  eventDate: string;
  eventTime: string;
  capacity: number;
  soldTickets: number;
  ticketPrice: number;
  revenue: number;
  status: string;
  progress: number;
};

const BASE_VENUES: VenueBaseConfig[] = [
  {
    id: 1,
    name: "The Underground",
    capacity: 150,
    location: "Downtown",
    relationship: 85,
    bookedShows: 3,
    revenue: 12000,
    reputation: "Rising",
    unlocked: true,
    requirements: "None",
    perks: ["Intimate setting", "Great acoustics", "Loyal fanbase"]
  },
  {
    id: 2,
    name: "City Music Hall",
    capacity: 500,
    location: "Midtown",
    relationship: 60,
    bookedShows: 1,
    revenue: 25000,
    reputation: "Established",
    unlocked: true,
    requirements: "200+ fan following",
    perks: ["Professional sound", "VIP area", "Merchandise booth"]
  },
  {
    id: 3,
    name: "Arena Stadium",
    capacity: 15000,
    location: "Sports District",
    relationship: 0,
    bookedShows: 0,
    revenue: 0,
    reputation: "Elite",
    unlocked: false,
    requirements: "50,000+ fans, Major label deal",
    perks: ["Massive exposure", "Premium sound system", "Media coverage"]
  },
  {
    id: 4,
    name: "Festival Grounds",
    capacity: 25000,
    location: "City Outskirts",
    relationship: 20,
    bookedShows: 0,
    revenue: 0,
    reputation: "Legendary",
    unlocked: false,
    requirements: "100,000+ fans, Chart success",
    perks: ["Festival circuit access", "International exposure", "Record deal opportunities"]
  }
];

const deriveRelationshipLevel = (relationship: number) => {
  if (relationship >= 80) return "Headliner";
  if (relationship >= 60) return "Preferred";
  if (relationship >= 40) return "Trusted";
  if (relationship >= 20) return "Acquaintance";
  return "Unknown";
};

const VenueManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [playerReputation] = useState(75);
  const [activeTab, setActiveTab] = useState("venues");
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [relationships, setRelationships] = useState<Record<string, VenueRelationshipRow>>({});
  const [bookings, setBookings] = useState<VenueBookingRow[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingVenueId, setBookingVenueId] = useState<string | null>(null);
  const [updatingRelationshipId, setUpdatingRelationshipId] = useState<string | null>(null);

  const loadVenues = useCallback(async () => {
    setLoadingVenues(true);

    try {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("prestige_level", { ascending: true })
        .order("capacity", { ascending: true });

      if (error) throw error;

      setVenues((data ?? []) as VenueRow[]);
    } catch (error) {
      console.error("Error loading venues:", error);
      toast({
        variant: "destructive",
        title: "Unable to load venues",
        description: "Please try again later."
      });
    } finally {
      setLoadingVenues(false);
    }
  }, [toast]);

  const loadRelationships = useCallback(async () => {
    if (!user) {
      setRelationships({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from("venue_relationships")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;

      const map: Record<string, VenueRelationshipRow> = {};
      (data ?? []).forEach((relationship) => {
        if (relationship && relationship.venue_id) {
          map[String(relationship.venue_id)] = relationship as VenueRelationshipRow;
        }
      });

      setRelationships(map);
    } catch (error) {
      console.error("Error loading venue relationships:", error);
      toast({
        variant: "destructive",
        title: "Unable to load relationships",
        description: "We couldn't fetch your venue relationships."
      });
    }
  }, [toast, user]);

  const loadBookings = useCallback(async () => {
    if (!user) {
      setBookings([]);
      return;
    }

    setLoadingBookings(true);

    try {
      const { data, error } = await supabase
        .from("venue_bookings")
        .select(`*, venues:venues(*)`)
        .eq("user_id", user.id);

      if (error) throw error;

      const sorted = sortBookings((data ?? []) as VenueBookingRow[]);
      setBookings(sorted);
    } catch (error) {
      console.error("Error loading venue bookings:", error);
      toast({
        variant: "destructive",
        title: "Unable to load bookings",
        description: "Please try again later."
      });
    } finally {
      setLoadingBookings(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void loadVenues();
  }, [loadVenues]);

  useEffect(() => {
    void loadRelationships();
    void loadBookings();
  }, [loadRelationships, loadBookings]);

  const checkVenueUnlocked = useCallback((venue: VenueRow) => {
    const requirements = (venue.requirements as Record<string, unknown> | null) ?? null;
    const minPopularity = typeof requirements?.min_popularity === "number" ? requirements.min_popularity : 0;
    return playerReputation >= minPopularity;
  }, [playerReputation]);

  const bookingsByVenue = useMemo(() => {
    const map: Record<string, VenueBookingRow[]> = {};

    bookings.forEach((booking) => {
      if (!booking.venue_id) return;
      const venueId = String(booking.venue_id);

      if (!map[venueId]) {
        map[venueId] = [];
      }

      map[venueId].push(booking);
    });

    Object.keys(map).forEach((key) => {
      map[key] = sortBookings(map[key]);
    });

    return map;
  }, [bookings]);

  const displayVenues: DisplayVenue[] = useMemo(() => {
    return venues.map((venue) => {
      const relationship = relationships[venue.id] ?? null;
      const rawScore = Number(relationship?.relationship_score ?? 0);
      const relationshipScore = clampScore(Number.isNaN(rawScore) ? 0 : rawScore);
      const venueBookings = bookingsByVenue[venue.id] ?? [];
      const totalRevenue = venueBookings.reduce((total, booking) => total + calculateExpectedRevenue(booking), 0);
      const nextBooking = venueBookings.length > 0 ? venueBookings[0] : null;

      return {
        ...venue,
        perks: getPerksForVenueType(venue.venue_type),
        reputation: getReputationLabel(venue.prestige_level),
        unlocked: checkVenueUnlocked(venue),
        relationshipScore,
        relationshipLevel: calculateRelationshipLevelLabel(relationshipScore, relationship?.relationship_level),
        bookedShows: venueBookings.length,
        revenue: totalRevenue,
        nextBooking,
        requirementsText: formatRequirements(venue.requirements)
      } as DisplayVenue;
    });
  }, [bookingsByVenue, checkVenueUnlocked, relationships, venues]);

  const totalRevenue = useMemo(
    () => bookings.reduce((sum, booking) => sum + calculateExpectedRevenue(booking), 0),
    [bookings]
  );

  const attendanceStats = useMemo(() => {
    if (bookings.length === 0) {
      return {
        attendancePercent: 0,
        totalSold: 0,
        totalCapacity: 0
      };
    }

    let totalSold = 0;
    let totalCapacity = 0;

    bookings.forEach((booking) => {
      totalSold += calculateTicketsSold(booking);
      totalCapacity += calculateTicketCapacity(booking);
    });

    const attendancePercent = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0;

    return {
      attendancePercent,
      totalSold,
      totalCapacity
    };
  }, [bookings]);

  const upcomingBookingsCount = useMemo(() =>
    bookings.filter((booking) => {
      const date = getBookingDate(booking);
      return date ? date.getTime() >= Date.now() : true;
    }).length, [bookings]);

  const unlockedVenuesWithBookings = useMemo(
    () => displayVenues.filter((venue) => venue.unlocked && venue.bookedShows > 0),
    [displayVenues]
  );
  const handleImproveRelationship = useCallback(async (venueId: string) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "You need to be signed in to manage venue relationships."
      });
      return;
    }

    setUpdatingRelationshipId(venueId);

    try {
      const existing = relationships[venueId];
      const currentScore = clampScore(Number(existing?.relationship_score ?? 0));
      const newScore = clampScore(currentScore + 10);

      if (existing) {
        const { error } = await supabase
          .from("venue_relationships")
          .update({ relationship_score: newScore })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("venue_relationships")
          .insert({
            user_id: user.id,
            venue_id: venueId,
            relationship_score: newScore
          });

        if (error) throw error;
      }

      setRelationships((prev) => ({
        ...prev,
        [venueId]: {
          ...(existing ?? {
            id: venueId,
            user_id: user.id,
            venue_id: venueId
          }),
          relationship_score: newScore
        }
      }));

      await loadRelationships();

      toast({
        title: "Relationship improved!",
        description: "Your standing with this venue has increased."
      });
    } catch (error) {
      console.error("Error updating relationship:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "We couldn't update the venue relationship."
      });
    } finally {
      setUpdatingRelationshipId(null);
    }
  }, [loadRelationships, relationships, toast, user]);

  const handleBookVenue = useCallback(async (venue: DisplayVenue) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "You need to be signed in to book venues."
      });
      return;
    }

    if (!venue.unlocked) {
      toast({
        variant: "destructive",
        title: "Venue locked",
        description: venue.requirementsText
      });
      return;
    }

    setBookingVenueId(venue.id);

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

      setActiveTab("bookings");
    } catch (error) {
      console.error("Error booking venue:", error);
      toast({
        variant: "destructive",
        title: "Booking failed",
        description: "We couldn't schedule this booking."
      });
    } finally {
      setBookingVenueId(null);
    }
  }, [loadBookings, toast, user]);

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
            {loadingVenues ? (
              <Card className="bg-card/60 border-accent/40">
                <CardContent className="py-10 text-center text-cream/60">
                  Loading venues...
                </CardContent>
              </Card>
            ) : displayVenues.length === 0 ? (
              <Card className="bg-card/60 border-accent/40">
                <CardContent className="py-10 text-center text-cream/60">
                  No venues available right now. Please check back later.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayVenues.map((venue) => {
                  const nextBookingInfo = venue.nextBooking ? formatBookingDate(venue.nextBooking) : null;
                  const bookingStatus = formatStatusLabel(venue.nextBooking?.status);
                  return (
                    <Card
                      key={venue.id}
                      className={`border-2 transition-all ${
                        venue.unlocked
                          ? "bg-card/80 border-accent hover:bg-card/90"
                          : "bg-card/40 border-accent/40"
                      }`}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
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
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="secondary">{venue.reputation}</Badge>
                            <Badge variant="outline" className="border-accent/40 text-xs text-accent">
                              {venue.relationshipLevel}
                            </Badge>
                          </div>
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
                              {(venue.capacity ?? 0).toLocaleString()}
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
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-cream/60">
                              <Calendar className="h-4 w-4" />
                              <span className="text-sm">Bookings</span>
                            </div>
                            <p className="text-xl font-bold text-accent">
                              {venue.bookedShows}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-cream/60">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm">Next Show</span>
                            </div>
                            <p className="text-lg font-semibold text-cream">
                              {nextBookingInfo ? nextBookingInfo.date : "Not scheduled"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-cream/60 text-sm">Relationship</span>
                            <span className={`font-bold ${getRelationshipColor(venue.relationshipScore)}`}>
                              {venue.relationshipScore}%
                            </span>
                          </div>
                          <Progress value={venue.relationshipScore} className="h-2" />
                        </div>

                        {venue.nextBooking && nextBookingInfo && (
                          <div className="rounded-md border border-accent/30 bg-card/60 p-3 space-y-1">
                            <div className="flex justify-between items-center text-xs text-cream/60">
                              <span>Upcoming booking</span>
                              <Badge className={`${getStatusColor(bookingStatus)} text-white`}>
                                {bookingStatus}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-cream text-sm">
                              <Calendar className="h-4 w-4" />
                              <span>{nextBookingInfo.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-cream/60 text-xs">
                              <Clock className="h-4 w-4" />
                              <span>{nextBookingInfo.time}</span>
                            </div>
                          </div>
                        )}

                        {venue.perks.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-cream/60 text-sm">Perks</p>
                            <div className="flex flex-wrap gap-1">
                              {venue.perks.map((perk, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {perk}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-cream/60 text-sm">Requirements</p>
                          <p className="text-sm text-cream/80">{venue.requirementsText}</p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => void handleBookVenue(venue)}
                            className="flex-1 bg-accent hover:bg-accent/80 text-background"
                            disabled={bookingVenueId === venue.id || !venue.unlocked}
                          >
                            {bookingVenueId === venue.id ? "Booking..." : "Book Show"}
                          </Button>
                          <Button
                            onClick={() => void handleImproveRelationship(venue.id)}
                            variant="outline"
                            className="border-accent text-accent hover:bg-accent/10"
                            disabled={updatingRelationshipId === venue.id}
                          >
                            {updatingRelationshipId === venue.id ? "..." : <Heart className="h-4 w-4" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="bookings" className="space-y-6">
            {loadingBookings ? (
              <Card className="bg-card/60 border-accent/40">
                <CardContent className="py-10 text-center text-cream/60">
                  Loading bookings...
                </CardContent>
              </Card>
            ) : bookings.length === 0 ? (
              <Card className="bg-card/60 border-accent/40">
                <CardContent className="py-10 text-center space-y-2">
                  <p className="text-cream font-semibold">No bookings yet</p>
                  <p className="text-sm text-cream/60">
                    Book a venue to see your upcoming schedule.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => {
                  const bookingVenue = booking.venues;
                  const { date, time } = formatBookingDate(booking);
                  const capacity = calculateTicketCapacity(booking);
                  const soldTickets = Math.min(calculateTicketsSold(booking), capacity);
                  const revenue = calculateExpectedRevenue(booking);
                  const progressValue = capacity > 0 ? (soldTickets / capacity) * 100 : 0;
                  const statusLabel = formatStatusLabel(booking.status);
                  return (
                    <Card key={booking.id} className="bg-card/80 border-accent">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-cream">{bookingVenue?.name ?? "Venue"}</h3>
                            <div className="flex items-center gap-2 text-cream/60 text-sm">
                              <Calendar className="h-4 w-4" />
                              {date}
                            </div>
                            <div className="flex items-center gap-2 text-cream/60 text-sm">
                              <Clock className="h-4 w-4" />
                              {time}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Capacity</p>
                            <p className="text-lg font-bold text-accent">
                              {capacity.toLocaleString()}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Tickets Sold</p>
                            <div className="space-y-1">
                              <p className="text-lg font-bold text-accent">
                                {soldTickets.toLocaleString()}/{capacity.toLocaleString()}
                              </p>
                              <Progress value={progressValue} className="h-2" />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Projected Revenue</p>
                            <p className="text-lg font-bold text-accent">
                              ${Math.round(revenue).toLocaleString()}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Badge className={`${getStatusColor(statusLabel)} text-white`}>
                              {statusLabel}
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
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Upcoming Shows</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{bookings.length}</div>
                  <p className="text-cream/60 text-sm">Scheduled across all venues</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Average Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {attendanceStats.attendancePercent}%
                  </div>
                  <p className="text-cream/60 text-sm">
                    {attendanceStats.totalCapacity > 0
                      ? `${attendanceStats.totalSold.toLocaleString()} of ${attendanceStats.totalCapacity.toLocaleString()} tickets projected`
                      : "Awaiting bookings"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Projected Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    ${Math.round(totalRevenue).toLocaleString()}
                  </div>
                  <p className="text-cream/60 text-sm">From confirmed and upcoming shows</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Venue Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {unlockedVenuesWithBookings.length === 0 ? (
                    <p className="text-sm text-cream/60">
                      Book a show to see performance metrics for each venue.
                    </p>
                  ) : (
                    unlockedVenuesWithBookings.map((venue) => {
                      const nextBooking = venue.nextBooking ? formatBookingDate(venue.nextBooking) : null;
                      return (
                        <div key={venue.id} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-cream">{venue.name}</span>
                            <span className="text-accent font-bold">{venue.bookedShows} shows</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-cream/60">Revenue: </span>
                              <span className="text-accent">
                                ${Math.round(venue.revenue).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-cream/60">Relationship: </span>
                              <span className={getRelationshipColor(venue.relationshipScore)}>
                                {venue.relationshipScore}%
                              </span>
                            </div>
                            <div>
                              <span className="text-cream/60">Next date: </span>
                              <span className="text-cream">
                                {nextBooking ? nextBooking.date : "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
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
