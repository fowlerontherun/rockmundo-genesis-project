import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  tickets_sold: number | null;
  revenue: number | null;
  travel_cost: number | null;
  lodging_cost: number | null;
  misc_cost: number | null;
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

interface VenueScheduleForm {
  venueId: string;
  date: string;
  ticketPrice: string;
  travelCost: string;
  lodgingCost: string;
  miscCost: string;
}

interface NewTourVenueDetails {
  venueId: string;
  date: string;
  ticketPrice: number;
  travelCost: number;
  lodgingCost: number;
  miscCost: number;
}

const createEmptySchedule = (): VenueScheduleForm => ({
  venueId: "",
  date: "",
  ticketPrice: "",
  travelCost: "",
  lodgingCost: "",
  miscCost: ""
});

const TourManager = () => {
  const { user } = useAuth();
  const { profile, skills } = useGameData();
  const { toast } = useToast();
  const [tours, setTours] = useState<Tour[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTour, setCreatingTour] = useState(false);
  const [newTour, setNewTour] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: ""
  });
  const [venueSchedules, setVenueSchedules] = useState<Record<string, VenueScheduleForm>>({});

  useEffect(() => {
    if (user) {
      loadTours();
      loadVenues();
    }
  }, [user]);

  const loadTours = async () => {
    if (!user) return;

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
      setTours((data || []).map(tour => ({
        ...tour,
        venues: (tour.tour_venues || []).map(tv => ({
          ...tv,
          venue: tv.venues
        }))
      })));
    } catch (error: any) {
      console.error('Error loading tours:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tours"
      });
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
      loadTours();
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

  const addVenueToTour = async (tourId: string, details: NewTourVenueDetails) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('tour_venues')
        .insert({
          tour_id: tourId,
          venue_id: details.venueId,
          date: details.date,
          ticket_price: details.ticketPrice,
          travel_cost: details.travelCost,
          lodging_cost: details.lodgingCost,
          misc_cost: details.miscCost,
          tickets_sold: 0,
          revenue: 0,
          status: 'scheduled'
        });

      if (error) throw error;

      toast({
        title: "Venue Added",
        description: "Venue has been added to your tour"
      });

      loadTours();
      return true;
    } catch (error: any) {
      console.error('Error adding venue to tour:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add venue to tour"
      });
      return false;
    }
  };

  const updateVenueSchedule = (tourId: string, field: keyof VenueScheduleForm, value: string) => {
    setVenueSchedules(prev => {
      const current = prev[tourId] ?? createEmptySchedule();
      return {
        ...prev,
        [tourId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const parseCurrencyInput = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed));
  };

  const handleScheduleVenue = async (tourId: string) => {
    const schedule = venueSchedules[tourId] ?? createEmptySchedule();

    if (!schedule.venueId || !schedule.date) {
      toast({
        variant: "destructive",
        title: "Missing Details",
        description: "Select a venue and date to schedule a show."
      });
      return;
    }

    const ticketPrice = parseCurrencyInput(schedule.ticketPrice);
    const travelCost = parseCurrencyInput(schedule.travelCost);
    const lodgingCost = parseCurrencyInput(schedule.lodgingCost);
    const miscCost = parseCurrencyInput(schedule.miscCost);

    let isoDate = schedule.date;
    if (!schedule.date.includes('T')) {
      const parsedDate = new Date(schedule.date);
      if (!Number.isNaN(parsedDate.getTime())) {
        isoDate = parsedDate.toISOString();
      }
    }

    const success = await addVenueToTour(tourId, {
      venueId: schedule.venueId,
      date: isoDate,
      ticketPrice,
      travelCost,
      lodgingCost,
      miscCost
    });

    if (success) {
      setVenueSchedules(prev => ({
        ...prev,
        [tourId]: createEmptySchedule()
      }));
    }
  };

  const simulateTourShow = async (tourVenue: TourVenue) => {
    if (!user || !profile || !skills) return;

    const venueInfo = tourVenue.venue;
    if (!venueInfo) {
      toast({
        variant: "destructive",
        title: "Missing Venue Details",
        description: "Unable to simulate this show because venue information is incomplete."
      });
      return;
    }

    try {
      // Calculate show success based on skills and venue prestige
      const successRate = Math.min(0.9, skills.performance / 100);
      const capacity = venueInfo.capacity || 500;
      const attendance = Math.floor(capacity * (0.4 + successRate * 0.5));
      const ticketPrice = tourVenue.ticket_price ?? 25;
      const revenue = attendance * ticketPrice;
      const totalCosts = (tourVenue.travel_cost || 0) + (tourVenue.lodging_cost || 0) + (tourVenue.misc_cost || 0);
      const profit = revenue - totalCosts;

      const { error } = await supabase
        .from('tour_venues')
        .update({
          tickets_sold: attendance,
          revenue,
          status: 'completed'
        })
        .eq('id', tourVenue.id);

      if (error) throw error;

      // Update player cash and fame
      const fameGain = Math.floor(attendance / 10);
      const currentCash = profile.cash ?? 0;
      const currentFame = profile.fame ?? 0;

      await supabase
        .from('profiles')
        .update({
          cash: currentCash + profit,
          fame: currentFame + fameGain
        })
        .eq('user_id', user.id);

      let profitDescription = "break-even result";
      if (profit > 0) {
        profitDescription = `profit of $${profit.toLocaleString()}`;
      } else if (profit < 0) {
        profitDescription = `loss of $${Math.abs(profit).toLocaleString()}`;
      }

      toast({
        title: "Show Complete!",
        description: `Great performance! Earned $${revenue.toLocaleString()} revenue with $${totalCosts.toLocaleString()} costs, resulting in a ${profitDescription} and ${fameGain} fame.`
      });

      loadTours();
    } catch (error: any) {
      console.error('Error simulating tour show:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete show"
      });
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
    const totalCosts = tour.venues?.reduce((sum, v) => sum + (v.travel_cost || 0) + (v.lodging_cost || 0) + (v.misc_cost || 0), 0) || 0;
    const totalProfit = totalRevenue - totalCosts;
    const totalTickets = tour.venues?.reduce((sum, v) => sum + (v.tickets_sold || 0), 0) || 0;
    const completedShows = tour.venues?.filter(v => v.status === 'completed').length || 0;
    const totalShows = tour.venues?.length || 0;

    return { totalRevenue, totalCosts, totalProfit, totalTickets, completedShows, totalShows };
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
            const schedule = venueSchedules[tour.id] ?? createEmptySchedule();
            const profitColor = stats.totalProfit >= 0 ? "text-success" : "text-destructive";
            const formattedNetProfit = stats.totalProfit >= 0
              ? `+$${stats.totalProfit.toLocaleString()}`
              : `-$${Math.abs(stats.totalProfit).toLocaleString()}`;
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
                    <Badge variant="outline" className={getStatusColor(tour.status)}>
                      {tour.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tour Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">${stats.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-destructive">${stats.totalCosts.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Costs</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${profitColor}`}>{formattedNetProfit}</p>
                      <p className="text-xs text-muted-foreground">Net Profit</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{stats.totalTickets.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Tickets Sold</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-warning">{stats.completedShows}/{stats.totalShows}</p>
                      <p className="text-xs text-muted-foreground">Shows Completed</p>
                    </div>
                  </div>

                  {/* Schedule Show */}
                  <div className="space-y-3 p-4 border border-dashed border-primary/20 rounded-lg bg-secondary/20">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      Schedule New Show
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor={`venue-${tour.id}`}>Venue</Label>
                        <Select
                          value={schedule.venueId}
                          onValueChange={(value) => updateVenueSchedule(tour.id, "venueId", value === "no-venues" ? "" : value)}
                          disabled={venues.length === 0}
                        >
                          <SelectTrigger id={`venue-${tour.id}`}>
                            <SelectValue placeholder={venues.length ? "Choose a venue" : "No venues available"} />
                          </SelectTrigger>
                          <SelectContent>
                            {venues.length > 0 ? (
                              venues.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.name} • {option.location}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-venues" disabled>
                                No venues available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`date-${tour.id}`}>Date</Label>
                        <Input
                          id={`date-${tour.id}`}
                          type="date"
                          value={schedule.date}
                          onChange={(e) => updateVenueSchedule(tour.id, "date", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`ticket-${tour.id}`}>Ticket Price</Label>
                        <Input
                          id={`ticket-${tour.id}`}
                          type="number"
                          min={0}
                          value={schedule.ticketPrice}
                          onChange={(e) => updateVenueSchedule(tour.id, "ticketPrice", e.target.value)}
                          placeholder="50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor={`travel-${tour.id}`}>Travel Cost</Label>
                        <Input
                          id={`travel-${tour.id}`}
                          type="number"
                          min={0}
                          value={schedule.travelCost}
                          onChange={(e) => updateVenueSchedule(tour.id, "travelCost", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`lodging-${tour.id}`}>Lodging Cost</Label>
                        <Input
                          id={`lodging-${tour.id}`}
                          type="number"
                          min={0}
                          value={schedule.lodgingCost}
                          onChange={(e) => updateVenueSchedule(tour.id, "lodgingCost", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`misc-${tour.id}`}>Misc Cost</Label>
                        <Input
                          id={`misc-${tour.id}`}
                          type="number"
                          min={0}
                          value={schedule.miscCost}
                          onChange={(e) => updateVenueSchedule(tour.id, "miscCost", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleScheduleVenue(tour.id)}
                        disabled={!schedule.venueId || !schedule.date || venues.length === 0}
                      >
                        Schedule Show
                      </Button>
                    </div>
                  </div>

                  {/* Tour Dates */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Tour Dates ({tour.venues?.length || 0})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {tour.venues && tour.venues.length > 0 ? (
                        tour.venues.map((venue) => {
                          const travelCost = venue.travel_cost || 0;
                          const lodgingCost = venue.lodging_cost || 0;
                          const miscCost = venue.misc_cost || 0;
                          const showRevenue = venue.revenue || 0;
                          const showCosts = travelCost + lodgingCost + miscCost;
                          const showProfit = showRevenue - showCosts;
                          const showProfitColor = showProfit >= 0 ? "text-success" : "text-destructive";

                          return (
                            <div key={venue.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                              <div className="flex-1 space-y-1">
                                <p className="font-medium">{venue.venue?.name ?? "Unknown Venue"}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {venue.venue?.location ?? "Location TBD"} • {new Date(venue.date).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {venue.tickets_sold ?? 0}/{venue.venue?.capacity ?? 0} tickets • ${venue.ticket_price ?? 0} each
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Costs: ${showCosts.toLocaleString()} (Travel ${travelCost.toLocaleString()} • Lodging ${lodgingCost.toLocaleString()} • Misc ${miscCost.toLocaleString()})
                                </p>
                                <p className={`text-xs font-semibold ${showProfitColor}`}>
                                  Profit: ${showProfit.toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={getStatusColor(venue.status)}>
                                  {venue.status}
                                </Badge>
                                {venue.status === 'scheduled' && (
                                  <Button
                                    size="sm"
                                    onClick={() => simulateTourShow(venue)}
                                    disabled={!venue.venue}
                                  >
                                    Perform
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No venues added to this tour yet
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 text-sm text-muted-foreground">
                      <span>{new Date(tour.start_date).toLocaleDateString()} - {new Date(tour.end_date).toLocaleDateString()}</span>
                      <span className={`font-semibold ${profitColor}`}>
                        Net Profit: {formattedNetProfit}
                      </span>
                    </div>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Manage
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
