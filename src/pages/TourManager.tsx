import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Users, 
  MapPin, 
  Star, 
  TrendingUp, 
  DollarSign,
  AlertCircle,
  Plane,
  Music,
  Clock,
  Plus,
  Settings
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateGigPayment, meetsRequirements } from "@/utils/gameBalance";
import { applyEquipmentWear } from "@/utils/equipmentWear";

interface Tour {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  total_revenue: number;
  band_id?: string;
  venues: TourVenue[];
  tour_venues?: TourVenue[];
}

interface TourVenue {
  id: string;
  venue_id: string;
  date: string;
  ticket_price: number | null;
  marketing_spend: number | null;
  tickets_sold: number | null;
  revenue: number | null;
  status: string | null;
  venues?: {
    name: string;
    location: string;
    capacity: number;
  };
  venue?: {
    name: string;
    location: string;
    capacity: number;
  };
}

interface EditTourForm {
  start_date: string;
  end_date: string;
  status: string;
  venues: Array<{
    id: string;
    venue_id: string;
    date: string;
    status: string | null;
    ticket_price: number | null;
  }>;
  newVenue: {
    venue_id: string;
    date: string;
    ticket_price: string;
  };
}

const TourManager = () => {
  const { user } = useAuth();
  const { profile, skills } = useGameData();
  const { toast } = useToast();
  const [tours, setTours] = useState<Tour[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTour, setCreatingTour] = useState(false);
  const [ticketPriceUpdates, setTicketPriceUpdates] = useState<Record<string, string>>({});
  const [marketingSpendUpdates, setMarketingSpendUpdates] = useState<Record<string, string>>({});
  const [updatingVenue, setUpdatingVenue] = useState<string | null>(null);
  const [performingVenue, setPerformingVenue] = useState<string | null>(null);

  const [newTour, setNewTour] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: ""
  });

  const normalizeDate = (date?: string | null) => (date ? date.split("T")[0] : "");

  const initializeEditForm = (tour: Tour): EditTourForm => ({
    start_date: normalizeDate(tour.start_date),
    end_date: normalizeDate(tour.end_date),
    status: tour.status || "planned",
    venues: (tour.venues || []).map((venue) => ({
      id: venue.id,
      venue_id: venue.venue_id,
      date: normalizeDate(venue.date),
      status: venue.status || "scheduled",
      ticket_price: venue.ticket_price
    })),
    newVenue: {
      venue_id: "",
      date: "",
      ticket_price: ""
    }
  });

  const tourStatusOptions = ['planned', 'active', 'completed', 'cancelled'];
  const venueStatusOptions = ['scheduled', 'completed', 'cancelled'];

  useEffect(() => {
    if (user) {
      loadTours();
      loadVenues();
    }
  }, [user]);

  const loadTours = async (): Promise<Tour[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('tours')
        .select(`
          *,
          tour_venues!tour_venues_tour_id_fkey (
            *,
            venues!tour_venues_venue_id_fkey (name, location, capacity)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mappedTours = (data || []).map(tour => ({
        ...tour,
        venues: (tour.tour_venues || []).map(tv => ({
          ...tv,
          venue: tv.venues
        }))
      })));
      setTicketPriceUpdates({});
      setMarketingSpendUpdates({});
    } catch (error: any) {
      console.error('Error loading tours:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tours"
      });
      return [];
    }
  };

  const loadVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('prestige_level', { ascending: true });

      if (error) throw error;
      setVenues(data || []);
    } catch (error: any) {
      console.error('Error loading venues:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTour = async () => {
    if (!user || !profile || !skills) return;

    try {
      setCreatingTour(true);

      // Check if player meets tour requirements
      const tourRequirements = { fame: 1000, performance: 50 };
      const { meets, missing } = meetsRequirements(tourRequirements, {
        fame: profile.fame,
        performance: skills.performance
      });

      if (!meets) {
        toast({
          variant: "destructive",
          title: "Requirements Not Met",
          description: `You need: ${missing.join(', ')}`
        });
        return;
      }

      const { data, error } = await supabase
        .from('tours')
        .insert({
          user_id: user.id,
          name: newTour.name,
          description: newTour.description,
          start_date: newTour.start_date,
          end_date: newTour.end_date,
          status: 'planned'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Tour Created!",
        description: `${newTour.name} has been added to your tour schedule`
      });

      setNewTour({ name: "", description: "", start_date: "", end_date: "" });
      await loadTours();
    } catch (error: any) {
      console.error('Error creating tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create tour"
      });
    } finally {
      setCreatingTour(false);
    }
  };

  const addVenueToTour = async (tourId: string, venueId: string, date: string, ticketPrice: number, marketingSpend: number) => {
    if (!user) return;

    try {
      const { data: newTourVenue, error } = await supabase
        .from('tour_venues')
        .insert({
          tour_id: tourId,
          venue_id: venueId,
          date,
          ticket_price: ticketPrice,
          marketing_spend: marketingSpend,
          tickets_sold: 0,
          revenue: 0,
          status: 'scheduled'
        })
        .select()
        .single();

      if (error) throw error;

      if (newTourVenue) {
        const selectedTour = tours.find(tour => tour.id === tourId);
        const selectedVenue = venues.find(venue => venue.id === venueId);
        const eventEnd = new Date(newTourVenue.date);
        eventEnd.setHours(eventEnd.getHours() + 3);

        const { error: scheduleError } = await supabase
          .from('schedule_events')
          .insert({
            user_id: user.id,
            event_type: 'tour',
            title: `${selectedTour?.name ?? 'Tour Show'}${selectedVenue ? ` - ${selectedVenue.name}` : ''}`,
            description: selectedTour?.description ?? (selectedVenue ? `Tour stop at ${selectedVenue.name}` : 'Tour performance'),
            start_time: newTourVenue.date,
            end_time: eventEnd.toISOString(),
            location: selectedVenue?.location ?? 'TBA',
            status: 'scheduled',
            tour_venue_id: newTourVenue.id
          });

        if (scheduleError) {
          console.error('Error adding tour stop to schedule:', scheduleError);
          toast({
            variant: "destructive",
            title: "Schedule update failed",
            description: "Tour stop added but the schedule couldn't be updated automatically."
          });
        }
      }

      toast({
        title: "Venue Added",
        description: "Venue has been added to your tour"
      });

      const updatedTours = await loadTours();
      const updatedTour = updatedTours.find((t) => t.id === tourId);
      if (updatedTour) {
        setEditForms((prev) => ({
          ...prev,
          [tourId]: initializeEditForm(updatedTour)
        }));
      }
    } catch (error: any) {
      console.error('Error adding venue to tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add venue to tour"
      });
    }
  };

  const updateTourVenueSettings = async (
    tourVenueId: string,
    ticketPrice: number | null,
    marketingSpend: number | null
  ) => {
    if (!user) return;

    const updates: Record<string, number> = {};

    if (typeof ticketPrice === "number" && !Number.isNaN(ticketPrice)) {
      updates.ticket_price = Math.max(0, Math.round(ticketPrice * 100) / 100);
    }

    if (typeof marketingSpend === "number" && !Number.isNaN(marketingSpend)) {
      updates.marketing_spend = Math.max(0, Math.round(marketingSpend * 100) / 100);
    }

    if (Object.keys(updates).length === 0) {
      toast({
        variant: "destructive",
        title: "Invalid values",
        description: "Please provide a valid ticket price or marketing spend."
      });
      return;
    }
    try {
      setUpdatingVenue(tourVenueId);
      const { error } = await supabase
        .from('tour_venues')
        .update(updates)
        .eq('id', tourVenueId);

      if (error) throw error;

      toast({
        title: "Show settings updated",
        description: "Ticket price and marketing spend have been saved."
      });

      loadTours();
    } catch (error: any) {
      console.error('Error updating tour venue:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update show settings"
      });
    } finally {
      setUpdatingVenue(null);
    }
  };

  const simulateTourShow = async (tourVenue: TourVenue) => {
    if (!user || !profile || !skills) return;

    try {
      setPerformingVenue(tourVenue.id);

      const venueInfo = tourVenue.venue || tourVenue.venues;
      const capacity = venueInfo?.capacity || 0;
      const marketingSpend = typeof tourVenue.marketing_spend === "number" ? Math.max(0, tourVenue.marketing_spend) : 0;
      const ticketPrice = typeof tourVenue.ticket_price === "number" ? Math.max(0, tourVenue.ticket_price) : 25;

      const fameInfluence = Math.min(0.5, (profile.fame || 0) / 10000);
      const marketingInfluence = Math.min(0.3, marketingSpend / 10000);
      const baseAttendanceRate = 0.25;
      const attendanceRate = Math.min(0.95, baseAttendanceRate + fameInfluence + marketingInfluence);
      const ticketsSold = Math.min(
        capacity,
        Math.max(0, Math.floor(capacity * attendanceRate))
      );
      const revenue = ticketPrice * ticketsSold;
      const profit = revenue - marketingSpend;

      const { error } = await supabase
        .from('tour_venues')
        .update({
          tickets_sold: ticketsSold,
          revenue: revenue,
          ticket_price: ticketPrice,
          marketing_spend: marketingSpend,
          status: 'completed'
        })
        .eq('id', tourVenue.id);

      if (error) throw error;

      // Update player cash and fame
      const fameGain = Math.floor(ticketsSold / 10);
      await supabase
        .from('profiles')
        .update({
          cash: profile.cash + profit,
          fame: profile.fame + fameGain
        })
        .eq('user_id', user.id);

      let wearNotice = '';

      try {
        const wearSummary = await applyEquipmentWear(user.id, 'tour');
        if (wearSummary?.updates.length) {
          wearNotice = ` Gear wear detected on ${wearSummary.updates.length} item${wearSummary.updates.length > 1 ? 's' : ''}. Check the inventory manager to repair them.`;
        }
      } catch (wearError) {
        console.error('Failed to apply equipment wear after tour show', wearError);
      }

      toast({
        title: "Show Complete!",
        description: `Show results: $${revenue.toLocaleString()} revenue, ${ticketsSold} tickets sold, ${profit >= 0 ? 'profit' : 'loss'} of $${Math.abs(profit).toLocaleString()}`
      });

      await loadTours();
    } catch (error: any) {
      console.error('Error simulating tour show:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete show"
      });
    } finally {
      setPerformingVenue(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-success border-success bg-success/10';
      case 'active': return 'text-warning border-warning bg-warning/10';
      case 'cancelled': return 'text-destructive border-destructive bg-destructive/10';
      default: return 'text-primary border-primary bg-primary/10';
    }
  };

  const calculateTourStats = (tour: Tour) => {
    const totalRevenue = tour.venues?.reduce((sum, v) => sum + (v.revenue || 0), 0) || 0;
    const totalTickets = tour.venues?.reduce((sum, v) => sum + (v.tickets_sold || 0), 0) || 0;
    const totalMarketing = tour.venues?.reduce((sum, v) => sum + (v.marketing_spend || 0), 0) || 0;
    const netProfit = totalRevenue - totalMarketing;
    const completedShows = tour.venues?.filter(v => v.status === 'completed').length || 0;
    const totalShows = tour.venues?.length || 0;

    return { totalRevenue, totalTickets, totalMarketing, netProfit, completedShows, totalShows };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading tour management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Tour Manager
            </h1>
            <p className="text-muted-foreground font-oswald">Plan and manage your concert tours</p>
          </div>
          <Button 
            onClick={() => setCreatingTour(true)}
            className="bg-gradient-primary hover:shadow-electric"
            disabled={!profile || profile.fame < 1000}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Tour
          </Button>
        </div>

        {/* Requirements Check */}
        {profile && profile.fame < 1000 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need at least 1,000 fame and 50 performance skill to create tours. 
              Current fame: {profile.fame}
            </AlertDescription>
          </Alert>
        )}

        {/* Create Tour Form */}
        {creatingTour && (
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Create New Tour</CardTitle>
              <CardDescription>Plan your multi-city tour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tour-name">Tour Name</Label>
                  <Input
                    id="tour-name"
                    value={newTour.name}
                    onChange={(e) => setNewTour({ ...newTour, name: e.target.value })}
                    placeholder="World Domination Tour"
                  />
                </div>
                <div>
                  <Label htmlFor="tour-description">Description</Label>
                  <Input
                    id="tour-description"
                    value={newTour.description}
                    onChange={(e) => setNewTour({ ...newTour, description: e.target.value })}
                    placeholder="Epic tour across multiple cities"
                  />
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newTour.start_date}
                    onChange={(e) => setNewTour({ ...newTour, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newTour.end_date}
                    onChange={(e) => setNewTour({ ...newTour, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={createTour}
                  disabled={!newTour.name || !newTour.start_date || !newTour.end_date}
                >
                  Create Tour
                </Button>
                <Button variant="outline" onClick={() => setCreatingTour(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tours List */}
        <div className="space-y-4">
          {tours.length > 0 ? tours.map((tour) => {
            const stats = calculateTourStats(tour);
            const netProfitPositive = stats.netProfit >= 0;
            const netProfitDisplay = stats.netProfit === 0
              ? '$0'
              : `${netProfitPositive ? '+' : '-'}$${Math.abs(stats.netProfit).toLocaleString()}`;
            return (
              <Card key={tour.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Plane className="h-5 w-5 text-primary" />
                        {tour.name}
                      </CardTitle>
                      <CardDescription>{tour.description}</CardDescription>
                    </div>
                    <Badge variant="outline" className={getStatusColor(tour.status || 'planned')}>
                      {tour.status || 'planned'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tour Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">${stats.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-warning">${stats.totalMarketing.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Marketing Spend</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${netProfitPositive ? 'text-success' : 'text-destructive'}`}>
                        {netProfitDisplay}
                      </p>
                      <p className="text-xs text-muted-foreground">{netProfitPositive ? 'Net Profit' : 'Net Loss'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{stats.totalTickets.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Tickets Sold</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-accent">{stats.completedShows}/{stats.totalShows}</p>
                      <p className="text-xs text-muted-foreground">Shows Completed</p>
                    </div>
                  </div>

                  {editingTourId === tour.id && editForm && (
                    <div className="rounded-lg border border-border/40 bg-secondary/20 p-4 space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Start Date</Label>
                          <Input
                            type="date"
                            value={editForm.start_date}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [tour.id]: {
                                  ...prev[tour.id],
                                  start_date: e.target.value
                                }
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">End Date</Label>
                          <Input
                            type="date"
                            value={editForm.end_date}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [tour.id]: {
                                  ...prev[tour.id],
                                  end_date: e.target.value
                                }
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Status</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary"
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForms((prev) => ({
                                ...prev,
                                [tour.id]: {
                                  ...prev[tour.id],
                                  status: e.target.value
                                }
                              }))
                            }
                          >
                            {tourStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-semibold text-sm">Add New Tour Stop</h5>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Venue</Label>
                            <select
                              className="mt-1 w-full rounded-md border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={editForm.newVenue.venue_id}
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [tour.id]: {
                                    ...prev[tour.id],
                                    newVenue: {
                                      ...prev[tour.id].newVenue,
                                      venue_id: e.target.value
                                    }
                                  }
                                }))
                              }
                            >
                              <option value="">Select venue</option>
                              {venues.map((venueOption) => (
                                <option key={venueOption.id} value={venueOption.id}>
                                  {venueOption.name} • {venueOption.location}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Date</Label>
                            <Input
                              type="date"
                              value={editForm.newVenue.date}
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [tour.id]: {
                                    ...prev[tour.id],
                                    newVenue: {
                                      ...prev[tour.id].newVenue,
                                      date: e.target.value
                                    }
                                  }
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Ticket Price</Label>
                            <Input
                              type="number"
                              min="0"
                              value={editForm.newVenue.ticket_price}
                              onChange={(e) =>
                                setEditForms((prev) => ({
                                  ...prev,
                                  [tour.id]: {
                                    ...prev[tour.id],
                                    newVenue: {
                                      ...prev[tour.id].newVenue,
                                      ticket_price: e.target.value
                                    }
                                  }
                                }))
                              }
                            />
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleAddVenue(tour.id)}>
                          Add Venue
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => editTour(tour.id)}>
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={() => handleCancelEditing(tour.id)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => cancelTour(tour.id)}>
                          Cancel Tour
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tour Dates */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Tour Dates ({tour.venues?.length || 0})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {tour.venues?.map((venue) => {
                        const venueInfo = venue.venue || venue.venues;
                        const ticketsSold = venue.tickets_sold || 0;
                        const capacity = venueInfo?.capacity || 0;
                        const marketingSpend = venue.marketing_spend || 0;
                        const revenue = venue.revenue || 0;
                        const netProfit = revenue - marketingSpend;
                        const ticketPriceValue = ticketPriceUpdates[venue.id] ?? (venue.ticket_price !== null ? venue.ticket_price.toString() : "");
                        const marketingValue = marketingSpendUpdates[venue.id] ?? (venue.marketing_spend !== null ? venue.marketing_spend.toString() : "");
                        const ticketPriceDisplay = typeof venue.ticket_price === 'number'
                          ? `$${venue.ticket_price.toLocaleString()}`
                          : 'N/A';
                        const marketingDisplay = `$${marketingSpend.toLocaleString()}`;

                        return (
                          <div key={venue.id} className="flex flex-col gap-3 p-3 rounded-lg bg-secondary/30">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium">{venueInfo?.name || 'Unknown Venue'}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {venueInfo?.location || 'Unknown Location'} • {new Date(venue.date).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Tickets: {ticketsSold}/{capacity} • Ticket Price: {ticketPriceDisplay}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Marketing Spend: {marketingDisplay} {venue.status === 'completed' && (
                                    <>
                                      {' • '}Revenue: ${revenue.toLocaleString()} {' • '}
                                      {netProfit >= 0 ? 'Profit' : 'Loss'}: ${Math.abs(netProfit).toLocaleString()}
                                    </>
                                  )}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2 min-w-[220px]">
                                <Badge variant="outline" className={getStatusColor(venue.status)}>
                                  {venue.status}
                                </Badge>
                                {venue.status === 'scheduled' && (
                                  <div className="w-full space-y-2">
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ticket Price</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={ticketPriceValue}
                                          onChange={(event) =>
                                            setTicketPriceUpdates((prev) => ({
                                              ...prev,
                                              [venue.id]: event.target.value
                                            }))
                                          }
                                          className="h-9 text-sm"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Marketing Spend</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="50"
                                          value={marketingValue}
                                          onChange={(event) =>
                                            setMarketingSpendUpdates((prev) => ({
                                              ...prev,
                                              [venue.id]: event.target.value
                                            }))
                                          }
                                          className="h-9 text-sm"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={updatingVenue === venue.id || performingVenue === venue.id}
                                        onClick={() => {
                                          const parsedTicketPrice = ticketPriceValue ? parseFloat(ticketPriceValue) : null;
                                          const sanitizedTicketPrice = parsedTicketPrice !== null && !Number.isNaN(parsedTicketPrice)
                                            ? parsedTicketPrice
                                            : null;
                                          const parsedMarketing = marketingValue ? parseFloat(marketingValue) : null;
                                          const sanitizedMarketing = parsedMarketing !== null && !Number.isNaN(parsedMarketing)
                                            ? parsedMarketing
                                            : null;
                                          updateTourVenueSettings(venue.id, sanitizedTicketPrice, sanitizedMarketing);
                                        }}
                                      >
                                        Save Settings
                                      </Button>
                                      <Button
                                        size="sm"
                                        disabled={performingVenue === venue.id || updatingVenue === venue.id}
                                        onClick={() => {
                                          const parsedTicketPrice = ticketPriceValue ? parseFloat(ticketPriceValue) : undefined;
                                          const parsedMarketing = marketingValue ? parseFloat(marketingValue) : undefined;
                                          const ticketPriceOverride = parsedTicketPrice !== undefined && !Number.isNaN(parsedTicketPrice)
                                            ? parsedTicketPrice
                                            : (typeof venue.ticket_price === 'number' ? venue.ticket_price : 25);
                                          const marketingOverride = parsedMarketing !== undefined && !Number.isNaN(parsedMarketing)
                                            ? parsedMarketing
                                            : marketingSpend;

                                          simulateTourShow({
                                            ...venue,
                                            venue: venueInfo,
                                            ticket_price: ticketPriceOverride,
                                            marketing_spend: marketingOverride
                                          });
                                        }}
                                      >
                                        {performingVenue === venue.id ? 'Performing...' : 'Perform'}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }) || (
                        <p className="text-center text-muted-foreground py-4">
                          No venues added to this tour yet
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{new Date(tour.start_date).toLocaleDateString()} - {new Date(tour.end_date).toLocaleDateString()}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageClick(tour)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {editingTourId === tour.id ? "Close" : "Manage"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }) : (
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardContent className="text-center py-12">
                <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Tours Planned</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first tour to perform across multiple cities
                </p>
                <Button 
                  onClick={() => setCreatingTour(true)}
                  disabled={!profile || profile.fame < 1000}
                >
                  Plan Your First Tour
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourManager;