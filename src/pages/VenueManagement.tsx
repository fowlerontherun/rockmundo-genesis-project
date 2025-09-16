import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
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
  const [venues, setVenues] = useState<VenueCardData[]>(() =>
    BASE_VENUES.map((venue) => ({
      ...venue,
      relationshipLevel: deriveRelationshipLevel(venue.relationship),
    }))
  );
  const [bookings, setBookings] = useState<VenueBookingDisplay[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [relationshipUpdateTarget, setRelationshipUpdateTarget] = useState<string | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null);

  const defaultVenuesByName = useMemo(
    () => new Map(BASE_VENUES.map((venue) => [venue.name, venue])),
    []
  );

  const fetchBookings = useCallback(
    async (venuesOverride?: VenueCardData[]) => {
      if (!user) {
        setBookings([]);
        return;
      }

      setLoadingBookings(true);
      try {
        const venuesToUse = venuesOverride ?? venues;
        const { data, error } = await supabase
          .from("venue_bookings")
          .select(
            "id, venue_id, event_date, status, ticket_price, expected_attendance, actual_attendance, revenue"
          )
          .eq("user_id", user.id)
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true });

        if (error) throw error;

        const venueLookup = new Map(
          venuesToUse
            .filter((venue) => venue.supabaseId)
            .map((venue) => [venue.supabaseId as string, venue])
        );

        const mappedBookings: VenueBookingDisplay[] = (data ?? []).map((booking) => {
          const eventDate = new Date(booking.event_date);
          const venueMatch = venueLookup.get(booking.venue_id);
          const capacity = venueMatch?.capacity ?? booking.expected_attendance ?? 0;
          const soldTickets = booking.actual_attendance ?? booking.expected_attendance ?? 0;
          const ticketPrice = booking.ticket_price ?? 0;
          const revenue = booking.revenue ?? soldTickets * ticketPrice;
          const progress = capacity > 0 ? Math.min(100, (soldTickets / capacity) * 100) : 0;

          return {
            id: booking.id,
            venueName: venueMatch?.name ?? "Unknown Venue",
            eventDate: eventDate.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            eventTime: eventDate.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            }),
            capacity,
            soldTickets,
            ticketPrice,
            revenue,
            status: booking.status ?? "Upcoming",
            progress,
          };
        });

        setBookings(mappedBookings);
      } catch (error) {
        console.error("Error loading bookings:", error);
        toast({
          title: "Unable to load bookings",
          description: "There was a problem loading your upcoming shows.",
          variant: "destructive",
        });
      } finally {
        setLoadingBookings(false);
      }
    },
    [user, venues, toast]
  );

  const fetchVenuesAndRelationships = useCallback(async () => {
    if (!user) {
      setVenues(
        BASE_VENUES.map((venue) => ({
          ...venue,
          relationshipLevel: deriveRelationshipLevel(venue.relationship),
        }))
      );
      setBookings([]);
      setLoadingVenues(false);
      return;
    }

    setLoadingVenues(true);

    try {
      const [{ data: venuesData, error: venuesError }, { data: relationshipsData, error: relationshipsError }] =
        await Promise.all([
          supabase.from("venues").select("id, name, location, capacity, prestige_level, requirements"),
          supabase
            .from("venue_relationships")
            .select("venue_id, relationship_score, relationship_level")
            .eq("user_id", user.id),
        ]);

      if (venuesError) throw venuesError;
      if (relationshipsError) throw relationshipsError;

      const relationshipMap = new Map<string, VenueRelationshipRow>();
      relationshipsData?.forEach((relationship) => {
        relationshipMap.set(relationship.venue_id, relationship);
      });

      let mappedVenues: VenueCardData[];

      if (venuesData && venuesData.length > 0) {
        mappedVenues = venuesData.map((venue, index) => {
          const defaults = defaultVenuesByName.get(venue.name);
          const relationship = relationshipMap.get(venue.id);
          const baseRelationship = defaults?.relationship ?? 0;
          const relationshipScore = relationship?.relationship_score ?? baseRelationship;
          const relationshipLevel = relationship?.relationship_level ?? deriveRelationshipLevel(relationshipScore);

          return {
            ...(defaults ?? {
              id: BASE_VENUES.length + index + 1,
              name: venue.name,
              capacity: venue.capacity ?? 0,
              location: venue.location ?? "Unknown",
              relationship: relationshipScore,
              bookedShows: 0,
              revenue: 0,
              reputation: "Emerging",
              unlocked: true,
              requirements: "Build more reputation to unlock this venue",
              perks: [],
            }),
            name: venue.name,
            capacity: venue.capacity ?? defaults?.capacity ?? 0,
            location: venue.location ?? defaults?.location ?? "Unknown",
            relationship: relationshipScore,
            relationshipLevel,
            supabaseId: venue.id,
            unlocked: defaults?.unlocked ?? true,
            requirements:
              typeof venue.requirements === "string"
                ? venue.requirements
                : defaults?.requirements ?? "Build more reputation to unlock this venue",
          };
        });
      } else {
        mappedVenues = BASE_VENUES.map((venue) => ({
          ...venue,
          relationshipLevel: deriveRelationshipLevel(venue.relationship),
        }));
      }

      setVenues(mappedVenues);
      await fetchBookings(mappedVenues);
    } catch (error) {
      console.error("Error loading venue data:", error);
      toast({
        title: "Unable to load venues",
        description: "There was a problem loading venue data. Please try again.",
        variant: "destructive",
      });
      setVenues(
        BASE_VENUES.map((venue) => ({
          ...venue,
          relationshipLevel: deriveRelationshipLevel(venue.relationship),
        }))
      );
    } finally {
      setLoadingVenues(false);
    }
  }, [user, toast, defaultVenuesByName, fetchBookings]);

  useEffect(() => {
    void fetchVenuesAndRelationships();
  }, [fetchVenuesAndRelationships]);

  useEffect(() => {
    if (activeTab === "bookings") {
      void fetchBookings();
    }
  }, [activeTab, fetchBookings]);

  const handleImproveRelationship = async (venue: VenueCardData) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "You need to be signed in to manage venue relationships.",
        variant: "destructive",
      });
      return;
    }

    if (!venue.supabaseId) {
      toast({
        title: "Venue not linked",
        description: "This venue is not yet linked to the venue directory.",
        variant: "destructive",
      });
      return;
    }

    setRelationshipUpdateTarget(venue.supabaseId);

    try {
      const updatedScore = Math.min(100, venue.relationship + 5);
      const updatedLevel = deriveRelationshipLevel(updatedScore);
      const timestamp = new Date().toISOString();

      const { error } = await supabase
        .from("venue_relationships")
        .upsert(
          {
            user_id: user.id,
            venue_id: venue.supabaseId,
            relationship_score: updatedScore,
            relationship_level: updatedLevel,
            last_interaction_at: timestamp,
            updated_at: timestamp,
          },
          { onConflict: "user_id,venue_id" }
        );

      if (error) throw error;

      setVenues((current) =>
        current.map((item) =>
          item.supabaseId === venue.supabaseId
            ? { ...item, relationship: updatedScore, relationshipLevel: updatedLevel }
            : item
        )
      );

      toast({
        title: "Relationship improved!",
        description: `Your relationship with ${venue.name} is now ${updatedLevel}.`,
      });
    } catch (error) {
      console.error("Error updating venue relationship:", error);
      toast({
        title: "Unable to improve relationship",
        description: "We couldn't update the venue relationship. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRelationshipUpdateTarget(null);
    }
  };

  const handleBookVenue = async (venue: VenueCardData) => {
    if (!venue.unlocked) {
      toast({
        title: "Venue locked",
        description: `Requirements: ${venue.requirements}`,
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Sign in required",
        description: "You need to be signed in to schedule a show.",
        variant: "destructive",
      });
      return;
    }

    if (!venue.supabaseId) {
      toast({
        title: "Venue not linked",
        description: "This venue is not yet connected to the venue directory.",
        variant: "destructive",
      });
      return;
    }

    setBookingInProgress(venue.supabaseId);

    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 14);
    const capacity = venue.capacity ?? 0;
    const expectedAttendance = capacity > 0 ? Math.min(capacity, Math.max(50, Math.round(capacity * 0.75))) : 100;
    const ticketPrice = Math.max(15, Math.round(((capacity || 200) * 0.2)));
    const estimatedRevenue = expectedAttendance * ticketPrice;

    try {
      const { error } = await supabase.from("venue_bookings").insert({
        user_id: user.id,
        venue_id: venue.supabaseId,
        event_date: eventDate.toISOString(),
        status: "Upcoming",
        ticket_price: ticketPrice,
        expected_attendance: expectedAttendance,
        actual_attendance: 0,
        revenue: estimatedRevenue,
      });

      if (error) throw error;

      toast({
        title: "Show booked!",
        description: `Your show at ${venue.name} has been scheduled for ${eventDate.toLocaleDateString()}.`,
      });

      setActiveTab("bookings");
      await fetchBookings();
    } catch (error) {
      console.error("Error booking venue:", error);
      toast({
        title: "Unable to book venue",
        description: "We couldn't schedule that show. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBookingInProgress(null);
    }
  };

  const getRelationshipColor = (relationship: number) => {
    if (relationship >= 80) return "text-green-400";
    if (relationship >= 60) return "text-yellow-400";
    if (relationship >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmed":
      case "Completed":
        return "bg-green-500";
      case "Selling":
      case "On Sale":
        return "bg-blue-500";
      case "Upcoming":
      case "Scheduled":
        return "bg-purple-500";
      case "Pending":
        return "bg-amber-500";
      default:
        return "bg-gray-500";
    }
  };

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
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="venues" className="space-y-6">
            {loadingVenues && (
              <div className="text-center text-cream/60 text-sm">Synchronizing venue data...</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {venues.map((venue) => (
                <Card
                  key={venue.supabaseId ?? venue.id}
                  className={`border-2 transition-all ${
                    venue.unlocked
                      ? "bg-card/80 border-accent hover:bg-card/90"
                      : "bg-card/40 border-accent/40"
                  }`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className={`${venue.unlocked ? 'text-cream' : 'text-cream/60'}`}>
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
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary">{venue.reputation}</Badge>
                        <Badge variant="outline" className="text-xs border-accent/40 text-accent/80 bg-transparent">
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
                        <p className="text-xl font-bold text-accent">{venue.capacity.toLocaleString()}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-cream/60">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-sm">Revenue</span>
                        </div>
                        <p className="text-xl font-bold text-accent">${venue.revenue.toLocaleString()}</p>
                      </div>
                    </div>

                    {venue.unlocked && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-cream/60 text-sm">Relationship</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs border-accent/40 text-accent/80 bg-transparent">
                                {venue.relationshipLevel}
                              </Badge>
                              <span className={`font-bold ${getRelationshipColor(venue.relationship)}`}>
                                {venue.relationship}%
                              </span>
                            </div>
                          </div>
                          <Progress value={venue.relationship} className="h-2" />
                        </div>

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

                        <div className="flex gap-2">
                          <Button
                            onClick={() => { void handleBookVenue(venue); }}
                            className="flex-1 bg-accent hover:bg-accent/80 text-background"
                            disabled={
                              !venue.unlocked ||
                              !venue.supabaseId ||
                              bookingInProgress === venue.supabaseId ||
                              !user
                            }
                          >
                            {bookingInProgress === venue.supabaseId ? "Booking..." : "Book Show"}
                          </Button>
                          <Button
                            onClick={() => { void handleImproveRelationship(venue); }}
                            variant="outline"
                            className="border-accent text-accent hover:bg-accent/10"
                            disabled={
                              !venue.supabaseId ||
                              !user ||
                              relationshipUpdateTarget === venue.supabaseId
                            }
                          >
                            <Heart className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {!venue.unlocked && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <p className="text-cream/60 text-sm">Requirements</p>
                          <p className="text-sm text-cream/80">{venue.requirements}</p>
                        </div>
                        <Button 
                          disabled
                          className="w-full bg-accent/50 text-background/50"
                        >
                          Unlock Required
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bookings" className="space-y-6">
            {!user ? (
              <Card className="bg-card/80 border-accent/40">
                <CardContent className="py-6 text-center text-cream/70">
                  Sign in to view and manage your upcoming bookings.
                </CardContent>
              </Card>
            ) : loadingBookings ? (
              <Card className="bg-card/80 border-accent/40">
                <CardContent className="py-6 text-center text-cream/70">
                  Loading upcoming bookings...
                </CardContent>
              </Card>
            ) : bookings.length === 0 ? (
              <Card className="bg-card/80 border-accent/40">
                <CardContent className="py-6 text-center text-cream/70 space-y-2">
                  <p>No upcoming bookings yet.</p>
                  <p className="text-sm text-cream/50">Schedule a show to see it appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => {
                  const hasCapacity = booking.capacity > 0;
                  const ticketsLabel = hasCapacity
                    ? `${booking.soldTickets}/${booking.capacity}`
                    : `${booking.soldTickets}`;

                  return (
                    <Card key={booking.id} className="bg-card/80 border-accent">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-cream">{booking.venueName}</h3>
                            <div className="flex items-center gap-2 text-cream/60 text-sm">
                              <Calendar className="h-4 w-4" />
                              {booking.eventDate}
                            </div>
                            <div className="flex items-center gap-2 text-cream/60 text-sm">
                              <Clock className="h-4 w-4" />
                              {booking.eventTime}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Capacity</p>
                            <p className="text-lg font-bold text-accent">
                              {hasCapacity ? booking.capacity.toLocaleString() : "-"}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Tickets Reserved</p>
                            <div className="space-y-1">
                              <p className="text-lg font-bold text-accent">{ticketsLabel}</p>
                              <Progress value={booking.progress} className="h-2" />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Projected Revenue</p>
                            <p className="text-lg font-bold text-accent">${booking.revenue.toLocaleString()}</p>
                            <p className="text-xs text-cream/50">
                              Ticket Price: ${booking.ticketPrice.toLocaleString()}
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
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Total Shows</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">24</div>
                  <p className="text-cream/60 text-sm">+4 this month</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Average Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">78%</div>
                  <p className="text-cream/60 text-sm">+12% improvement</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">$45,200</div>
                  <p className="text-cream/60 text-sm">From live shows</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Venue Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {venues.filter(v => v.unlocked && v.bookedShows > 0).map((venue) => (
                    <div key={venue.supabaseId ?? venue.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-cream">{venue.name}</span>
                        <span className="text-accent font-bold">{venue.bookedShows} shows</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-cream/60">Revenue: </span>
                          <span className="text-accent">${venue.revenue.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-cream/60">Relationship: </span>
                          <span className={getRelationshipColor(venue.relationship)}>
                            {venue.relationship}%
                          </span>
                        </div>
                        <div>
                          <span className="text-cream/60">Capacity: </span>
                          <span className="text-cream">{venue.capacity.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
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